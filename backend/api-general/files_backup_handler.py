"""Резервная копия вложений: ZIP-архив томами + проверка целостности.

Устроено так же, как выгрузка базы, и по тем же причинам:
- собрать архив в памяти нельзя: у функции 256 МБ, а около 125 МБ из них
  уже занято окружением;
- многочастная отправка в хранилище запрещена (ответ 405);
- /tmp у облачной функции — не диск, а та же оперативная память.

Поэтому ZIP пишется потоком и режется на тома фиксированного размера:
каждый том уходит отдельной отправкой и сразу освобождает память.
Режется поток байтов, поэтому склейка томов по порядку даёт в точности
исходный архив: cat part-* > files.zip

Файлы старой системы (vsdesk) пропускаются: у них в базе только имя,
самого файла в хранилище нет.
"""
import hashlib
import json
import os
import re
import struct
import time
import zlib
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import boto3
from botocore.config import Config as BotoConfig
from botocore.exceptions import ClientError

from shared_utils import response, SCHEMA

LINK_TTL_SECONDS = 3600
DUMP_PREFIX = 'files-backups'
VOLUME_SIZE = 8 * 1024 * 1024
# Максимальный размер файла, который берём в архив. Самое большое
# вложение сейчас 2,6 МБ; ограничение защищает от одиночного гиганта,
# который не поместился бы в память вместе с буфером тома.
MAX_FILE_BYTES = 12 * 1024 * 1024
# Ограничение по времени: у функции жёсткий предел на выполнение.
# Не начинаем новый файл, если бюджет исчерпан, — лучше честно
# сказать «архив неполный», чем быть убитым на середине.
TIME_BUDGET_SEC = 240
# Признак записей, перенесённых из старой системы без самих файлов.
CDN_MARKER = 'cdn.poehali.dev'


def _s3_client():
    # signature_version='s3v4' обязателен: со схемой по умолчанию
    # хранилище отвечает Unauthorized на временную ссылку.
    return boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
        config=BotoConfig(
            signature_version='s3v4',
            s3={'addressing_style': 'path'},
            retries={'max_attempts': 3, 'mode': 'standard'},
        ),
    )


def _is_admin(conn, user_id: int) -> bool:
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT 1 FROM user_roles ur "
            "JOIN roles r ON r.id = ur.role_id "
            "WHERE ur.user_id = %s "
            "AND (r.system_role = 'admin' OR r.name = 'admin') LIMIT 1",
            (user_id,),
        )
        return cur.fetchone() is not None
    finally:
        cur.close()


def _key_from_url(url: str) -> Optional[str]:
    """Ключ файла в хранилище из публичного адреса.

    Адрес выглядит так:
    https://cdn.poehali.dev/projects/<id>/bucket/uploads/attachments/x.png
    Нужна часть после '/bucket/'.
    """
    if not url or CDN_MARKER not in url:
        return None
    marker = '/bucket/'
    pos = url.find(marker)
    if pos < 0:
        return None
    key = url[pos + len(marker):].split('?')[0].strip()
    return key or None


_UNSAFE = re.compile(r'[\\/:*?"<>|\x00-\x1f]')


def _safe_name(name: str) -> str:
    """Имя файла, безопасное для распаковки в любой системе.

    Убираются разделители пути и служебные символы, иначе архив мог бы
    записать файл мимо своей папки.
    """
    name = _UNSAFE.sub('_', (name or '').strip()) or 'file'
    name = name.lstrip('.') or 'file'
    return name[:120]


class _VolumeWriter:
    """Поток архива, режущийся на тома по VOLUME_SIZE байт."""

    def __init__(self, s3, bucket: str, key_prefix: str):
        self._s3 = s3
        self._bucket = bucket
        self._prefix = key_prefix
        self._buf = bytearray()
        self._digest = hashlib.sha256()
        self.size = 0
        self.keys: List[str] = []

    def write(self, data: bytes) -> None:
        self._digest.update(data)
        self.size += len(data)
        self._buf.extend(data)
        while len(self._buf) >= VOLUME_SIZE:
            self._flush(VOLUME_SIZE)

    def _flush(self, length: int) -> None:
        chunk = bytes(self._buf[:length])
        del self._buf[:length]
        key = f'{self._prefix}.part{len(self.keys) + 1:03d}'
        self._s3.put_object(
            Bucket=self._bucket,
            Key=key,
            Body=chunk,
            ContentType='application/octet-stream',
        )
        self.keys.append(key)

    def finish(self) -> str:
        if self._buf or not self.keys:
            self._flush(len(self._buf))
        return self._digest.hexdigest()

    def abort(self) -> None:
        for key in self.keys:
            try:
                self._s3.delete_object(Bucket=self._bucket, Key=key)
            except Exception:
                pass
        self.keys = []


def _dos_time(dt: datetime) -> Tuple[int, int]:
    """Дата и время в формате, принятом в ZIP (поля из времён DOS)."""
    year = max(1980, dt.year)
    dos_date = ((year - 1980) << 9) | (dt.month << 5) | dt.day
    dos_time = (dt.hour << 11) | (dt.minute << 5) | (dt.second // 2)
    return dos_time, dos_date


class _ZipStreamWriter:
    """Сборка ZIP прямо в поток, без файла на диске и без буфера целиком.

    Пишем по спецификации ZIP вручную, потому что стандартный модуль
    требует файл, поддерживающий перемотку (seek), а у нас поток в
    хранилище: назад вернуться нельзя. Размеры и контрольная сумма
    известны до записи — файл уже сжат в памяти, — поэтому заголовок
    сразу содержит верные значения и приём с «дозаписью» не нужен.

    Формат — обычный ZIP, без расширений ZIP64: архив около 200 МБ при
    пределе 4 ГБ и тысяче записей при пределе 65535, запас многократный.
    Это сознательный выбор в пользу совместимости: ZIP64 понимают не все
    распаковщики, а простой ZIP открывается везде, включая встроенные
    средства Windows и урезанные консольные утилиты.
    """

    def __init__(self, writer):
        self._w = writer
        self._entries: List[Dict[str, Any]] = []
        self._offset = 0

    def _emit(self, data: bytes) -> None:
        self._w(data)
        self._offset += len(data)

    # Пределы обычного ZIP. При приближении к ним архив пришлось бы
    # закрыть и начать новый — молча превысить нельзя, получится битый файл.
    MAX_ENTRIES = 60000
    MAX_TOTAL = 3 * 1024 * 1024 * 1024

    def full(self) -> bool:
        return (len(self._entries) >= self.MAX_ENTRIES
                or self._offset >= self.MAX_TOTAL)

    def add(self, name: str, data: bytes, mtime: datetime,
            compress: bool) -> None:
        raw = name.encode('utf-8')
        crc = zlib.crc32(data) & 0xFFFFFFFF
        usize = len(data)

        if compress:
            # Уровень 6 — разумный компромисс. Вложения уже сжаты,
            # поэтому выигрыш невелик, но время расходуется заметно.
            co = zlib.compressobj(6, zlib.DEFLATED, -15)
            blob = co.compress(data) + co.flush()
            method = 8
            # Если «сжатое» вышло больше исходного (типично для JPEG и
            # PNG), кладём как есть: иначе архив стал бы толще оригинала.
            if len(blob) >= usize:
                blob = data
                method = 0
        else:
            blob = data
            method = 0

        csize = len(blob)
        dtime, ddate = _dos_time(mtime)
        # Бит 11 — имена в UTF-8, иначе кириллица распакуется кракозябрами.
        flags = 0x800

        offset = self._offset
        self._emit(struct.pack(
            '<IHHHHHIIIHH', 0x04034B50, 20, flags, method, dtime, ddate,
            crc, csize, usize, len(raw), 0,
        ) + raw)
        self._emit(blob)

        self._entries.append({
            'name': raw, 'crc': crc, 'csize': csize, 'usize': usize,
            'offset': offset, 'method': method, 'dtime': dtime, 'ddate': ddate,
        })

    def close(self) -> None:
        """Оглавление архива: список записей и их положение в потоке."""
        start = self._offset
        for e in self._entries:
            self._emit(struct.pack(
                '<IHHHHHHIIIHHHHHII', 0x02014B50, 20, 20, 0x800, e['method'],
                e['dtime'], e['ddate'], e['crc'], e['csize'], e['usize'],
                len(e['name']), 0, 0, 0, 0, 0, e['offset'],
            ) + e['name'])
        size = self._offset - start
        count = len(self._entries)

        self._emit(struct.pack(
            '<IHHHHIIH', 0x06054B50, 0, 0, count, count, size, start, 0,
        ))


def _fetch_attachments(conn) -> List[Dict[str, Any]]:
    """Вложения, реально лежащие в хранилище.

    Записи старой системы отсеиваются прямо в запросе: у них в адресе
    нет CDN, то есть файла не существует.
    """
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT ticket_id, filename, url, size, created_at, 'ticket' AS kind "
            "FROM ticket_attachments WHERE url LIKE %s "
            "UNION ALL "
            "SELECT t.ticket_id, ca.filename, ca.url, ca.size, ca.created_at, "
            "'comment' AS kind "
            "FROM comment_attachments ca "
            "LEFT JOIN ticket_comments t ON t.id = ca.comment_id "
            "WHERE ca.url LIKE %s "
            "ORDER BY 1, 5",
            (f'%{CDN_MARKER}%', f'%{CDN_MARKER}%'),
        )
        return [dict(r) for r in cur.fetchall()]
    finally:
        cur.close()


def _verify_archive(s3, keys: List[str], sha256: str,
                    packed: int) -> List[Dict[str, Any]]:
    """Проверка готового архива перечитыванием из хранилища.

    Успехом считается только пройденная проверка, а не сам факт записи:
    иначе можно отдать пользователю битый архив с видом надёжной копии.
    """
    checks: List[Dict[str, Any]] = []

    def add(name: str, ok: bool, detail: str) -> None:
        checks.append({'name': name, 'ok': ok, 'detail': detail})

    digest = hashlib.sha256()
    total = 0
    tail = b''
    head = b''
    for i, key in enumerate(keys):
        body = s3.get_object(Bucket='files', Key=key)['Body'].read()
        digest.update(body)
        total += len(body)
        if i == 0:
            head = body[:4]
        # Хвост нужен для поиска оглавления — держим только последний кусок.
        tail = body[-256:] if len(body) >= 256 else (tail + body)[-256:]
        del body

    add('Все тома читаются', len(keys) > 0, f'томов: {len(keys)}')
    same = digest.hexdigest() == sha256
    add('Контрольная сумма совпадает', same,
        'файл в хранилище идентичен отправленному' if same
        else 'архив в хранилище повреждён')
    add('Архив не пустой', total > 0, f'{total} байт')
    add('Формат ZIP', head[:2] == b'PK',
        'сигнатура PK на месте' if head[:2] == b'PK' else 'это не ZIP')
    has_end = b'PK\x05\x06' in tail or b'PK\x06\x06' in tail
    add('Оглавление на месте', has_end,
        'архив закрыт корректно' if has_end else 'оглавление не найдено')
    add('Файлы добавлены', packed > 0, f'{packed} файлов')
    return checks


def handle_files_backup(method, event, conn, payload):
    """Создаёт архив вложений из хранилища и проверяет его целостность."""
    if method != 'POST':
        return response(405, {'error': 'Method not allowed'})

    user_id = payload.get('user_id')
    if not user_id:
        return response(401, {'error': 'User ID not found in token'})

    if not _is_admin(conn, int(user_id)):
        return response(403, {'error': 'Доступ только для администратора'})

    if not os.environ.get('AWS_ACCESS_KEY_ID'):
        return response(500, {'error': 'Хранилище файлов не настроено'})

    try:
        body = json.loads(event.get('body') or '{}')
    except (ValueError, TypeError):
        body = {}

    compress = bool(body.get('compress', True))
    # Продолжение с указанного места: если файлов больше, чем помещается
    # в одно выполнение, следующий заход начинается отсюда.
    skip = max(0, int(body.get('skip') or 0))

    started = datetime.now(timezone.utc)
    deadline = time.monotonic() + TIME_BUDGET_SEC

    items = _fetch_attachments(conn)
    total_available = len(items)
    if skip:
        items = items[skip:]

    if not items:
        return response(400, {
            'error': 'Нет файлов для выгрузки',
            'total_available': total_available,
        })

    stamp = started.strftime('%Y%m%d-%H%M%S')
    suffix = f'-from{skip}' if skip else ''
    key = f'{DUMP_PREFIX}/dreamdesk-files-{stamp}{suffix}.zip'

    s3 = _s3_client()
    stream = _VolumeWriter(s3, 'files', key)
    zf = _ZipStreamWriter(stream.write)

    packed = 0
    raw_bytes = 0
    missing: List[str] = []
    oversized: List[str] = []
    used_names: Dict[str, int] = {}
    processed = 0
    truncated = False

    try:
        for item in items:
            if time.monotonic() > deadline or zf.full():
                truncated = True
                break

            processed += 1
            okey = _key_from_url(item.get('url') or '')
            if not okey:
                missing.append(item.get('filename') or '?')
                continue

            if (item.get('size') or 0) > MAX_FILE_BYTES:
                oversized.append(item.get('filename') or '?')
                continue

            try:
                obj = s3.get_object(Bucket='files', Key=okey)
                data = obj['Body'].read()
            except ClientError:
                # Ссылка в базе есть, а файла в хранилище нет.
                # Это не повод рушить всю выгрузку — отмечаем и идём дальше.
                missing.append(item.get('filename') or okey)
                continue

            if len(data) > MAX_FILE_BYTES:
                oversized.append(item.get('filename') or okey)
                del data
                continue

            tid = item.get('ticket_id')
            folder = f'tickets/{tid}' if tid else 'tickets/_no_ticket'
            name = _safe_name(item.get('filename') or okey.split('/')[-1])
            path = f'{folder}/{name}'
            # Одинаковые имена в одной заявке иначе перезаписали бы друг
            # друга при распаковке.
            if path in used_names:
                used_names[path] += 1
                stem, dot, ext = name.rpartition('.')
                n = used_names[path]
                name = f'{stem}({n}).{ext}' if dot else f'{name}({n})'
                path = f'{folder}/{name}'
            else:
                used_names[path] = 0

            mtime = item.get('created_at') or started
            zf.add(path, data, mtime, compress)
            packed += 1
            raw_bytes += len(data)
            del data

        zf.close()
    except Exception:
        stream.abort()
        raise

    sha256 = stream.finish()
    archive_size = stream.size

    checks = _verify_archive(s3, stream.keys, sha256, packed)
    ok = all(c['ok'] for c in checks)

    result = {
        'success': ok,
        'created_at': started.isoformat(),
        'files_packed': packed,
        'files_total': total_available,
        'raw_bytes': raw_bytes,
        'size_bytes': archive_size,
        'sha256': sha256,
        'checks': checks,
        'compressed': compress,
        'duration_sec': round(
            (datetime.now(timezone.utc) - started).total_seconds(), 1),
    }

    if missing:
        result['missing_count'] = len(missing)
        result['missing_sample'] = missing[:10]
    if oversized:
        result['oversized_count'] = len(oversized)
        result['oversized_sample'] = oversized[:10]

    if truncated:
        # Архив закрыт корректно и пригоден, но содержит не всё.
        result['truncated'] = True
        result['next_skip'] = skip + processed
        result['note'] = (
            f'Время вышло: упаковано {packed} из {len(items)}. '
            f'Архив целый, продолжите выгрузку с позиции {skip + processed}.'
        )

    if not ok:
        stream.abort()
        result['error'] = 'Архив не прошёл проверку целостности и был удалён'
        result['failed_checks'] = [c['name'] for c in checks if not c['ok']]
        return response(500, result)

    base_name = key.split('/')[-1]
    result['parts'] = [
        {
            'filename': f'{base_name}.part{i + 1:03d}',
            'url': s3.generate_presigned_url(
                'get_object',
                Params={'Bucket': 'files', 'Key': vkey},
                ExpiresIn=LINK_TTL_SECONDS,
            ),
        }
        for i, vkey in enumerate(stream.keys)
    ]
    if len(result['parts']) == 1:
        result['download_url'] = result['parts'][0]['url']
    result['expires_in_sec'] = LINK_TTL_SECONDS
    result['filename'] = base_name
    return response(200, result)