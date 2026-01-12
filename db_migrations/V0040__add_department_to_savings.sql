-- Add customer_department_id to savings table
ALTER TABLE t_p61788166_html_to_frontend.savings 
ADD COLUMN customer_department_id INTEGER REFERENCES t_p61788166_html_to_frontend.customer_departments(id);