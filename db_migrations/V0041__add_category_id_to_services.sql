ALTER TABLE t_p61788166_html_to_frontend.services 
ADD COLUMN category_id INTEGER REFERENCES t_p61788166_html_to_frontend.categories(id);