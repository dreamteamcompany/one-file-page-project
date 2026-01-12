-- Update ticket statuses colors to hex format
UPDATE t_p61788166_html_to_frontend.ticket_statuses SET color = CASE 
  WHEN id = 1 THEN '#3b82f6'
  WHEN id = 2 THEN '#eab308'
  WHEN id = 3 THEN '#f97316'
  WHEN id = 4 THEN '#22c55e'
  WHEN id = 5 THEN '#6b7280'
END;