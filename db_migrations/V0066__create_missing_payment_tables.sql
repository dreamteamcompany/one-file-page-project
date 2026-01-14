-- Create missing core tables for payment management system

-- Categories for payments
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    icon VARCHAR(100) DEFAULT 'Tag',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Legal entities
CREATE TABLE IF NOT EXISTS legal_entities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    inn VARCHAR(50),
    kpp VARCHAR(50),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Contractors
CREATE TABLE IF NOT EXISTS contractors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    inn VARCHAR(50),
    kpp VARCHAR(50),
    ogrn VARCHAR(50),
    legal_address TEXT,
    actual_address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    contact_person VARCHAR(255),
    bank_name VARCHAR(255),
    bank_bik VARCHAR(50),
    bank_account VARCHAR(50),
    correspondent_account VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customer departments
CREATE TABLE IF NOT EXISTS customer_departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    amount NUMERIC(15, 2) NOT NULL,
    description TEXT,
    category_id INTEGER REFERENCES categories(id),
    legal_entity_id INTEGER REFERENCES legal_entities(id),
    contractor_id INTEGER REFERENCES contractors(id),
    department_id INTEGER REFERENCES departments(id),
    service_id INTEGER REFERENCES services(id),
    invoice_number VARCHAR(100),
    invoice_date DATE,
    payment_date DATE,
    status VARCHAR(50) DEFAULT 'pending',
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Custom fields for payments
CREATE TABLE IF NOT EXISTS custom_fields (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    field_type VARCHAR(50) NOT NULL CHECK (field_type IN ('text', 'select', 'file', 'toggle')),
    options TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payment custom field values
CREATE TABLE IF NOT EXISTS payment_custom_field_values (
    id SERIAL PRIMARY KEY,
    payment_id INTEGER REFERENCES payments(id),
    custom_field_id INTEGER REFERENCES custom_fields(id),
    value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(payment_id, custom_field_id)
);

-- Approvals table
CREATE TABLE IF NOT EXISTS approvals (
    id SERIAL PRIMARY KEY,
    payment_id INTEGER REFERENCES payments(id),
    approver_id INTEGER REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    comment TEXT,
    level INTEGER DEFAULT 1,
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Savings reasons
CREATE TABLE IF NOT EXISTS saving_reasons (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    icon VARCHAR(100) DEFAULT 'Tag',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Savings table
CREATE TABLE IF NOT EXISTS savings (
    id SERIAL PRIMARY KEY,
    service_id INTEGER REFERENCES services(id),
    description TEXT NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    frequency VARCHAR(50) NOT NULL CHECK (frequency IN ('once', 'monthly', 'quarterly', 'yearly')),
    currency VARCHAR(10) DEFAULT 'RUB',
    employee_id INTEGER REFERENCES users(id),
    saving_reason_id INTEGER REFERENCES saving_reasons(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(100) NOT NULL,
    entity_id INTEGER NOT NULL,
    action VARCHAR(50) NOT NULL,
    user_id INTEGER REFERENCES users(id),
    username VARCHAR(255),
    changed_fields JSONB,
    old_values JSONB,
    new_values JSONB,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_payments_category ON payments(category_id);
CREATE INDEX IF NOT EXISTS idx_payments_legal_entity ON payments(legal_entity_id);
CREATE INDEX IF NOT EXISTS idx_payments_contractor ON payments(contractor_id);
CREATE INDEX IF NOT EXISTS idx_payments_service ON payments(service_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_by ON payments(created_by);
CREATE INDEX IF NOT EXISTS idx_approvals_payment ON approvals(payment_id);
CREATE INDEX IF NOT EXISTS idx_approvals_approver ON approvals(approver_id);
CREATE INDEX IF NOT EXISTS idx_savings_service ON savings(service_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);