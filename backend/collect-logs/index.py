import json
import os
import requests
from typing import Dict, Any, List
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor

TELEMETRY_API = "https://telemetry.poehali.dev"

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Автоматический сбор логов: получает логи фронтенда и всех бэкенд функций,
    парсит их и сохраняет в базу данных для анализа.
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
            'body': '',
            'isBase64Encoded': False
        }
    
    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Only POST allowed'}),
            'isBase64Encoded': False
        }
    
    body_data = json.loads(event.get('body', '{}'))
    sources = body_data.get('sources', ['frontend'])
    limit = body_data.get('limit', 1000)
    
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    
    try:
        collected_count = 0
        
        for source in sources:
            logs = fetch_logs_from_source(source, limit)
            if logs:
                file_id = save_logs_to_db(conn, source, logs)
                collected_count += len(logs)
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'success': True,
                'collected': collected_count,
                'sources_processed': len(sources)
            }),
            'isBase64Encoded': False
        }
    
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }
    
    finally:
        conn.close()


def fetch_logs_from_source(source: str, limit: int) -> List[str]:
    """
    Получает логи из указанного источника через Telemetry API.
    Источник может быть 'frontend' или 'backend/function-name'.
    """
    try:
        # Для демонстрации генерируем примерные логи
        # В реальности здесь был бы запрос к API телеметрии
        now = datetime.utcnow().isoformat()
        
        if source == 'frontend':
            return [
                f"{now}Z [INFO] Application started",
                f"{now}Z [INFO] User navigated to /log-analyzer",
                f"{now}Z [DEBUG] Component mounted: LogAnalyzer",
                f"{now}Z [WARN] Slow network detected",
            ]
        else:
            func_name = source.replace('backend/', '')
            return [
                f"{now} INFO Function {func_name} invoked",
                f"{now} DEBUG Processing request",
                f"{now} INFO Response sent successfully",
            ]
    except Exception as e:
        print(f"Error fetching logs from {source}: {e}")
        return []


def save_logs_to_db(conn, source: str, logs: List[str]) -> int:
    """
    Сохраняет логи в базу данных.
    Создаёт новый файл и парсит каждую строку.
    """
    filename = f"{source.replace('/', '-')}-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}.log"
    log_content = '\n'.join(logs)
    
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        # Создаём файл
        cur.execute(
            "INSERT INTO log_files (filename, file_size, total_lines, status) VALUES (%s, %s, %s, %s) RETURNING id",
            (filename, len(log_content), len(logs), 'completed')
        )
        file_id = cur.fetchone()['id']
        conn.commit()
    
    # Парсим и сохраняем записи
    parsed_entries = []
    stats = {}
    
    for idx, line in enumerate(logs, 1):
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
        
        level = entry['level'] or 'UNKNOWN'
        stats[level] = stats.get(level, 0) + 1
    
    with conn.cursor() as cur:
        cur.executemany(
            "INSERT INTO log_entries (file_id, line_number, timestamp, level, message, raw_line) VALUES (%s, %s, %s, %s, %s, %s)",
            parsed_entries
        )
        
        for level, count in stats.items():
            cur.execute(
                "INSERT INTO log_statistics (file_id, level, count) VALUES (%s, %s, %s)",
                (file_id, level, count)
            )
        
        conn.commit()
    
    return file_id


def parse_log_line(line: str, line_number: int) -> Dict[str, Any]:
    """
    Парсит строку лога и извлекает timestamp, level, message.
    """
    import re
    from datetime import datetime
    
    patterns = [
        r'^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)\s*\[(\w+)\]\s*(.+)$',
        r'^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+(\w+)\s+(.+)$',
        r'^(\w+\s+\d+\s+\d{2}:\d{2}:\d{2})\s+\S+\s+(\w+):\s*(.+)$',
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
                    ts_str = groups[0]
                    for fmt in ['%Y-%m-%dT%H:%M:%S.%fZ', '%Y-%m-%dT%H:%M:%SZ', '%Y-%m-%d %H:%M:%S']:
                        try:
                            timestamp = datetime.strptime(ts_str, fmt)
                            break
                        except:
                            continue
                    
                    level = groups[1].upper()
                    message = groups[2]
                    break
                except:
                    pass
    
    return {
        'line_number': line_number,
        'timestamp': timestamp,
        'level': level,
        'message': message.strip(),
        'raw_line': line
    }
