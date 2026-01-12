ALTER TABLE users ADD COLUMN username VARCHAR(100) UNIQUE;

UPDATE users SET username = 'admin' WHERE email = 'admin@example.com';

ALTER TABLE users ALTER COLUMN username SET NOT NULL;

CREATE INDEX idx_users_username ON users(username);