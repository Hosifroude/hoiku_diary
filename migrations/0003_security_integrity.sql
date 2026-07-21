PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS account_slots (slot INTEGER PRIMARY KEY CHECK(slot IN (1,2)));
INSERT OR IGNORE INTO account_slots(slot) VALUES (1),(2);
ALTER TABLE users ADD COLUMN active_slot INTEGER REFERENCES account_slots(slot);
CREATE UNIQUE INDEX IF NOT EXISTS users_active_slot_unique ON users(active_slot) WHERE disabled_at IS NULL;
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS rate_limits_window_idx ON rate_limits(window_started_at);
CREATE INDEX IF NOT EXISTS day_locks_locked_idx ON day_locks(locked, date);
CREATE INDEX IF NOT EXISTS events_created_by_idx ON events(created_by, date);
CREATE TRIGGER IF NOT EXISTS events_category_allowed_insert BEFORE INSERT ON events BEGIN
  SELECT CASE WHEN NEW.category NOT IN ('breakfast','lunch','dinner','snack','wakeup','nap','bedtime','play','bath','poop','temp','other') THEN RAISE(ABORT,'invalid category') END;
  SELECT CASE WHEN NOT (NEW.start_time GLOB '[0-9][0-9]:[0-9][0-9]' AND length(NEW.start_time)=5 AND substr(NEW.start_time,3,1)=':' AND substr(NEW.start_time,1,2) BETWEEN '00' AND '23' AND substr(NEW.start_time,4,2) BETWEEN '00' AND '59') THEN RAISE(ABORT,'invalid start_time') END;
  SELECT CASE WHEN NEW.end_time IS NOT NULL AND NOT (NEW.end_time GLOB '[0-9][0-9]:[0-9][0-9]' AND length(NEW.end_time)=5 AND substr(NEW.end_time,3,1)=':' AND substr(NEW.end_time,1,2) BETWEEN '00' AND '23' AND substr(NEW.end_time,4,2) BETWEEN '00' AND '59') THEN RAISE(ABORT,'invalid end_time') END;
END;
CREATE TRIGGER IF NOT EXISTS events_category_allowed_update BEFORE UPDATE ON events BEGIN
  SELECT CASE WHEN NEW.category NOT IN ('breakfast','lunch','dinner','snack','wakeup','nap','bedtime','play','bath','poop','temp','other') THEN RAISE(ABORT,'invalid category') END;
  SELECT CASE WHEN NOT (NEW.start_time GLOB '[0-9][0-9]:[0-9][0-9]' AND length(NEW.start_time)=5 AND substr(NEW.start_time,3,1)=':' AND substr(NEW.start_time,1,2) BETWEEN '00' AND '23' AND substr(NEW.start_time,4,2) BETWEEN '00' AND '59') THEN RAISE(ABORT,'invalid start_time') END;
  SELECT CASE WHEN NEW.end_time IS NOT NULL AND NOT (NEW.end_time GLOB '[0-9][0-9]:[0-9][0-9]' AND length(NEW.end_time)=5 AND substr(NEW.end_time,3,1)=':' AND substr(NEW.end_time,1,2) BETWEEN '00' AND '23' AND substr(NEW.end_time,4,2) BETWEEN '00' AND '59') THEN RAISE(ABORT,'invalid end_time') END;
END;
CREATE TRIGGER IF NOT EXISTS events_locked_guard_insert BEFORE INSERT ON events WHEN EXISTS (SELECT 1 FROM day_locks WHERE date=NEW.date AND locked=1) BEGIN SELECT RAISE(ABORT,'day locked'); END;
CREATE TRIGGER IF NOT EXISTS events_locked_guard_update BEFORE UPDATE ON events WHEN EXISTS (SELECT 1 FROM day_locks WHERE date=NEW.date AND locked=1) BEGIN SELECT RAISE(ABORT,'day locked'); END;
CREATE TRIGGER IF NOT EXISTS events_locked_guard_delete BEFORE DELETE ON events WHEN EXISTS (SELECT 1 FROM day_locks WHERE date=OLD.date AND locked=1) BEGIN SELECT RAISE(ABORT,'day locked'); END;
CREATE TRIGGER IF NOT EXISTS diaries_locked_guard_insert BEFORE INSERT ON diaries WHEN EXISTS (SELECT 1 FROM day_locks WHERE date=NEW.date AND locked=1) BEGIN SELECT RAISE(ABORT,'day locked'); END;
CREATE TRIGGER IF NOT EXISTS diaries_locked_guard_update BEFORE UPDATE ON diaries WHEN EXISTS (SELECT 1 FROM day_locks WHERE date=NEW.date AND locked=1) BEGIN SELECT RAISE(ABORT,'day locked'); END;
