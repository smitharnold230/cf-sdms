-- Migration 004: Notification System
-- Creates tables for real-time notifications, user preferences, and scheduled notifications

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('info', 'warning', 'success', 'error', 'deadline')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT (datetime('now')),
  read_at DATETIME,
  deleted_at DATETIME,
  scheduled_for DATETIME, -- For scheduled notifications
  delivered_at DATETIME, -- When the notification was actually sent
  metadata TEXT, -- JSON metadata for additional data
  created_by INTEGER, -- User who created the notification (for admin/faculty notifications)
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- User notification preferences
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  push_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  deadline_reminders BOOLEAN NOT NULL DEFAULT TRUE,
  workshop_updates BOOLEAN NOT NULL DEFAULT TRUE,
  system_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  reminder_hours TEXT NOT NULL DEFAULT '[24, 72]', -- JSON array of hours before deadline
  created_at DATETIME NOT NULL DEFAULT (datetime('now')),
  updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Scheduled notifications for deadline reminders
CREATE TABLE IF NOT EXISTS scheduled_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  related_type TEXT NOT NULL CHECK (related_type IN ('certificate', 'workshop', 'event')),
  related_id INTEGER NOT NULL,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('deadline_reminder', 'workshop_reminder', 'event_reminder')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  scheduled_for DATETIME NOT NULL,
  is_sent BOOLEAN NOT NULL DEFAULT FALSE,
  sent_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT (datetime('now')),
  metadata TEXT, -- JSON metadata
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Notification delivery log for tracking email/push notifications
CREATE TABLE IF NOT EXISTS notification_delivery_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  notification_id INTEGER NOT NULL,
  delivery_method TEXT NOT NULL CHECK (delivery_method IN ('websocket', 'email', 'push')),
  delivery_status TEXT NOT NULL CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'failed', 'bounced')),
  delivery_address TEXT, -- Email address or push endpoint
  attempted_at DATETIME NOT NULL DEFAULT (datetime('now')),
  delivered_at DATETIME,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE
);

-- Bulk notification campaigns for admin broadcasts
CREATE TABLE IF NOT EXISTS notification_campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('info', 'warning', 'success', 'error', 'deadline')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  target_role TEXT CHECK (target_role IN ('student', 'faculty', 'admin', 'all')),
  target_users TEXT, -- JSON array of user IDs if targeting specific users
  scheduled_for DATETIME,
  created_by INTEGER NOT NULL,
  created_at DATETIME NOT NULL DEFAULT (datetime('now')),
  sent_at DATETIME,
  total_recipients INTEGER NOT NULL DEFAULT 0,
  delivered_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed')),
  metadata TEXT, -- JSON metadata
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_deleted ON notifications(user_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled ON notifications(scheduled_for) WHERE scheduled_for IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_user_id ON scheduled_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_scheduled_for ON scheduled_notifications(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_is_sent ON scheduled_notifications(is_sent);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_type ON scheduled_notifications(notification_type);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_notification_id ON notification_delivery_log(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_status ON notification_delivery_log(delivery_status);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_method ON notification_delivery_log(delivery_method);

CREATE INDEX IF NOT EXISTS idx_notification_campaigns_created_by ON notification_campaigns(created_by);
CREATE INDEX IF NOT EXISTS idx_notification_campaigns_status ON notification_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_notification_campaigns_scheduled_for ON notification_campaigns(scheduled_for);

-- Insert default notification preferences for existing users
INSERT OR IGNORE INTO user_notification_preferences (user_id, email_notifications, push_notifications, deadline_reminders, workshop_updates, system_alerts, reminder_hours)
SELECT id, TRUE, TRUE, TRUE, TRUE, TRUE, '[24, 72]' FROM users;

-- Create a trigger to automatically create notification preferences for new users
CREATE TRIGGER IF NOT EXISTS create_default_notification_preferences
AFTER INSERT ON users
FOR EACH ROW
BEGIN
  INSERT INTO user_notification_preferences 
  (user_id, email_notifications, push_notifications, deadline_reminders, workshop_updates, system_alerts, reminder_hours)
  VALUES 
  (NEW.id, TRUE, TRUE, TRUE, TRUE, TRUE, '[24, 72]');
END;

-- Create a trigger to automatically schedule deadline reminders for new certificates
CREATE TRIGGER IF NOT EXISTS schedule_certificate_deadline_reminders
AFTER INSERT ON certificate_submissions
FOR EACH ROW
WHEN NEW.submission_deadline IS NOT NULL
BEGIN
  -- Insert reminder notifications based on user preferences
  INSERT INTO scheduled_notifications (user_id, related_type, related_id, notification_type, title, message, scheduled_for, metadata)
  SELECT 
    NEW.user_id,
    'certificate',
    NEW.id,
    'deadline_reminder',
    'Certificate Submission Deadline Reminder',
    'Your certificate submission "' || NEW.title || '" is due soon. Please submit before the deadline.',
    datetime(NEW.submission_deadline, '-' || CAST(json_extract(preference_hours.value, '$') AS TEXT) || ' hours'),
    json_object('hours_before', json_extract(preference_hours.value, '$'), 'certificate_id', NEW.id, 'deadline', NEW.submission_deadline)
  FROM user_notification_preferences up,
       json_each(up.reminder_hours) AS preference_hours
  WHERE up.user_id = NEW.user_id 
    AND up.deadline_reminders = TRUE
    AND datetime(NEW.submission_deadline, '-' || CAST(json_extract(preference_hours.value, '$') AS TEXT) || ' hours') > datetime('now');
END;

-- Create a trigger to automatically schedule workshop deadline reminders
CREATE TRIGGER IF NOT EXISTS schedule_workshop_deadline_reminders
AFTER INSERT ON workshops
FOR EACH ROW
WHEN NEW.registration_deadline IS NOT NULL
BEGIN
  -- Schedule reminders for all eligible users based on their preferences
  INSERT INTO scheduled_notifications (user_id, related_type, related_id, notification_type, title, message, scheduled_for, metadata)
  SELECT 
    up.user_id,
    'workshop',
    NEW.id,
    'workshop_reminder',
    'Workshop Registration Deadline Reminder',
    'Registration for workshop "' || NEW.title || '" closes soon. Register now to secure your spot.',
    datetime(NEW.registration_deadline, '-' || CAST(json_extract(preference_hours.value, '$') AS TEXT) || ' hours'),
    json_object('hours_before', json_extract(preference_hours.value, '$'), 'workshop_id', NEW.id, 'deadline', NEW.registration_deadline)
  FROM user_notification_preferences up,
       json_each(up.reminder_hours) AS preference_hours,
       users u
  WHERE up.user_id = u.id 
    AND u.is_active = TRUE
    AND up.workshop_updates = TRUE
    AND datetime(NEW.registration_deadline, '-' || CAST(json_extract(preference_hours.value, '$') AS TEXT) || ' hours') > datetime('now');
END;