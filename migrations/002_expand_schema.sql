-- Migration: expand schema for events, workshops, certificate workflow, points, notifications
-- Users table already exists (001_init.sql)
-- We will non-destructively alter / extend certificate table for workflow.

PRAGMA foreign_keys=ON;

-- Certificate workflow additions
ALTER TABLE certificates ADD COLUMN status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected'));
ALTER TABLE certificates ADD COLUMN reviewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE certificates ADD COLUMN reviewed_at TEXT;
ALTER TABLE certificates ADD COLUMN rejection_reason TEXT;
CREATE INDEX IF NOT EXISTS idx_certificates_status ON certificates(status);
CREATE INDEX IF NOT EXISTS idx_certificates_reviewer ON certificates(reviewer_id);

-- Events table (general academic/co-curricular events)
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT, -- e.g., academic, cultural, sports
  start_datetime TEXT NOT NULL,
  end_datetime TEXT NOT NULL,
  registration_deadline TEXT,
  location TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TRIGGER events_updated_at AFTER UPDATE ON events FOR EACH ROW BEGIN
  UPDATE events SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = OLD.id;
END;
CREATE INDEX idx_events_start ON events(start_datetime);
CREATE INDEX idx_events_category ON events(category);

-- Workshops (specialized subset, can reference an event optionally)
CREATE TABLE workshops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  presenter TEXT,
  capacity INTEGER,
  start_datetime TEXT NOT NULL,
  end_datetime TEXT NOT NULL,
  registration_deadline TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TRIGGER workshops_updated_at AFTER UPDATE ON workshops FOR EACH ROW BEGIN
  UPDATE workshops SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = OLD.id;
END;
CREATE INDEX idx_workshops_start ON workshops(start_datetime);
CREATE INDEX idx_workshops_event ON workshops(event_id);

-- Participation / registrations (users registering for events/workshops)
CREATE TABLE registrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
  workshop_id INTEGER REFERENCES workshops(id) ON DELETE CASCADE,
  registered_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(user_id, event_id, workshop_id)
);
CREATE INDEX idx_registrations_user ON registrations(user_id);
CREATE INDEX idx_registrations_event ON registrations(event_id);
CREATE INDEX idx_registrations_workshop ON registrations(workshop_id);

-- Points tracking ledger
CREATE TABLE points_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('certificate','event','workshop','manual')),
  source_id INTEGER, -- ID referencing the source table; no FK to allow flexible referencing
  points INTEGER NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_points_user ON points_ledger(user_id);
CREATE INDEX idx_points_source ON points_ledger(source_type, source_id);

-- Materialized points summary (optional optimization)
CREATE TABLE user_points (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  total_points INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- (Optional) trigger to update user_points after ledger insert
CREATE TRIGGER points_ledger_after_insert AFTER INSERT ON points_ledger BEGIN
  INSERT INTO user_points(user_id,total_points,updated_at) VALUES(NEW.user_id, NEW.points, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    ON CONFLICT(user_id) DO UPDATE SET total_points = total_points + NEW.points, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now');
END;

-- Notifications system
CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('system','event','workshop','certificate','points')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_type TEXT, -- e.g., 'event','certificate'
  related_id INTEGER,
  is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_related ON notifications(related_type, related_id);

-- Performance consideration indexes
-- Already have: users(role), certificates(user_id), events(start_datetime), workshops(start_datetime), points(user_id)
-- Add composite for frequent certificate review queries
CREATE INDEX idx_certificates_status_user ON certificates(status, user_id);

-- Views (optional convenience)
CREATE VIEW IF NOT EXISTS v_user_certificates AS
SELECT c.id, c.user_id, u.email, c.title, c.issued_date, c.status, c.reviewer_id, c.reviewed_at, c.created_at
FROM certificates c
JOIN users u ON u.id = c.user_id;

CREATE VIEW IF NOT EXISTS v_user_points AS
SELECT u.id as user_id, u.email, COALESCE(up.total_points,0) as total_points
FROM users u
LEFT JOIN user_points up ON up.user_id = u.id;
