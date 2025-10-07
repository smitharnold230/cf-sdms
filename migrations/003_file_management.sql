-- Migration 003: Add file upload and metadata tables
-- This migration adds comprehensive file management capabilities

-- Files table for storing file metadata
CREATE TABLE files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL UNIQUE,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('certificate', 'profile')),
    uploaded_by INTEGER NOT NULL,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    virus_scan_status TEXT DEFAULT 'pending' CHECK (virus_scan_status IN ('pending', 'clean', 'infected', 'failed')),
    virus_scan_id TEXT,
    scan_date TIMESTAMP,
    access_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_date TIMESTAMP,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Add indexes for performance
CREATE INDEX idx_files_uploaded_by ON files(uploaded_by);
CREATE INDEX idx_files_category ON files(category);
CREATE INDEX idx_files_stored_name ON files(stored_name);
CREATE INDEX idx_files_virus_scan_status ON files(virus_scan_status);
CREATE INDEX idx_files_upload_date ON files(upload_date);

-- File access logs for security and audit
CREATE TABLE file_access_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL,
    accessed_by INTEGER NOT NULL,
    access_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    access_type TEXT NOT NULL CHECK (access_type IN ('view', 'download', 'upload')),
    ip_address TEXT,
    user_agent TEXT,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
    FOREIGN KEY (accessed_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Add indexes for file access logs
CREATE INDEX idx_file_access_logs_file_id ON file_access_logs(file_id);
CREATE INDEX idx_file_access_logs_accessed_by ON file_access_logs(accessed_by);
CREATE INDEX idx_file_access_logs_access_date ON file_access_logs(access_date);

-- Update certificates table to reference files table
ALTER TABLE certificates ADD COLUMN file_id INTEGER REFERENCES files(id);

-- Update users table to support profile photos
ALTER TABLE users ADD COLUMN profile_photo_id INTEGER REFERENCES files(id);

-- Create indexes for the new foreign key relationships
CREATE INDEX idx_certificates_file_id ON certificates(file_id);
CREATE INDEX idx_users_profile_photo_id ON users(profile_photo_id);

-- File sharing permissions (for future extensibility)
CREATE TABLE file_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL,
    user_id INTEGER,
    role TEXT CHECK (role IN ('admin', 'faculty', 'student')),
    permission_type TEXT NOT NULL CHECK (permission_type IN ('read', 'write', 'delete')),
    granted_by INTEGER NOT NULL,
    granted_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_date TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(id),
    -- Either user_id or role must be specified, not both
    CHECK ((user_id IS NOT NULL AND role IS NULL) OR (user_id IS NULL AND role IS NOT NULL))
);

-- Add indexes for file permissions
CREATE INDEX idx_file_permissions_file_id ON file_permissions(file_id);
CREATE INDEX idx_file_permissions_user_id ON file_permissions(user_id);
CREATE INDEX idx_file_permissions_role ON file_permissions(role);
CREATE INDEX idx_file_permissions_granted_date ON file_permissions(granted_date);

-- File download tokens for secure temporary access
CREATE TABLE file_download_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL UNIQUE,
    file_id INTEGER NOT NULL,
    generated_for INTEGER NOT NULL,
    generated_by INTEGER NOT NULL,
    generated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_date TIMESTAMP NOT NULL,
    download_count INTEGER DEFAULT 0,
    max_downloads INTEGER DEFAULT 1,
    is_used BOOLEAN DEFAULT FALSE,
    ip_restriction TEXT, -- JSON array of allowed IP addresses
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
    FOREIGN KEY (generated_for) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Add indexes for download tokens
CREATE INDEX idx_file_download_tokens_token ON file_download_tokens(token);
CREATE INDEX idx_file_download_tokens_file_id ON file_download_tokens(file_id);
CREATE INDEX idx_file_download_tokens_expires_date ON file_download_tokens(expires_date);

-- Triggers for automatic file management

-- Trigger to update access count when file is accessed
CREATE TRIGGER update_file_access_count 
AFTER INSERT ON file_access_logs
BEGIN
    UPDATE files 
    SET access_count = access_count + 1,
        last_accessed = NEW.access_date
    WHERE id = NEW.file_id;
END;

-- Trigger to clean up expired download tokens
CREATE TRIGGER cleanup_expired_tokens
AFTER INSERT ON file_download_tokens
BEGIN
    DELETE FROM file_download_tokens 
    WHERE expires_date < datetime('now') 
    AND is_used = FALSE;
END;

-- Trigger to log certificate file uploads
CREATE TRIGGER log_certificate_file_upload
AFTER UPDATE OF file_id ON certificates
WHEN NEW.file_id IS NOT NULL AND OLD.file_id IS NULL
BEGIN
    INSERT INTO file_access_logs (file_id, accessed_by, access_type)
    VALUES (NEW.file_id, NEW.user_id, 'upload');
    
    INSERT INTO notifications (user_id, type, title, message)
    VALUES (NEW.user_id, 'file_uploaded', 'Certificate Uploaded', 
            'Your certificate file has been uploaded successfully and is pending review.');
END;

-- Trigger to log profile photo updates
CREATE TRIGGER log_profile_photo_update
AFTER UPDATE OF profile_photo_id ON users
WHEN NEW.profile_photo_id IS NOT NULL
BEGIN
    INSERT INTO file_access_logs (file_id, accessed_by, access_type)
    VALUES (NEW.profile_photo_id, NEW.id, 'upload');
END;

-- Create view for file statistics
CREATE VIEW file_statistics AS
SELECT 
    f.category,
    COUNT(*) as total_files,
    SUM(f.file_size) as total_size,
    AVG(f.file_size) as avg_size,
    SUM(f.access_count) as total_downloads,
    COUNT(CASE WHEN f.virus_scan_status = 'clean' THEN 1 END) as clean_files,
    COUNT(CASE WHEN f.virus_scan_status = 'infected' THEN 1 END) as infected_files,
    COUNT(CASE WHEN f.virus_scan_status = 'pending' THEN 1 END) as pending_scans,
    MIN(f.upload_date) as first_upload,
    MAX(f.upload_date) as last_upload
FROM files f
WHERE f.is_deleted = FALSE
GROUP BY f.category;

-- Create view for user file usage
CREATE VIEW user_file_usage AS
SELECT 
    u.id as user_id,
    u.full_name,
    u.email,
    u.role,
    COUNT(f.id) as total_files,
    SUM(f.file_size) as total_storage_used,
    COUNT(CASE WHEN f.category = 'certificate' THEN 1 END) as certificate_files,
    COUNT(CASE WHEN f.category = 'profile' THEN 1 END) as profile_files,
    SUM(f.access_count) as total_file_accesses,
    MAX(f.upload_date) as last_file_upload
FROM users u
LEFT JOIN files f ON u.id = f.uploaded_by AND f.is_deleted = FALSE
GROUP BY u.id, u.full_name, u.email, u.role;