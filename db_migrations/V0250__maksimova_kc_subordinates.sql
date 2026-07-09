INSERT INTO user_subordinates (user_id, subordinate_user_id)
SELECT 6, sub_id FROM (VALUES
  (171),(163),(259),(198),(75),(191),(267),(89),(111),(165),
  (71),(158),(197),(354),(196),(190),(179),(174),(117),(120),
  (233),(350),(199),(263),(281),(91)
) AS t(sub_id)
WHERE sub_id <> 6
ON CONFLICT (user_id, subordinate_user_id) DO NOTHING;