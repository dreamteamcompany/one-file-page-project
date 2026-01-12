-- Таблица категорий заявок
CREATE TABLE IF NOT EXISTS ticket_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(50) DEFAULT 'AlertCircle',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица приоритетов заявок
CREATE TABLE IF NOT EXISTS ticket_priorities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    level INTEGER NOT NULL,
    color VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица статусов заявок
CREATE TABLE IF NOT EXISTS ticket_statuses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(50),
    is_closed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица отделов
CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица пользовательских полей для заявок
CREATE TABLE IF NOT EXISTS ticket_custom_fields (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    field_type VARCHAR(50) NOT NULL,
    options TEXT,
    is_required BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Основная таблица заявок
CREATE TABLE IF NOT EXISTS tickets (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    category_id INTEGER REFERENCES ticket_categories(id),
    priority_id INTEGER REFERENCES ticket_priorities(id),
    status_id INTEGER REFERENCES ticket_statuses(id),
    department_id INTEGER REFERENCES departments(id),
    created_by INTEGER NOT NULL,
    assigned_to INTEGER,
    due_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP
);

-- Таблица значений пользовательских полей заявок
CREATE TABLE IF NOT EXISTS ticket_custom_field_values (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER REFERENCES tickets(id),
    field_id INTEGER REFERENCES ticket_custom_fields(id),
    value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица комментариев к заявкам
CREATE TABLE IF NOT EXISTS ticket_comments (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER REFERENCES tickets(id),
    user_id INTEGER NOT NULL,
    comment TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Вставка начальных данных
INSERT INTO ticket_categories (name, description, icon) VALUES
('Техническая проблема', 'Проблемы с оборудованием или ПО', 'Wrench'),
('Доступы', 'Запросы на предоставление доступов', 'Key'),
('Вопрос', 'Общие вопросы и консультации', 'HelpCircle'),
('Заявка на обслуживание', 'Плановое обслуживание', 'Settings');

INSERT INTO ticket_priorities (name, level, color) VALUES
('Низкий', 1, 'gray'),
('Средний', 2, 'blue'),
('Высокий', 3, 'orange'),
('Критический', 4, 'red');

INSERT INTO ticket_statuses (name, color, is_closed) VALUES
('Новая', 'blue', FALSE),
('В работе', 'yellow', FALSE),
('Ожидание', 'orange', FALSE),
('Решена', 'green', TRUE),
('Закрыта', 'gray', TRUE);

INSERT INTO departments (name, description) VALUES
('IT отдел', 'Информационные технологии'),
('HR', 'Управление персоналом'),
('Бухгалтерия', 'Финансы и учет'),
('Администрация', 'Общие вопросы');
