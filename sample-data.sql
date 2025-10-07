-- Additional test users and sample data for comprehensive testing

-- Insert additional students
INSERT INTO users (email, password_hash, role, full_name, department, year_of_study, phone) VALUES
('john.doe@student.edu', '$2b$10$example1', 'student', 'John Doe', 'Computer Science', 3, '+1234567001'),
('jane.smith@student.edu', '$2b$10$example2', 'student', 'Jane Smith', 'Information Technology', 2, '+1234567002'),
('mike.wilson@student.edu', '$2b$10$example3', 'student', 'Mike Wilson', 'Data Science', 4, '+1234567003'),
('sarah.johnson@student.edu', '$2b$10$example4', 'student', 'Sarah Johnson', 'Cybersecurity', 1, '+1234567004'),
('alex.brown@student.edu', '$2b$10$example5', 'student', 'Alex Brown', 'Software Engineering', 3, '+1234567005');

-- Insert additional faculty members
INSERT INTO users (email, password_hash, role, full_name, department, phone) VALUES
('dr.thompson@faculty.edu', '$2b$10$faculty1', 'faculty', 'Dr. Emily Thompson', 'Computer Science', '+1234567101'),
('prof.davis@faculty.edu', '$2b$10$faculty2', 'faculty', 'Prof. Robert Davis', 'Information Technology', '+1234567102'),
('dr.garcia@faculty.edu', '$2b$10$faculty3', 'faculty', 'Dr. Maria Garcia', 'Data Science', '+1234567103');

-- Insert sample events
INSERT INTO events (title, description, event_date, location, max_participants, registration_deadline, created_by) VALUES
('AI & Machine Learning Summit 2025', 'Annual conference on AI and ML advancements', '2025-11-15 09:00:00', 'Main Auditorium', 200, '2025-11-01 23:59:59', 2),
('Cybersecurity Workshop Series', 'Hands-on cybersecurity training sessions', '2025-10-25 14:00:00', 'Lab Building Room 301', 50, '2025-10-20 23:59:59', 2),
('Data Science Career Fair', 'Meet industry professionals and explore opportunities', '2025-12-05 10:00:00', 'Student Center', 300, '2025-11-25 23:59:59', 3),
('Software Development Bootcamp', 'Intensive coding workshop for beginners', '2025-11-08 09:00:00', 'Computer Lab A', 30, '2025-11-01 23:59:59', 4);

-- Insert sample workshops
INSERT INTO workshops (event_id, title, description, workshop_date, duration_hours, max_participants, submission_deadline, points_awarded, instructor_id) VALUES
(1, 'Introduction to Neural Networks', 'Basic concepts and implementation of neural networks', '2025-11-15 10:00:00', 3, 50, '2025-12-15 23:59:59', 25, 2),
(1, 'Machine Learning in Practice', 'Real-world ML applications and case studies', '2025-11-15 14:00:00', 3, 50, '2025-12-15 23:59:59', 25, 3),
(2, 'Ethical Hacking Fundamentals', 'Learn penetration testing basics', '2025-10-25 14:00:00', 4, 25, '2025-11-25 23:59:59', 30, 4),
(2, 'Network Security Analysis', 'Analyze and secure network infrastructure', '2025-10-26 14:00:00', 4, 25, '2025-11-26 23:59:59', 30, 4),
(3, 'Data Visualization with Python', 'Create compelling data visualizations', '2025-12-05 11:00:00', 2, 40, '2026-01-05 23:59:59', 20, 3),
(4, 'Full-Stack Web Development', 'Build complete web applications', '2025-11-08 09:00:00', 6, 15, '2025-12-08 23:59:59', 35, 2);

-- Insert sample workshop registrations
INSERT INTO workshop_registrations (workshop_id, user_id, registration_date, attendance_status) VALUES
(1, 5, '2025-10-01 10:00:00', 'registered'),
(1, 6, '2025-10-01 11:00:00', 'registered'),
(1, 7, '2025-10-01 12:00:00', 'registered'),
(2, 5, '2025-10-01 13:00:00', 'registered'),
(3, 8, '2025-10-02 09:00:00', 'registered'),
(3, 9, '2025-10-02 10:00:00', 'registered'),
(4, 6, '2025-10-02 11:00:00', 'registered'),
(5, 7, '2025-10-02 12:00:00', 'registered'),
(6, 8, '2025-10-02 13:00:00', 'registered'),
(6, 9, '2025-10-02 14:00:00', 'registered');

-- Insert sample certificates (some approved, some pending)
INSERT INTO certificates (user_id, workshop_id, title, description, file_path, submission_date, status, review_feedback, points_awarded, reviewed_by) VALUES
(5, 1, 'Neural Networks Completion Certificate', 'Successfully completed Introduction to Neural Networks workshop', 'certificates/john_doe/neural_networks_cert.pdf', '2025-10-05 16:00:00', 'approved', 'Excellent participation and understanding demonstrated.', 25, 2),
(6, 1, 'Neural Networks Completion Certificate', 'Successfully completed Introduction to Neural Networks workshop', 'certificates/jane_smith/neural_networks_cert.pdf', '2025-10-05 17:00:00', 'pending', NULL, 0, NULL),
(7, 3, 'Ethical Hacking Certificate', 'Completed Ethical Hacking Fundamentals workshop', 'certificates/mike_wilson/ethical_hacking_cert.pdf', '2025-10-06 14:00:00', 'pending', NULL, 0, NULL),
(8, 5, 'Data Visualization Certificate', 'Successfully completed Data Visualization with Python', 'certificates/sarah_johnson/data_viz_cert.pdf', '2025-10-07 10:00:00', 'approved', 'Outstanding work on the final project.', 20, 3),
(9, 6, 'Full-Stack Development Certificate', 'Completed Full-Stack Web Development bootcamp', 'certificates/alex_brown/fullstack_cert.pdf', '2025-10-07 15:00:00', 'approved', 'Impressive final project implementation.', 35, 2);

-- Insert sample notifications
INSERT INTO notifications (user_id, type, title, message, is_read, created_at) VALUES
(5, 'certificate_approved', 'Certificate Approved!', 'Your Neural Networks certificate has been approved. You earned 25 points!', false, '2025-10-05 18:00:00'),
(6, 'workshop_reminder', 'Workshop Reminder', 'Your registered workshop "Introduction to Neural Networks" starts in 2 days.', false, '2025-10-06 09:00:00'),
(7, 'certificate_submitted', 'Certificate Submitted', 'Your certificate for "Ethical Hacking Fundamentals" has been submitted for review.', true, '2025-10-06 14:30:00'),
(8, 'certificate_approved', 'Certificate Approved!', 'Your Data Visualization certificate has been approved. You earned 20 points!', false, '2025-10-07 11:00:00'),
(9, 'certificate_approved', 'Certificate Approved!', 'Your Full-Stack Development certificate has been approved. You earned 35 points!', false, '2025-10-07 16:00:00'),
(5, 'new_workshop', 'New Workshop Available', 'A new workshop "Machine Learning in Practice" is now open for registration.', false, '2025-10-07 12:00:00');

-- Insert sample analytics data
INSERT INTO analytics_events (user_id, event_type, event_data, timestamp) VALUES
(5, 'login', '{"ip_address": "192.168.1.100", "user_agent": "Mozilla/5.0..."}', '2025-10-07 08:00:00'),
(5, 'certificate_submission', '{"certificate_id": 1, "workshop_id": 1}', '2025-10-05 16:00:00'),
(6, 'login', '{"ip_address": "192.168.1.101", "user_agent": "Mozilla/5.0..."}', '2025-10-07 09:00:00'),
(6, 'workshop_registration', '{"workshop_id": 1}', '2025-10-01 11:00:00'),
(7, 'login', '{"ip_address": "192.168.1.102", "user_agent": "Mozilla/5.0..."}', '2025-10-07 10:00:00'),
(8, 'certificate_download', '{"certificate_id": 4}', '2025-10-07 11:30:00'),
(9, 'dashboard_view', '{"page": "student_dashboard"}', '2025-10-07 12:00:00');

-- Update user points based on approved certificates
UPDATE users SET total_points = 25 WHERE id = 5;
UPDATE users SET total_points = 20 WHERE id = 8;
UPDATE users SET total_points = 35 WHERE id = 9;