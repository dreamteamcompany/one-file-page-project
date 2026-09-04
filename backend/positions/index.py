"""
API для управления должностями
"""
import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from utils import json_dumps


DSN = os.environ.get('DATABASE_URL')


def handler(event: dict, context) -> dict:
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token, X-User-Id, X-Endpoint',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    try:
        conn = psycopg2.connect(DSN)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        query_params = event.get('queryStringParameters') or {}
        pos_id = query_params.get('id')
        
        if method == 'GET':
            if pos_id:
                cur.execute('SELECT * FROM positions WHERE id = %s', (pos_id,))
                position = cur.fetchone()
                if not position:
                    return {
                        'statusCode': 404,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Position not found'}),
                        'isBase64Encoded': False
                    }
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json_dumps(dict(position)),
                    'isBase64Encoded': False
                }
            else:
                cur.execute(
                    'SELECT * FROM positions WHERE is_active = true ORDER BY name'
                )
                positions = [dict(row) for row in cur.fetchall()]
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json_dumps(positions),
                    'isBase64Encoded': False
                }
        
        elif method == 'POST':
            data = json.loads(event.get('body', '{}'))
            cur.execute(
                """
                INSERT INTO positions (name, description)
                VALUES (%s, %s)
                RETURNING *
                """,
                (data.get('name'), data.get('description'))
            )
            position = dict(cur.fetchone())
            conn.commit()
            return {
                'statusCode': 201,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json_dumps(position),
                'isBase64Encoded': False
            }
        
        elif method == 'PUT':
            if not pos_id:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Position ID required'}),
                    'isBase64Encoded': False
                }
            data = json.loads(event.get('body', '{}'))
            cur.execute(
                """
                UPDATE positions
                SET name = %s, description = %s, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
                RETURNING *
                """,
                (data.get('name'), data.get('description'), pos_id)
            )
            position = cur.fetchone()
            if not position:
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Position not found'}),
                    'isBase64Encoded': False
                }
            conn.commit()
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json_dumps(dict(position)),
                'isBase64Encoded': False
            }
        
        elif method == 'DELETE':
            if not pos_id:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Position ID required'}),
                    'isBase64Encoded': False
                }
            cur.execute('UPDATE positions SET is_active = false WHERE id = %s RETURNING id', (pos_id,))
            result = cur.fetchone()
            if not result:
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Position not found'}),
                    'isBase64Encoded': False
                }
            conn.commit()
            return {
                'statusCode': 204,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': '',
                'isBase64Encoded': False
            }
        
        else:
            return {
                'statusCode': 405,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Method not allowed'}),
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
        if 'cur' in locals():
            cur.close()
        if 'conn' in locals():
            conn.close()