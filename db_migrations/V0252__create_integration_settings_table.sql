CREATE TABLE IF NOT EXISTS integration_settings (
    key VARCHAR(100) PRIMARY KEY,
    value_encrypted TEXT,
    updated_by INTEGER,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE integration_settings IS 'Зашифрованные настройки интеграций (вебхуки, пароли, домены), редактируются админом в UI';