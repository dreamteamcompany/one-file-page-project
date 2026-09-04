"""
API для управления компаниями организации
"""
import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from utils import json_dumps


DSN = os.environ.get('DATABASE_URL')


def handler(event: dict, context) -> dict:
    method = event.get('httpMethod', 'GET')
    print(f"[DEBUG] method={method}, url={event.get('url')}, pathParams={event.get('pathParams')}")
    
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
        company_id = query_params.get('id')
        
        if method == 'GET':
            if company_id:
                cur.execute(
                    'SELECT * FROM companies WHERE id = %s',
                    (company_id,)
                )
                company = cur.fetchone()
                if not company:
                    return {
                        'statusCode': 404,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Company not found'}),
                        'isBase64Encoded': False
                    }
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json_dumps(dict(company)),
                    'isBase64Encoded': False
                }
            else:
                cur.execute(
                    'SELECT * FROM companies WHERE is_active = true ORDER BY name'
                )
                companies = [dict(row) for row in cur.fetchall()]
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json_dumps(companies),
                    'isBase64Encoded': False
                }
        
        elif method == 'POST':
            data = json.loads(event.get('body', '{}'))
            cur.execute(
                """
                INSERT INTO companies (name, inn, kpp, legal_address)
                VALUES (%s, %s, %s, %s)
                RETURNING *
                """,
                (data.get('name'), data.get('inn'), data.get('kpp'), data.get('legal_address'))
            )
            company = dict(cur.fetchone())
            conn.commit()
            return {
                'statusCode': 201,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json_dumps(company),
                'isBase64Encoded': False
            }
        
        elif method == 'PUT':
            if not company_id:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Company ID required'}),
                    'isBase64Encoded': False
                }
            data = json.loads(event.get('body', '{}'))
            cur.execute(
                """
                UPDATE companies
                SET name = %s, inn = %s, kpp = %s, legal_address = %s, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
                RETURNING *
                """,
                (data.get('name'), data.get('inn'), data.get('kpp'), data.get('legal_address'), company_id)
            )
            company = cur.fetchone()
            if not company:
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Company not found'}),
                    'isBase64Encoded': False
                }
            conn.commit()
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json_dumps(dict(company)),
                'isBase64Encoded': False
            }
        
        elif method == 'DELETE':
            if not company_id:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Company ID required'}),
                    'isBase64Encoded': False
                }
            cur.execute('UPDATE companies SET is_active = false WHERE id = %s RETURNING id', (company_id,))
            result = cur.fetchone()
            if not result:
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Company not found'}),
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