"""
API для управления push-уведомлениями
"""
import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from pywebpush import webpush, WebPushException

def get_db_connection():
    return psycopg2.connect(os.environ['DATABASE_URL'])

def handler(event: dict, context) -> dict:
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token'
            },
            'body': ''
        }
    
    params = event.get('queryStringParameters') or {}
    endpoint = params.get('endpoint', '')
    
    if method == 'POST' and endpoint == 'subscribe-push':
        return subscribe_push(event)
    elif method == 'POST' and endpoint == 'send-push':
        return send_push_notification(event)
    else:
        return {
            'statusCode': 404,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Endpoint not found'})
        }

def subscribe_push(event: dict):
    """Сохранение подписки пользователя на push-уведомления"""
    data = json.loads(event.get('body', '{}'))
    subscription = data.get('subscription', {})
    user_id = data.get('user_id')
    
    if not user_id or not subscription:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'user_id and subscription required'})
        }
    
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    endpoint = subscription.get('endpoint')
    keys = subscription.get('keys', {})
    p256dh = keys.get('p256dh')
    auth = keys.get('auth')
    
    cur.execute("""
        INSERT INTO t_p61788166_html_to_frontend.push_subscriptions 
        (user_id, endpoint, p256dh, auth)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (user_id, endpoint) 
        DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, updated_at = CURRENT_TIMESTAMP
    """, (user_id, endpoint, p256dh, auth))
    
    conn.commit()
    cur.close()
    conn.close()
    
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'message': 'Subscription saved'})
    }

def send_push_notification(event: dict):
    """Отправка push-уведомления пользователю"""
    data = json.loads(event.get('body', '{}'))
    user_id = data.get('user_id')
    title = data.get('title', 'Новое уведомление')
    body = data.get('body', '')
    url = data.get('url', '/')
    tag = data.get('tag', 'notification')
    
    if not user_id:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'user_id required'})
        }
    
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    cur.execute("""
        SELECT endpoint, p256dh, auth 
        FROM t_p61788166_html_to_frontend.push_subscriptions
        WHERE user_id = %s
    """, (user_id,))
    
    subscriptions = cur.fetchall()
    cur.close()
    conn.close()
    
    if not subscriptions:
        return {
            'statusCode': 404,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'No subscriptions found for user'})
        }
    
    vapid_private_key = os.environ.get('VAPID_PRIVATE_KEY')
    vapid_claims = {
        "sub": "mailto:support@poehali.dev"
    }
    
    payload = json.dumps({
        'title': title,
        'body': body,
        'url': url,
        'tag': tag
    })
    
    sent_count = 0
    for sub in subscriptions:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub['endpoint'],
                    "keys": {
                        "p256dh": sub['p256dh'],
                        "auth": sub['auth']
                    }
                },
                data=payload,
                vapid_private_key=vapid_private_key,
                vapid_claims=vapid_claims
            )
            sent_count += 1
        except WebPushException as e:
            print(f"Error sending push to {sub['endpoint']}: {e}")
    
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'message': f'Sent to {sent_count} devices'})
    }
