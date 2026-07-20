PRAGMA foreign_keys = ON;
DROP TRIGGER IF EXISTS events_category_allowed_insert;
DROP TRIGGER IF EXISTS events_category_allowed_update;
CREATE TRIGGER events_category_allowed_insert BEFORE INSERT ON events BEGIN
  SELECT CASE WHEN NEW.category NOT IN ('breakfast','lunch','dinner','snack','wakeup','nap','bedtime','play','bath','poop','temp','other') THEN RAISE(ABORT,'invalid category') END;
  SELECT CASE WHEN NOT (length(NEW.start_time)=5 AND substr(NEW.start_time,3,1)=':' AND substr(NEW.start_time,1,2) BETWEEN '00' AND '23' AND substr(NEW.start_time,4,2) BETWEEN '00' AND '59') THEN RAISE(ABORT,'invalid start_time') END;
  SELECT CASE WHEN NEW.end_time IS NOT NULL AND NOT (length(NEW.end_time)=5 AND substr(NEW.end_time,3,1)=':' AND substr(NEW.end_time,1,2) BETWEEN '00' AND '23' AND substr(NEW.end_time,4,2) BETWEEN '00' AND '59') THEN RAISE(ABORT,'invalid end_time') END;
END;
CREATE TRIGGER events_category_allowed_update BEFORE UPDATE ON events BEGIN
  SELECT CASE WHEN NEW.category NOT IN ('breakfast','lunch','dinner','snack','wakeup','nap','bedtime','play','bath','poop','temp','other') THEN RAISE(ABORT,'invalid category') END;
  SELECT CASE WHEN NOT (length(NEW.start_time)=5 AND substr(NEW.start_time,3,1)=':' AND substr(NEW.start_time,1,2) BETWEEN '00' AND '23' AND substr(NEW.start_time,4,2) BETWEEN '00' AND '59') THEN RAISE(ABORT,'invalid start_time') END;
  SELECT CASE WHEN NEW.end_time IS NOT NULL AND NOT (length(NEW.end_time)=5 AND substr(NEW.end_time,3,1)=':' AND substr(NEW.end_time,1,2) BETWEEN '00' AND '23' AND substr(NEW.end_time,4,2) BETWEEN '00' AND '59') THEN RAISE(ABORT,'invalid end_time') END;
END;
