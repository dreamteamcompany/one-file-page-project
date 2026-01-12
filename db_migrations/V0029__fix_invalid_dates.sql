-- Fix invalid dates in payments table
UPDATE t_p61788166_html_to_frontend.payments 
SET payment_date = CURRENT_DATE 
WHERE payment_date IS NULL OR CAST(payment_date AS TEXT) LIKE '12222%';

UPDATE t_p61788166_html_to_frontend.payments 
SET invoice_date = NULL 
WHERE invoice_date IS NOT NULL AND CAST(invoice_date AS TEXT) LIKE '12222%';