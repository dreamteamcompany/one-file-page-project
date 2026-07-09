CREATE TABLE IF NOT EXISTS user_subordinate_departments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    department_id INTEGER NOT NULL REFERENCES departments(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, department_id)
);

CREATE INDEX IF NOT EXISTS idx_user_sub_dep_user ON user_subordinate_departments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sub_dep_dep ON user_subordinate_departments(department_id);

CREATE TABLE IF NOT EXISTS user_subordinates (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    subordinate_user_id INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, subordinate_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_sub_user ON user_subordinates(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sub_sub ON user_subordinates(subordinate_user_id);