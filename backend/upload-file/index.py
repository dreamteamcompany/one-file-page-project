import json
import os
import sys
import base64
import uuid
import re
import boto3

def log(msg):
    print(msg, file=sys.stderr, flush=True)


CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Authorization, X-Auth-Token, X-User-Id, X-Session-Id, X-Endpoint',
    'Access-Control-Max-Age': '86400',
}


def _resp(status, payload):
    return {
        'statusCode': status,
        'headers': {**CORS_HEADERS, 'Content-Type': 'application/json'},
        'body': json.dumps(payload),
    }


def _safe_filename(name: str) -> str:
    name = (name or 'file').strip().replace('\\', '/').split('/')[-1]
    name = re.sub(r'[^A-Za-z0-9._\-\u0400-\u04FF ]+', '_', name)
    return name[:200] or 'file'


def _ext_and_ctype(filename: str, fallback_ctype: str = 'application/octet-stream'):
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    image_types = {
        'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
        'gif': 'image/gif', 'webp': 'image/webp', 'svg': 'image/svg+xml',
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'ppt': 'application/vnd.ms-powerpoint',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'txt': 'text/plain', 'csv': 'text/csv',
        'zip': 'application/zip', 'rar': 'application/vnd.rar', '7z': 'application/x-7z-compressed',
        'mp4': 'video/mp4', 'mov': 'video/quicktime', 'avi': 'video/x-msvideo',
        'mp3': 'audio/mpeg', 'wav': 'audio/wav',
    }
    ctype = image_types.get(ext, fallback_ctype)
    return ext, ctype


def _s3_client():
    return boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
    )


def _build_cdn_url(s3_key: str) -> str:
    return f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{s3_key}"


def handler(event, context):
    '''Загрузка файлов в S3-хранилище: base64-инлайн или pre-signed URL'''
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    if method != 'POST':
        return _resp(405, {'error': 'Method not allowed'})

    try:
        body = json.loads(event.get('body', '{}') or '{}')
    except Exception:
        return _resp(400, {'error': 'Invalid JSON'})

    action = (body.get('action') or '').lower()

    try:
        if action == 'presign':
            return _handle_presign(body)
        return _handle_inline_upload(body)
    except Exception as e:
        log(f"Upload error: {str(e)}")
        return _resp(500, {'error': str(e)})


def _handle_presign(body):
    '''Генерирует pre-signed URL для прямой загрузки в S3 (без лимита размера тела функции)'''
    filename = _safe_filename(body.get('filename') or 'file')
    content_type = body.get('content_type') or ''
    folder = (body.get('folder') or 'uploads/attachments').strip('/').replace('..', '')

    ext, ctype_guess = _ext_and_ctype(filename)
    if not content_type:
        content_type = ctype_guess

    unique_name = f"{uuid.uuid4().hex}{('.' + ext) if ext else ''}"
    s3_key = f"{folder}/{unique_name}"

    s3 = _s3_client()
    presigned_url = s3.generate_presigned_url(
        ClientMethod='put_object',
        Params={
            'Bucket': 'files',
            'Key': s3_key,
        },
        ExpiresIn=3600,
        HttpMethod='PUT',
    )

    cdn_url = _build_cdn_url(s3_key)
    log(f"Presigned PUT generated for {s3_key}")
    return _resp(200, {
        'upload_url': presigned_url,
        'method': 'PUT',
        'headers': {},
        'cdn_url': cdn_url,
        'key': s3_key,
        'filename': filename,
        'content_type': content_type,
    })


def _handle_inline_upload(body):
    '''Старый flow: файл в base64 в теле запроса. Для маленьких файлов / аватаров.'''
    file_data = body.get('file')
    filename = _safe_filename(body.get('filename') or 'file')
    folder = (body.get('folder') or 'uploads/photos').strip('/').replace('..', '')

    if not file_data:
        return _resp(400, {'error': 'No file data'})

    file_bytes = base64.b64decode(file_data)
    ext, content_type = _ext_and_ctype(filename, fallback_ctype='application/octet-stream')

    unique_name = f"{uuid.uuid4().hex}{('.' + ext) if ext else ''}"
    s3_key = f"{folder}/{unique_name}"

    s3 = _s3_client()
    s3.put_object(
        Bucket='files',
        Key=s3_key,
        Body=file_bytes,
        ContentType=content_type,
    )

    cdn_url = _build_cdn_url(s3_key)
    log(f"File uploaded: {s3_key}, size: {len(file_bytes)} bytes")
    return _resp(200, {
        'url': cdn_url,
        'cdn_url': cdn_url,
        'key': s3_key,
        'filename': filename,
        'content_type': content_type,
        'size': len(file_bytes),
    })