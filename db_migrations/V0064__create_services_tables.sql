-- Create ticket_service_categories table for categorizing ticket services
CREATE TABLE IF NOT EXISTS ticket_service_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    icon VARCHAR(100) DEFAULT 'Tag',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create services table for managing service approval workflows
CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    intermediate_approver_id INTEGER REFERENCES users(id),
    final_approver_id INTEGER NOT NULL REFERENCES users(id),
    customer_department_id INTEGER REFERENCES departments(id),
    category_id INTEGER REFERENCES ticket_service_categories(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create ticket_services table (if needed separately from services)
CREATE TABLE IF NOT EXISTS ticket_services (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category_id INTEGER REFERENCES ticket_service_categories(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_services_approvers ON services(intermediate_approver_id, final_approver_id);
CREATE INDEX IF NOT EXISTS idx_services_department ON services(customer_department_id);
CREATE INDEX IF NOT EXISTS idx_services_category ON services(category_id);
CREATE INDEX IF NOT EXISTS idx_ticket_services_category ON ticket_services(category_id);