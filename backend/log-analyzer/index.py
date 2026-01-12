import json
import os
import re
import base64
from datetime import datetime
from typing import Dict, Any, List, Optional
import psycopg2
from psycopg2.extras import RealDictCursor

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Анализатор логов: загружает файлы логов, парсит их и сохраняет в базу данных.
    Поддерживает загрузку файлов, получение статистики и поиск по логам.
    """
    method: str = event.get('httpMethod', 'GET')
    
    # CORS OPTIONS
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    # Подключение к БД
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    
    try:
        if method == 'POST':
            # Загрузка и парсинг лог-файла
            body_data = json.loads(event.get('body', '{}'))
            
            if 'file_content' not in body_data or 'filename' not in body_data:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'file_content и filename обязательны'})
                }
            
            # Декодируем base64 контент
            file_content = base64.b64decode(body_data['file_content']).decode('utf-8')
            filename = body_data['filename']
            
            # Создаём запись о файле
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    "INSERT INTO log_files (filename, file_size, total_lines, status) VALUES (%s, %s, %s, %s) RETURNING id",
                    (filename, len(file_content), file_content.count('\n'), 'processing')
                )
                file_id = cur.fetchone()['id']
                conn.commit()
            
            # Парсим логи
            lines = file_content.split('\n')
            parsed_entries = []
            stats = {}
            
            for idx, line in enumerate(lines, 1):
                if not line.strip():
                    continue
                
                entry = parse_log_line(line, idx)
                parsed_entries.append((
                    file_id,
                    entry['line_number'],
                    entry['timestamp'],
                    entry['level'],
                    entry['message'],
                    entry['raw_line']
                ))
                
                # Статистика
                level = entry['level'] or 'UNKNOWN'
                stats[level] = stats.get(level, 0) + 1
            
            # Сохраняем записи логов
            with conn.cursor() as cur:
                cur.executemany(
                    "INSERT INTO log_entries (file_id, line_number, timestamp, level, message, raw_line) VALUES (%s, %s, %s, %s, %s, %s)",
                    parsed_entries
                )
                
                # Сохраняем статистику
                for level, count in stats.items():
                    cur.execute(
                        "INSERT INTO log_statistics (file_id, level, count) VALUES (%s, %s, %s)",
                        (file_id, level, count)
                    )
                
                # Обновляем статус файла
                cur.execute(
                    "UPDATE log_files SET status = %s WHERE id = %s",
                    ('completed', file_id)
                )
                conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'file_id': file_id,
                    'total_lines': len(parsed_entries),
                    'statistics': stats
                })
            }
        
        elif method == 'GET':
            params = event.get('queryStringParameters') or {}
            action = params.get('action', 'list')
            
            if action == 'list':
                # Список всех файлов
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute("""
                        SELECT lf.*, 
                               COALESCE(json_agg(
                                   json_build_object('level', ls.level, 'count', ls.count)
                               ) FILTER (WHERE ls.id IS NOT NULL), '[]') as statistics
                        FROM log_files lf
                        LEFT JOIN log_statistics ls ON lf.id = ls.file_id
                        GROUP BY lf.id
                        ORDER BY lf.uploaded_at DESC
                    """)
                    files = cur.fetchall()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps([dict(f) for f in files], default=str)
                }
            
            elif action == 'entries':
                # Получить записи из конкретного файла
                file_id = params.get('file_id')
                level_filter = params.get('level')
                search = params.get('search')
                limit = int(params.get('limit', 100))
                offset = int(params.get('offset', 0))
                
                query = "SELECT * FROM log_entries WHERE file_id = %s"
                query_params = [file_id]
                
                if level_filter:
                    query += " AND level = %s"
                    query_params.append(level_filter)
                
                if search:
                    query += " AND message ILIKE %s"
                    query_params.append(f'%{search}%')
                
                query += " ORDER BY line_number LIMIT %s OFFSET %s"
                query_params.extend([limit, offset])
                
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(query, query_params)
                    entries = cur.fetchall()
                    
                    # Получаем общее количество
                    count_query = f"SELECT COUNT(*) as total FROM log_entries WHERE file_id = %s"
                    count_params = [file_id]
                    if level_filter:
                        count_query += " AND level = %s"
                        count_params.append(level_filter)
                    if search:
                        count_query += " AND message ILIKE %s"
                        count_params.append(f'%{search}%')
                    
                    cur.execute(count_query, count_params)
                    total = cur.fetchone()['total']
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        'entries': [dict(e) for e in entries],
                        'total': total,
                        'limit': limit,
                        'offset': offset
                    }, default=str)
                }
            
            elif action == 'stats':
                # Статистика по файлу
                file_id = params.get('file_id')
                
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(
                        "SELECT level, count FROM log_statistics WHERE file_id = %s",
                        (file_id,)
                    )
                    stats = cur.fetchall()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps([dict(s) for s in stats])
                }
        
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    finally:
        conn.close()


def parse_log_line(line: str, line_number: int) -> Dict[str, Any]:
    """
    Парсит строку лога и извлекает timestamp, level, message.
    Поддерживает различные форматы логов.
    """
    # Паттерны для парсинга
    patterns = [
        # ISO timestamp with level: 2024-01-15T10:30:45.123Z [ERROR] Message
        r'^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)\s*\[(\w+)\]\s*(.+)$',
        # Standard format: 2024-01-15 10:30:45 ERROR Message
        r'^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+(\w+)\s+(.+)$',
        # Syslog format: Jan 15 10:30:45 hostname ERROR: Message
        r'^(\w+\s+\d+\s+\d{2}:\d{2}:\d{2})\s+\S+\s+(\w+):\s*(.+)$',
        # Level first: ERROR: 2024-01-15 Message
        r'^(\w+):\s*(\d{4}-\d{2}-\d{2})\s+(.+)$',
        # Just level: ERROR Message
        r'^(\w+)\s+(.+)$'
    ]
    
    timestamp = None
    level = None
    message = line
    
    for pattern in patterns:
        match = re.match(pattern, line)
        if match:
            groups = match.groups()
            if len(groups) == 3:
                try:
                    timestamp = parse_timestamp(groups[0])
                    level = groups[1].upper()
                    message = groups[2]
                except:
                    pass
            elif len(groups) == 2:
                level = groups[0].upper() if groups[0].upper() in ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE', 'FATAL'] else None
                message = groups[1] if level else line
            
            if level or timestamp:
                break
    
    return {
        'line_number': line_number,
        'timestamp': timestamp,
        'level': level,
        'message': message.strip(),
        'raw_line': line
    }


def parse_timestamp(ts_str: str) -> Optional[datetime]:
    """Пытается распарсить различные форматы timestamp"""
    formats = [
        '%Y-%m-%dT%H:%M:%S.%fZ',
        '%Y-%m-%dT%H:%M:%SZ',
        '%Y-%m-%d %H:%M:%S',
        '%Y-%m-%d',
        '%b %d %H:%M:%S'
    ]
    
    for fmt in formats:
        try:
            return datetime.strptime(ts_str, fmt)
        except:
            continue
    
    return None
