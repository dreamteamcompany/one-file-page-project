"""
Сервис HTTP - формирование HTTP ответов
Single Responsibility: только HTTP ответы
"""
import json
from typing import Dict, Any


def http_response(status: int, data: dict) -> Dict[str, Any]:
    """Создать стандартизированный HTTP ответ"""
    return {
        'statusCode': status,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token, X-User-Id, X-Endpoint, Authorization'
        },
        'body': json.dumps(data, ensure_ascii=False, default=str)
    }


def format_service_response(result: Dict[str, Any]) -> Dict[str, Any]:
    """Преобразовать ответ сервиса в HTTP ответ"""
    if 'error' in result:
        return http_response(result.get('status', 500), {'error': result['error']})
    
    return http_response(result.get('status', 200), result.get('data', {}))
