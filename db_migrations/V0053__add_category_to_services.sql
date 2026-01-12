ALTER TABLE "t_p61788166_html_to_frontend"."services" 
ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES "t_p61788166_html_to_frontend"."ticket_service_categories"(id);

CREATE INDEX IF NOT EXISTS idx_services_category_id ON "t_p61788166_html_to_frontend"."services"(category_id);
