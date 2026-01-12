-- Update ticket priorities colors to hex format
UPDATE t_p61788166_html_to_frontend.ticket_priorities SET color = CASE 
  WHEN level = 1 THEN '#6b7280'
  WHEN level = 2 THEN '#3b82f6'
  WHEN level = 3 THEN '#f97316'
  WHEN level = 4 THEN '#ef4444'
END;