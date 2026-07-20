import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('client uses safe DOM rendering and keeps mobile pickers', async () => {
  const html = await readFile('dist/index.html','utf8');
  assert.doesNotMatch(html, /innerHTML|prompt\(/);
  assert.match(html, /textContent/);
  assert.match(html, /replaceChildren/);
  assert.match(html, /timePickerOverlay/);
  assert.match(html, /datePickerOverlay/);
  assert.doesNotMatch(html, /apiKeyInput|settingsGasUrl|settingsGasPassword|anthropic-dangerous-direct-browser-access|script\.google\.com/);
});

test('worker contains server-side validation and request protections', async () => {
  const worker = await readFile('worker/src/index.ts','utf8');
  for (const category of ['breakfast','lunch','dinner','snack','wakeup','nap','bedtime','play','bath','poop','temp','other']) assert.match(worker, new RegExp(category));
  assert.match(worker, /PBKDF2/);
  assert.match(worker, /digest\(token \+ env\.SESSION_SECRET\)/);
  assert.match(worker, /HttpOnly; Secure; SameSite=Strict/);
  assert.match(worker, /validOrigin\(request, env\)/);
  assert.match(worker, /content-length/);
  assert.match(worker, /assertUnlocked\(env,d\)/);
  assert.match(worker, /created_by !== user\.id/);
});

test('migration adds account slot uniqueness, indexes, category and lock guards', async () => {
  const sql = await readFile('migrations/0003_security_integrity.sql','utf8');
  assert.match(sql, /account_slots/);
  assert.match(sql, /users_active_slot_unique/);
  assert.match(sql, /sessions_expires_idx/);
  assert.match(sql, /events_category_allowed_insert/);
  assert.match(sql, /events_locked_guard_insert/);
  assert.match(sql, /diaries_locked_guard_update/);
});

test('CSV importer handles RFC4180 fields and validates rows', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'hoiku-csv-'));
  try {
    const events = join(dir, 'events.csv'), diaries = join(dir, 'diaries.csv');
    await writeFile(events, 'id,date,category,start,end,memo\ne1,2026-07-20,play,09:00,,"砂場, \"\"山\"\"\n日本語"\nbad,2026-02-30,evil,99:99,,x\n');
    await writeFile(diaries, 'date,text,timeline,weather\n2026-07-20,"本文\n続き","[{""category"":""play"",""start_time"":""09:00"",""memo"":""x""}]",晴れ\n2026-07-21,x,"{}",晴れ\n');
    const r = spawnSync(process.execPath, ['scripts/import-csv.mjs', events, diaries], { encoding:'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /BEGIN IMMEDIATE;/);
    assert.match(r.stdout, /COMMIT;/);
    assert.match(r.stdout, /砂場, \"山\"/);
    assert.match(r.stdout, /NULL/);
    assert.match(r.stdout, /INSERT OR IGNORE INTO import_ledger/);
    const summary = JSON.parse(r.stderr.trim());
    assert.equal(summary.candidates, 4);
    assert.equal(summary.events_ok, 1);
    assert.equal(summary.diaries_ok, 1);
    assert.equal(summary.skipped, 2);
  } finally { await rm(dir, { recursive:true, force:true }); }
});
