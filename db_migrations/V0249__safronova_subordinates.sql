INSERT INTO user_subordinates (user_id, subordinate_user_id)
SELECT 238, sub_id FROM (VALUES
  (245),(243),(244),(242),(241),(240),
  (239),(189),
  (237),(236),(235),(230),(229),(228),
  (141),(226),(225),(224),(223),(222),(221),(220),(219),(218),(217),(216),(215),(85),(214),
  (213),(183),
  (212),(211),(210),(209),(207),(206),(205),(204)
) AS t(sub_id)
WHERE sub_id <> 238
ON CONFLICT (user_id, subordinate_user_id) DO NOTHING;