-- Пользователи и роли
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id INTEGER REFERENCES users(id),
    role_id INTEGER REFERENCES roles(id),
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INTEGER REFERENCES roles(id),
    permission_id INTEGER REFERENCES permissions(id),
    PRIMARY KEY (role_id, permission_id)
);

-- Категории заявок
CREATE TABLE IF NOT EXISTS ticket_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(50) DEFAULT 'Tag',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Приоритеты
CREATE TABLE IF NOT EXISTS ticket_priorities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    level INTEGER NOT NULL,
    color VARCHAR(20) DEFAULT '#6b7280',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Статусы
CREATE TABLE IF NOT EXISTS ticket_statuses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(20) DEFAULT '#3b82f6',
    is_closed BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Отделы
CREATE TABLE IF NOT EXISTS customer_departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Кастомные поля
CREATE TABLE IF NOT EXISTS custom_fields (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    field_type VARCHAR(50) NOT NULL,
    options TEXT,
    is_required BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Категории услуг
CREATE TABLE IF NOT EXISTS service_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(50) DEFAULT 'Tag',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Сервисы
CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category_id INTEGER REFERENCES service_categories(id),
    intermediate_approver_id INTEGER REFERENCES users(id),
    final_approver_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Связь сервисов с услугами
CREATE TABLE IF NOT EXISTS service_service_links (
    service_id INTEGER REFERENCES services(id),
    linked_service_id INTEGER REFERENCES services(id),
    PRIMARY KEY (service_id, linked_service_id)
);

-- Заявки
CREATE TABLE IF NOT EXISTS tickets (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    category_id INTEGER REFERENCES ticket_categories(id),
    priority_id INTEGER REFERENCES ticket_priorities(id),
    status_id INTEGER REFERENCES ticket_statuses(id),
    department_id INTEGER REFERENCES customer_departments(id),
    service_id INTEGER REFERENCES services(id),
    created_by INTEGER REFERENCES users(id),
    assigned_to INTEGER REFERENCES users(id),
    due_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP
);

-- Значения кастомных полей для заявок
CREATE TABLE IF NOT EXISTS ticket_custom_field_values (
    ticket_id INTEGER REFERENCES tickets(id),
    custom_field_id INTEGER REFERENCES custom_fields(id),
    value TEXT,
    PRIMARY KEY (ticket_id, custom_field_id)
);

-- Комментарии к заявкам
CREATE TABLE IF NOT EXISTS ticket_comments (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER REFERENCES tickets(id),
    user_id INTEGER REFERENCES users(id),
    comment TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- История изменений заявок
CREATE TABLE IF NOT EXISTS ticket_history (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER REFERENCES tickets(id),
    user_id INTEGER REFERENCES users(id),
    field_name VARCHAR(100),
    old_value TEXT,
    new_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Контрагенты
CREATE TABLE IF NOT EXISTS contractors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    inn VARCHAR(20),
    kpp VARCHAR(20),
    contact_person VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Юридические лица
CREATE TABLE IF NOT EXISTS legal_entities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    inn VARCHAR(20),
    kpp VARCHAR(20),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Платежи
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER REFERENCES tickets(id),
    contractor_id INTEGER REFERENCES contractors(id),
    legal_entity_id INTEGER REFERENCES legal_entities(id),
    amount NUMERIC(15, 2) NOT NULL,
    payment_date DATE,
    status VARCHAR(50) DEFAULT 'Запланирован',
    payment_type VARCHAR(100),
    description TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Уведомления
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    message TEXT,
    type VARCHAR(50) DEFAULT 'info',
    is_read BOOLEAN DEFAULT false,
    link VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Начальные данные
INSERT INTO roles (name, description) VALUES 
    ('Администратор', 'Полный доступ ко всем функциям системы'),
    ('Менеджер', 'Управление заявками и платежами'),
    ('Пользователь', 'Базовый доступ к системе')
ON CONFLICT (name) DO NOTHING;

INSERT INTO ticket_priorities (name, level, color) VALUES 
    ('Низкий', 1, '#6b7280'),
    ('Средний', 2, '#3b82f6'),
    ('Высокий', 3, '#f97316'),
    ('Критический', 4, '#ef4444');

INSERT INTO ticket_statuses (name, color, is_closed) VALUES 
    ('Новая', '#3b82f6', false),
    ('В работе', '#eab308', false),
    ('Ожидание', '#f97316', false),
    ('Решена', '#22c55e', true),
    ('Закрыта', '#6b7280', true);

-- Создание администратора (пароль: admin)
INSERT INTO users (username, email, password_hash, full_name, is_active)
VALUES ('admin', 'admin@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYzpLUJ8p.W', 'Администратор', true)
ON CONFLICT (username) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r 
WHERE u.username = 'admin' AND r.name = 'Администратор'
ON CONFLICT DO NOTHING;