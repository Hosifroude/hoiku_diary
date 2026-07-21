import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';

test('D1 migration time triggers allow valid times and reject non-digits or out-of-range values on insert and update', async () => {
  const db = new DatabaseSync(':memory:');
  try {
    for (const file of ['migrations/0001_initial.sql','migrations/0002_import_ledger.sql','migrations/0003_security_integrity.sql','migrations/0004_fix_event_time_triggers.sql']) {
      const sql = await readFile(file, 'utf8');
      db.exec(sql);
    }
    db.exec("INSERT INTO users(id,login_id,password_hash,active_slot) VALUES('u1','u1','hash',1);");
    db.exec("INSERT INTO events(id,date,category,start_time,end_time,memo,created_by) VALUES('zero','2026-07-20','play','00:00',NULL,'','u1');");
    db.exec("INSERT INTO events(id,date,category,start_time,end_time,memo,created_by) VALUES('ok','2026-07-20','play','23:59',NULL,'','u1');");
    for (const value of ['24:00','29:59','0a:00','09:0a','aa:00','bad']) {
      assert.throws(() => db.exec(`INSERT INTO events(id,date,category,start_time,end_time,memo,created_by) VALUES('s${value}','2026-07-20','play','${value}',NULL,'','u1');`), `${value} should fail`);
    }
    for (const value of ['24:00','29:59','0a:00','09:0a','aa:00','bad']) {
      assert.throws(() => db.exec(`UPDATE events SET start_time='${value}' WHERE id='ok';`), `update ${value} should fail`);
    }
    for (const value of ['24:00','0a:00','09:0a']) {
      assert.throws(() => db.exec(`INSERT INTO events(id,date,category,start_time,end_time,memo,created_by) VALUES('e${value}','2026-07-20','play','09:00','${value}','','u1');`));
    }
    for (const value of ['29:59','0a:00','09:0a']) {
      assert.throws(() => db.exec(`UPDATE events SET end_time='${value}' WHERE id='ok';`));
    }
    assert.throws(() => db.exec("UPDATE events SET category='evil' WHERE id='ok';"));
  } finally { db.close(); }
});
