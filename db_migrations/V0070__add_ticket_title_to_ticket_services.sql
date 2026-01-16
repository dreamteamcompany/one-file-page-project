-- Add ticket_title column to ticket_services table
ALTER TABLE ticket_services 
ADD COLUMN ticket_title VARCHAR(500);

COMMENT ON COLUMN ticket_services.ticket_title IS 'Автоматическое название заявки при создании';