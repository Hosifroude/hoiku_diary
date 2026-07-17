/**
 * Prepare normalized, idempotent SQL for a D1 import. It never contacts Google
 * and requires operators to export the spreadsheet CSV themselves.
 * Usage: node scripts/import-csv.mjs events.csv diary.csv > import.sql
 */
import { readFile } from 'node:fs/promises';
const quote = value => `'${String(value ?? '').replaceAll("'", "''")}'`;
const rows = text => text.trim().split(/\r?\n/).slice(1).map(line => line.split(',').map(x => x.trim().replace(/^"|"$/g, '')));
const date = value => { const m=String(value).match(/(\d{4})\D(\d{1,2})\D(\d{1,2})/); return m ? `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}` : null; };
const time = value => { const m=String(value||'').match(/(\d{1,2}):(\d{2})/); return m ? `${m[1].padStart(2,'0')}:${m[2]}` : ''; };
const [eventCsv, diaryCsv] = await Promise.all(process.argv.slice(2).map(readFile)); let ok=0, failed=[];
console.log('BEGIN IMMEDIATE;');
for (const [n,row] of rows(eventCsv.toString()).entries()) { const [id,rawDate,category,start,end,memo] = row, d=date(rawDate); if(!id||!d||!category||!time(start)){failed.push(`events line ${n+2}`);continue;} const key=`event:${id}`; console.log(`INSERT OR IGNORE INTO import_ledger(source_key) VALUES(${quote(key)});`); console.log(`INSERT INTO events(id,date,category,start_time,end_time,memo,created_by) SELECT ${quote(id)},${quote(d)},${quote(category)},${quote(time(start))},${quote(time(end)||null)},${quote(memo)},(SELECT id FROM users ORDER BY created_at LIMIT 1) WHERE changes()=1;`);ok++; }
for (const [n,row] of rows(diaryCsv.toString()).entries()) { const [rawDate,text,timeline] = row,d=date(rawDate); if(!d){failed.push(`diary line ${n+2}`);continue;} const key=`diary:${d}`; console.log(`INSERT OR IGNORE INTO import_ledger(source_key) VALUES(${quote(key)});`); console.log(`INSERT INTO diaries(date,text,timeline,generated_by) SELECT ${quote(d)},${quote(text)},${quote(timeline||'[]')},(SELECT id FROM users ORDER BY created_at LIMIT 1) WHERE changes()=1;`);ok++; }
console.log('COMMIT;'); console.error(JSON.stringify({ imported_candidates:ok, failed_rows:failed }));
