"""
Автоматическая обработка запланированных платежей по расписанию
Создает реальные платежи из запланированных, когда наступает planned_date
"""
import json
import os
from typing import Any, Dict
from datetime import datetime, timedelta
import psycopg2
from psycopg2.extras import RealDictCursor

DATABASE_URL = os.environ.get('DATABASE_URL')
SCHEMA = 't_p61788166_html_to_frontend'

def get_db_connection():
    """Создание подключения к БД"""
    return psycopg2.connect(DATABASE_URL)

def process_scheduled_payments() -> Dict[str, Any]:
    """Обработка всех запланированных платежей, которые должны быть созданы"""
    conn = get_db_connection()
    processed_count = 0
    created_payments = []
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Получаем все активные запланированные платежи, у которых planned_date <= сегодня
            cur.execute(f"""
                SELECT * FROM {SCHEMA}.planned_payments
                WHERE is_active = true
                AND planned_date <= NOW()
                AND converted_to_payment_id IS NULL
                ORDER BY planned_date ASC
            """)
            
            planned_payments = cur.fetchall()
            
            for planned in planned_payments:
                try:
                    # Создаём обычный платёж
                    cur.execute(f"""
                        INSERT INTO {SCHEMA}.payments 
                        (category_id, amount, description, payment_date, legal_entity_id,
                         contractor_id, department_id, service_id, invoice_number, invoice_date,
                         status, created_by, created_at, category)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'draft', %s, NOW(), 
                                (SELECT name FROM {SCHEMA}.categories WHERE id = %s))
                        RETURNING id
                    """, (
                        planned['category_id'],
                        planned['amount'],
                        planned['description'],
                        planned['planned_date'],
                        planned['legal_entity_id'],
                        planned['contractor_id'],
                        planned['department_id'],
                        planned['service_id'],
                        planned['invoice_number'],
                        planned['invoice_date'],
                        planned['created_by'],
                        planned['category_id']
                    ))
                    
                    new_payment_id = cur.fetchone()['id']
                    
                    # Копируем кастомные поля
                    cur.execute(f"""
                        INSERT INTO {SCHEMA}.payment_custom_field_values (payment_id, custom_field_id, value)
                        SELECT %s, custom_field_id, value
                        FROM {SCHEMA}.planned_payment_custom_field_values
                        WHERE planned_payment_id = %s
                    """, (new_payment_id, planned['id']))
                    
                    # Обрабатываем повторяющиеся платежи
                    recurrence_type = planned['recurrence_type']
                    
                    if recurrence_type and recurrence_type != 'once':
                        # Вычисляем следующую дату
                        current_date = planned['planned_date']
                        next_date = None
                        
                        if recurrence_type == 'daily':
                            next_date = current_date + timedelta(days=1)
                        elif recurrence_type == 'weekly':
                            next_date = current_date + timedelta(weeks=1)
                        elif recurrence_type == 'monthly':
                            # Прибавляем месяц (приблизительно 30 дней)
                            next_date = current_date + timedelta(days=30)
                        elif recurrence_type == 'yearly':
                            next_date = current_date + timedelta(days=365)
                        
                        # Проверяем, не закончился ли период повторения
                        recurrence_end = planned['recurrence_end_date']
                        if next_date and (not recurrence_end or next_date <= recurrence_end):
                            # Обновляем дату следующего запуска
                            cur.execute(f"""
                                UPDATE {SCHEMA}.planned_payments 
                                SET planned_date = %s,
                                    converted_to_payment_id = NULL,
                                    converted_at = NULL
                                WHERE id = %s
                            """, (next_date, planned['id']))
                        else:
                            # Период повторения закончился, помечаем как конвертированный
                            cur.execute(f"""
                                UPDATE {SCHEMA}.planned_payments 
                                SET converted_to_payment_id = %s,
                                    converted_at = NOW(),
                                    is_active = false
                                WHERE id = %s
                            """, (new_payment_id, planned['id']))
                    else:
                        # Одноразовый платёж, помечаем как конвертированный
                        cur.execute(f"""
                            UPDATE {SCHEMA}.planned_payments 
                            SET converted_to_payment_id = %s,
                                converted_at = NOW()
                            WHERE id = %s
                        """, (new_payment_id, planned['id']))
                    
                    processed_count += 1
                    created_payments.append({
                        'planned_payment_id': planned['id'],
                        'new_payment_id': new_payment_id,
                        'description': planned['description'],
                        'amount': float(planned['amount']),
                        'recurrence_type': recurrence_type
                    })
                    
                except Exception as e:
                    # Логируем ошибку, но продолжаем обработку остальных
                    print(f"Error processing planned payment {planned['id']}: {str(e)}")
                    continue
            
            conn.commit()
            
            return {
                'success': True,
                'processed_count': processed_count,
                'created_payments': created_payments,
                'timestamp': datetime.now().isoformat()
            }
            
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Главный обработчик (может вызываться по расписанию или вручную)"""
    method = event.get('httpMethod', 'GET')
    
    # CORS preflight
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    try:
        result = process_scheduled_payments()
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(result, default=str),
            'isBase64Encoded': False
        }
    
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }
