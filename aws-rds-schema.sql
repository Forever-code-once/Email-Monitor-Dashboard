-- AWS RDS MySQL Database Setup Script for Email Monitor Dashboard (Truck Data Only)
-- Azure SQL is used for loads data, AWS RDS MySQL for truck data

-- Create database (if not exists)
CREATE DATABASE IF NOT EXISTS email_monitor;
USE email_monitor;

-- Create truck_availability table for AWS RDS MySQL
CREATE TABLE IF NOT EXISTS truck_availability (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    date VARCHAR(50) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(50) NOT NULL,
    additional_info TEXT,
    email_id VARCHAR(255) NOT NULL,
    email_subject VARCHAR(500) NOT NULL,
    email_date DATETIME NOT NULL,
    is_deleted TINYINT(1) DEFAULT 0,
    deleted_date DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_customer_email (customer_email),
    INDEX idx_date (date),
    INDEX idx_city_state (city, state),
    INDEX idx_is_deleted (is_deleted),
    INDEX idx_created_at (created_at)
);

-- Create emails table for AWS RDS MySQL (truck-related emails)
CREATE TABLE IF NOT EXISTS emails (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email_id VARCHAR(255) NOT NULL UNIQUE,
    subject VARCHAR(500) NOT NULL,
    from_email VARCHAR(255) NOT NULL,
    from_name VARCHAR(255) NOT NULL,
    body LONGTEXT NOT NULL,
    received_date_time DATETIME NOT NULL,
    is_forwarded TINYINT(1) DEFAULT 0,
    original_sender VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_from_email (from_email),
    INDEX idx_received_date (received_date_time),
    INDEX idx_is_forwarded (is_forwarded)
);

-- Create customers table for AWS RDS MySQL (truck customers)
CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255) NOT NULL UNIQUE,
    first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_emails INT DEFAULT 0,
    total_trucks INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_customer_email (customer_email),
    INDEX idx_last_seen (last_seen)
);

-- Create a view for easy truck data retrieval
CREATE OR REPLACE VIEW active_trucks AS
SELECT 
    ta.*,
    c.customer_name,
    c.total_trucks,
    e.subject as email_subject_full,
    e.received_date_time as email_received
FROM truck_availability ta
LEFT JOIN customers c ON ta.customer_email = c.customer_email
LEFT JOIN emails e ON ta.email_id = e.email_id
WHERE ta.is_deleted = 0 OR ta.is_deleted IS NULL
ORDER BY ta.created_at DESC;

-- Sample data insertion (for testing)
-- INSERT INTO truck_availability (customer, customer_email, date, city, state, additional_info, email_id, email_subject, email_date)
-- VALUES 
-- ('Test Customer', 'test@example.com', '09/16', 'Nashville', 'TN', 'Test truck', 'test-001', 'Test Email', NOW()),
-- ('Test Customer', 'test@example.com', '09/16', 'Memphis', 'TN', 'Test truck 2', 'test-001', 'Test Email', NOW());

-- Show table structures
DESCRIBE truck_availability;
DESCRIBE emails;
DESCRIBE customers;

-- Show initial counts
SELECT 'truck_availability' as table_name, COUNT(*) as record_count FROM truck_availability
UNION ALL
SELECT 'emails' as table_name, COUNT(*) as record_count FROM emails
UNION ALL
SELECT 'customers' as table_name, COUNT(*) as record_count FROM customers;