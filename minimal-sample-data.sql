-- Minimal working sample data for existing tables only

-- Add some events
INSERT INTO events (title, description, category, start_datetime, end_datetime, registration_deadline, location, created_by) VALUES
('AI Workshop Series', 'Introduction to Artificial Intelligence and Machine Learning', 'workshop', '2025-11-15 09:00:00', '2025-11-15 17:00:00', '2025-11-01 23:59:59', 'Main Auditorium', 5),
('Cybersecurity Bootcamp', 'Hands-on cybersecurity training for students', 'bootcamp', '2025-10-25 14:00:00', '2025-10-25 18:00:00', '2025-10-20 23:59:59', 'Lab Building', 5),
('Data Science Conference', 'Annual data science and analytics conference', 'conference', '2025-12-05 10:00:00', '2025-12-05 16:00:00', '2025-11-25 23:59:59', 'Student Center', 4);

-- Add some notifications
INSERT INTO notifications (user_id, type, title, message, is_read, created_at) VALUES
(2, 'system', 'Welcome to SDMS!', 'Welcome to the Student Database Management System. Start by exploring available workshops.', 0, '2025-10-07 10:00:00'),
(2, 'workshop', 'New Workshops Available', 'Check out the new AI Workshop Series opening for registration.', 0, '2025-10-07 11:00:00'),
(2, 'event', 'Cybersecurity Bootcamp', 'Register now for the upcoming Cybersecurity Bootcamp. Limited seats available!', 0, '2025-10-07 12:00:00'),
(5, 'system', 'Faculty Account Ready', 'Your faculty account is ready. You can now review student submissions and create workshops.', 0, '2025-10-07 13:00:00'),
(4, 'system', 'System Update', 'The Student Database Management System has been updated with new features.', 1, '2025-10-06 15:00:00');