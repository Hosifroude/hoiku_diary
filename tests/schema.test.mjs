import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
test('migration contains required protected tables and constraints', async () => {
 const sql=await readFile('migrations/0001_initial.sql','utf8');
 for(const table of ['users','sessions','events','diaries','day_locks']) assert.match(sql,new RegExp(`CREATE TABLE ${table}`));
 assert.match(sql,/login_id TEXT NOT NULL COLLATE NOCASE UNIQUE/); assert.match(sql,/REFERENCES users/);
});
test('published client does not contain legacy credentials or browser Claude requests', async () => {
 const html=await readFile('dist/index.html','utf8'); const worker=await readFile('worker/src/index.ts','utf8');
 assert.doesNotMatch(html,/Sosuke2024|api\.anthropic\.com/); assert.match(worker,/HttpOnly/);
});
