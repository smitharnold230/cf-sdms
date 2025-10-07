-- D1 initial schema
-- Users table
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','faculty','student')),
  full_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TRIGGER users_updated_at
AFTER UPDATE ON users
FOR EACH ROW BEGIN
  UPDATE users SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = OLD.id;
END;

-- Certificates metadata table
CREATE TABLE certificates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  issued_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_certificates_user ON certificates(user_id);

-- Seed an admin user (password will be set via deployment script)
-- Default email: admin@sdms.local
-- Run the following after deployment to set a secure password:
-- UPDATE users SET password_hash = ? WHERE email = 'admin@sdms.local';
INSERT INTO users (email, password_hash, role, full_name) VALUES (
  'admin@sdms.local',
  'REPLACE_WITH_SECURE_HASH',
  'admin',
  'System Administrator'
);
