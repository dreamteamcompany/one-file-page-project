import json

def handler(event: dict, context) -> dict:
    """Тестовая функция для проверки деплоя"""
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
        'body': json.dumps({'status': 'ok', 'version': '1.0.0'}),
        'isBase64Encoded': False
    }
