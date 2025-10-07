-- Simple sample data using existing user IDs

-- Add some events using existing user IDs
INSERT INTO events (title, description, category, start_datetime, end_datetime, registration_deadline, location, created_by) VALUES
('AI Workshop Series', 'Introduction to Artificial Intelligence and Machine Learning', 'workshop', '2025-11-15 09:00:00', '2025-11-15 17:00:00', '2025-11-01 23:59:59', 'Main Auditorium', 5),
('Cybersecurity Bootcamp', 'Hands-on cybersecurity training for students', 'bootcamp', '2025-10-25 14:00:00', '2025-10-25 18:00:00', '2025-10-20 23:59:59', 'Lab Building', 5),
('Data Science Conference', 'Annual data science and analytics conference', 'conference', '2025-12-05 10:00:00', '2025-12-05 16:00:00', '2025-11-25 23:59:59', 'Student Center', 4);

-- Add some notifications for existing users
INSERT INTO notifications (user_id, type, title, message, is_read, created_at) VALUES
(2, 'welcome', 'Welcome to SDMS!', 'Welcome to the Student Database Management System. Start by exploring available workshops.', false, '2025-10-07 10:00:00'),
(2, 'workshop_reminder', 'New Workshops Available', 'Check out the new AI Workshop Series opening for registration.', false, '2025-10-07 11:00:00'),
(2, 'event_announcement', 'Cybersecurity Bootcamp', 'Register now for the upcoming Cybersecurity Bootcamp. Limited seats available!', false, '2025-10-07 12:00:00'),
(5, 'welcome', 'Faculty Account Ready', 'Your faculty account is ready. You can now review student submissions and create workshops.', false, '2025-10-07 13:00:00'),
(4, 'system_update', 'System Update', 'The Student Database Management System has been updated with new features.', true, '2025-10-06 15:00:00');

-- Add some analytics events for existing users
INSERT INTO analytics_events (user_id, event_type, event_data, timestamp) VALUES
(2, 'login', '{"ip_address": "192.168.1.100", "user_agent": "Chrome/91.0"}', '2025-10-07 08:00:00'),
(2, 'dashboard_view', '{"page": "student_dashboard"}', '2025-10-07 08:15:00'),
(5, 'login', '{"ip_address": "192.168.1.101", "user_agent": "Firefox/89.0"}', '2025-10-07 09:00:00'),
(5, 'event_creation', '{"event_title": "AI Workshop Series"}', '2025-10-07 09:30:00'),
(4, 'login', '{"ip_address": "192.168.1.102", "user_agent": "Safari/14.0"}', '2025-10-07 10:00:00'),
(4, 'admin_dashboard_view', '{"page": "admin_analytics"}', '2025-10-07 10:15:00');