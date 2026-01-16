-- Добавляем поле has_response в таблицу tickets
ALTER TABLE t_p67567221_one_file_page_projec.tickets 
ADD COLUMN has_response BOOLEAN DEFAULT FALSE;