INSERT INTO t_p67567221_one_file_page_projec.ticket_watchers (ticket_id, user_id)
SELECT t.id, 411
FROM (VALUES
 (7243),(7247),(7474),(7643),(8160),(8390),(8445),(8455),(10073),(8790),
 (8828),(8831),(8864),(10074),(8868),(10036),(10118),(10121),(10259),(10370),
 (10666),(10673),(10710),(10747),(10771),(10818),(11053),(11125),(11271),(11304),
 (11641),(11655),(11656),(11792),(11815),(12222),(12571),(12918),(12950),(13135),
 (13173),(13214)
) AS t(id)
WHERE NOT EXISTS (
  SELECT 1 FROM t_p67567221_one_file_page_projec.ticket_watchers w
  WHERE w.ticket_id = t.id AND w.user_id = 411
);