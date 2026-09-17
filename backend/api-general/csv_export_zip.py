"""Сборка ZIP-архива по частям, с перерывами между вызовами функции.

Зачем не обычный zipfile: облачная функция живёт около минуты, а выгрузка
всей базы занимает минуты. Значит работа идёт эстафетой — несколько
вызовов подряд, и каждый следующий обязан дописывать архив ровно там,
где остановился предыдущий. Держать открытым объект zipfile между
вызовами нельзя: у них общая только запись в базе.

Поэтому ZIP собирается вручную из его составных частей:
- локальный заголовок файла пишется, когда таблица начинается;
- данные идут сжатыми кусками (deflate); каждый вызов жмёт своим
  компрессором и заканчивает кусок «выравниванием» Z_SYNC_FLUSH —
  после него поток продолжается с целого байта, поэтому куски от разных
  вызовов просто склеиваются встык;
- контрольная сумма и размеры копятся по ходу и пишутся в конце файла
  (дескриптор данных) — их нельзя знать заранее при потоковой записи;
- в самом конце дописывается оглавление архива.

Формат при этом обычный: архив открывается любым проводником и
распаковщиком без дополнительных условий.
"""
import struct
import zlib
from typing import Any, Dict, List, Tuple

# Подписи блоков формата ZIP.
SIG_LOCAL = 0x04034B50
SIG_DATA_DESCRIPTOR = 0x08074B50
SIG_CENTRAL = 0x02014B50
SIG_EOCD = 0x06054B50

METHOD_DEFLATE = 8
# Бит 3: размеры и контрольная сумма идут ПОСЛЕ данных (потоковая запись).
# Бит 11: имена файлов в UTF-8 — иначе русские имена откроются кракозябрами.
FLAG_STREAMING_UTF8 = 0x08 | 0x800
VERSION_NEEDED = 20

# Конец deflate-потока: пустой финальный блок.
DEFLATE_TAIL = b'\x03\x00'


def _dos_datetime() -> Tuple[int, int]:
    """Дата и время для записи архива.

    Ставим фиксированное значение: точное время файла внутри архива роли
    не играет, а так результат не зависит от того, в каком вызове собралась
    очередная часть.
    """
    date = ((2026 - 1980) << 9) | (1 << 5) | 1
    time_ = 0
    return time_, date


def local_header(name: str) -> bytes:
    """Заголовок перед данными файла внутри архива."""
    raw = name.encode('utf-8')
    time_, date = _dos_datetime()
    return struct.pack(
        '<IHHHHHIIIHH',
        SIG_LOCAL, VERSION_NEEDED, FLAG_STREAMING_UTF8, METHOD_DEFLATE,
        time_, date,
        0, 0, 0,  # crc и размеры — в дескрипторе после данных
        len(raw), 0,
    ) + raw


def data_descriptor(crc: int, csize: int, usize: int) -> bytes:
    """Контрольная сумма и размеры, записываемые после данных файла."""
    return struct.pack('<IIII', SIG_DATA_DESCRIPTOR, crc, csize, usize)


def compress_chunk(data: bytes, level: int = 6) -> bytes:
    """Сжать кусок так, чтобы следующий кусок можно было дописать встык."""
    compressor = zlib.compressobj(level, zlib.DEFLATED, -15)
    return compressor.compress(data) + compressor.flush(zlib.Z_SYNC_FLUSH)


def central_directory(members: List[Dict[str, Any]]) -> bytes:
    """Оглавление архива: по записи на каждый файл плюс завершающий блок."""
    time_, date = _dos_datetime()
    out = bytearray()
    for m in members:
        raw = m['name'].encode('utf-8')
        out += struct.pack(
            '<IHHHHHHIIIHHHHHII',
            SIG_CENTRAL, VERSION_NEEDED, VERSION_NEEDED, FLAG_STREAMING_UTF8,
            METHOD_DEFLATE, time_, date,
            m['crc'], m['csize'], m['usize'],
            len(raw), 0, 0, 0, 0, 0,
            m['hoff'],
        ) + raw
    return bytes(out)


def end_of_central_directory(count: int, cd_size: int, cd_offset: int) -> bytes:
    return struct.pack(
        '<IHHHHIIH',
        SIG_EOCD, 0, 0, count, count, cd_size, cd_offset, 0,
    )


def crc_update(previous: int, data: bytes) -> int:
    return zlib.crc32(data, previous)
