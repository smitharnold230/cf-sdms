-- Simple sample data that matches the ACTUAL database schema

-- Add some additional users first
INSERT INTO users (email, password_hash, role, full_name) VALUES
('john.doe@student.edu', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'student', 'John Doe'),
('jane.smith@student.edu', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'student', 'Jane Smith'),
('mike.wilson@student.edu', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'student', 'Mike Wilson'),
('dr.thompson@faculty.edu', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'faculty', 'Dr. Emily Thompson');

-- Add some events (using correct column names)
INSERT INTO events (title, description, category, start_datetime, end_datetime, registration_deadline, location, created_by) VALUES
('AI Workshop Series', 'Introduction to Artificial Intelligence and Machine Learning', 'workshop', '2025-11-15 09:00:00', '2025-11-15 17:00:00', '2025-11-01 23:59:59', 'Main Auditorium', 2),
('Cybersecurity Bootcamp', 'Hands-on cybersecurity training for students', 'bootcamp', '2025-10-25 14:00:00', '2025-10-25 18:00:00', '2025-10-20 23:59:59', 'Lab Building', 2),
('Data Science Conference', 'Annual data science and analytics conference', 'conference', '2025-12-05 10:00:00', '2025-12-05 16:00:00', '2025-11-25 23:59:59', 'Student Center', 3);

-- Add some notifications for the new users
INSERT INTO notifications (user_id, type, title, message, is_read, created_at) VALUES
(5, 'welcome', 'Welcome to SDMS!', 'Welcome to the Student Database Management System. Start by exploring available workshops.', false, '2025-10-07 10:00:00'),
(6, 'workshop_reminder', 'New Workshops Available', 'Check out the new AI Workshop Series opening for registration.', false, '2025-10-07 11:00:00'),
(7, 'event_announcement', 'Cybersecurity Bootcamp', 'Register now for the upcoming Cybersecurity Bootcamp. Limited seats available!', false, '2025-10-07 12:00:00'),
(8, 'welcome', 'Faculty Account Created', 'Your faculty account has been created. You can now review student submissions.', false, '2025-10-07 13:00:00');

-- Add some analytics events
INSERT INTO analytics_events (user_id, event_type, event_data, timestamp) VALUES
(5, 'login', '{"ip_address": "192.168.1.100", "user_agent": "Chrome/91.0"}', '2025-10-07 08:00:00'),
(6, 'login', '{"ip_address": "192.168.1.101", "user_agent": "Firefox/89.0"}', '2025-10-07 09:00:00'),
(7, 'dashboard_view', '{"page": "student_dashboard"}', '2025-10-07 10:00:00'),
(8, 'login', '{"ip_address": "192.168.1.102", "user_agent": "Safari/14.0"}', '2025-10-07 11:00:00');