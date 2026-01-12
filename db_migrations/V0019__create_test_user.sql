INSERT INTO users (username, email, password_hash, full_name, is_active) 
VALUES ('test', 'test@example.com', '$2b$12$rMfNCz.PL4V8LQxZF7YmSeN0VQJmqKI/EYqJQHXZL9c.9mT3Hs5xW', 'Test User', true)
ON CONFLICT (username) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r 
WHERE u.username = 'test' AND r.name = 'Администратор'
ON CONFLICT DO NOTHING;