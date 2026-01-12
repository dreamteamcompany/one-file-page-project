CREATE TABLE IF NOT EXISTS "t_p61788166_html_to_frontend"."ticket_service_categories" (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  icon VARCHAR(50) NOT NULL DEFAULT 'Tag',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ticket_service_categories_name ON "t_p61788166_html_to_frontend"."ticket_service_categories"(name);
