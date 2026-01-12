-- Создание таблицы для хранения загруженных лог-файлов
CREATE TABLE IF NOT EXISTS log_files (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    file_size INTEGER NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_lines INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'processing'
);

-- Создание таблицы для хранения отдельных записей логов
CREATE TABLE IF NOT EXISTS log_entries (
    id SERIAL PRIMARY KEY,
    file_id INTEGER NOT NULL,
    line_number INTEGER NOT NULL,
    timestamp TIMESTAMP,
    level VARCHAR(20),
    message TEXT NOT NULL,
    raw_line TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_log_entries_file_id ON log_entries(file_id);
CREATE INDEX IF NOT EXISTS idx_log_entries_level ON log_entries(level);
CREATE INDEX IF NOT EXISTS idx_log_entries_timestamp ON log_entries(timestamp);
CREATE INDEX IF NOT EXISTS idx_log_entries_message ON log_entries USING gin(to_tsvector('english', message));

-- Создание таблицы для статистики
CREATE TABLE IF NOT EXISTS log_statistics (
    id SERIAL PRIMARY KEY,
    file_id INTEGER NOT NULL,
    level VARCHAR(20) NOT NULL,
    count INTEGER DEFAULT 0,
    UNIQUE(file_id, level)
);