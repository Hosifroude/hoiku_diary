import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function sqlite(db, sql) {
  return spawnSync('sqlite3', [db], { input: sql, encoding:'utf8' });
}

test('D1 migration time triggers allow valid times and reject non-digits or out-of-range values on insert and update', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'hoiku-d1-'));
  const db = join(dir, 'test.sqlite');
  try {
    for (const file of ['migrations/0001_initial.sql','migrations/0002_import_ledger.sql','migrations/0003_security_integrity.sql','migrations/0004_fix_event_time_triggers.sql']) {
      const sql = await readFile(file, 'utf8');
      const r = sqlite(db, sql);
      assert.equal(r.status, 0, `${file}: ${r.stderr}`);
    }
    assert.equal(sqlite(db, "INSERT INTO users(id,login_id,password_hash,active_slot) VALUES('u1','u1','hash',1);").status, 0);
    assert.equal(sqlite(db, "INSERT INTO events(id,date,category,start_time,end_time,memo,created_by) VALUES('zero','2026-07-20','play','00:00',NULL,'','u1');").status, 0);
    assert.equal(sqlite(db, "INSERT INTO events(id,date,category,start_time,end_time,memo,created_by) VALUES('ok','2026-07-20','play','23:59',NULL,'','u1');").status, 0);
    for (const value of ['24:00','29:59','0a:00','09:0a','aa:00','bad']) {
      const r = sqlite(db, `INSERT INTO events(id,date,category,start_time,end_time,memo,created_by) VALUES('s${value}','2026-07-20','play','${value}',NULL,'','u1');`);
      assert.notEqual(r.status, 0, `${value} should fail`);
    }
    for (const value of ['24:00','29:59','0a:00','09:0a','aa:00','bad']) {
      const r = sqlite(db, `UPDATE events SET start_time='${value}' WHERE id='ok';`);
      assert.notEqual(r.status, 0, `update ${value} should fail`);
    }
    for (const value of ['24:00','0a:00','09:0a']) {
      assert.notEqual(sqlite(db, `INSERT INTO events(id,date,category,start_time,end_time,memo,created_by) VALUES('e${value}','2026-07-20','play','09:00','${value}','','u1');`).status, 0);
    }
    for (const value of ['29:59','0a:00','09:0a']) {
      assert.notEqual(sqlite(db, `UPDATE events SET end_time='${value}' WHERE id='ok';`).status, 0);
    }
    assert.notEqual(sqlite(db, "UPDATE events SET category='evil' WHERE id='ok';").status, 0);
  } finally { await rm(dir, { recursive:true, force:true }); }
});
