/**
 * Usage: node scripts/import-csv.mjs events.csv diary.csv > import.sql
 * Logs counts and row-level validation errors to stderr without printing full diary bodies.
 */
import { readFile } from 'node:fs/promises';
const CATEGORIES = new Set(['breakfast','lunch','dinner','snack','wakeup','nap','bedtime','play','bath','poop','temp','other']);
const quote = v => v == null ? 'NULL' : `'${String(v).replaceAll("'", "''")}'`;
const validDate = v => /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(v+'T00:00:00Z').toISOString().slice(0,10) === v;
const validTime = v => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const validId = v => /^[a-zA-Z0-9_-]{1,80}$/.test(v);
function parseCsv(text) { const rows=[]; let row=[], cell='', q=false; for(let i=0;i<text.length;i++){const c=text[i], n=text[i+1]; if(q){ if(c==='"'&&n==='"'){cell+='"';i++;} else if(c==='"') q=false; else cell+=c; } else if(c==='"') q=true; else if(c===','){row.push(cell);cell='';} else if(c==='\n'){row.push(cell);rows.push(row);row=[];cell='';} else if(c!=='\r') cell+=c; } if(cell || row.length) { row.push(cell); rows.push(row); } if(q) throw new Error('Unclosed quoted field'); return rows; }
function normDate(v){ const m=String(v).trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/); if(!m)return null; const d=`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`; return validDate(d)?d:null; }
function normTime(v){ if(v == null || String(v).trim()==='') return null; const m=String(v).trim().match(/^(\d{1,2}):(\d{2})$/); if(!m)return undefined; const t=`${m[1].padStart(2,'0')}:${m[2]}`; return validTime(t)?t:undefined; }
function parseTimeline(v){ if(!v) return '[]'; try { const parsed=JSON.parse(v); if(!Array.isArray(parsed)) return null; for(const e of parsed){ if(typeof e !== 'object' || !CATEGORIES.has(e.category) || (e.start_time && !validTime(e.start_time)) || (e.start && !validTime(e.start))) return null; } return JSON.stringify(parsed); } catch { return null; } }
const [eventFile, diaryFile] = process.argv.slice(2); if(!eventFile || !diaryFile) throw new Error('events.csv and diary.csv are required');
const [eventCsv, diaryCsv] = await Promise.all([readFile(eventFile,'utf8'), readFile(diaryFile,'utf8')]);
let candidates=0, eventsOk=0, diariesOk=0, skipped=0; const errors=[];
console.log('BEGIN IMMEDIATE;');
console.log('PRAGMA foreign_keys = ON;');
for (const [i,row] of parseCsv(eventCsv).slice(1).entries()) { candidates++; const [id,rawDate,category,startRaw,endRaw,memo=''] = row; const d=normDate(rawDate), start=normTime(startRaw), end=normTime(endRaw); const reason=!validId(id)?'invalid id':!d?'invalid date':!CATEGORIES.has(category)?'invalid category':!start?'invalid start_time':end===undefined?'invalid end_time':memo.length>2000?'memo too long':null; if(reason){skipped++;errors.push({file:'events',line:i+2,reason});continue;} const key=`event:${id}`; console.log(`INSERT OR IGNORE INTO import_ledger(source_key) VALUES(${quote(key)});`); console.log(`INSERT INTO events(id,date,category,start_time,end_time,memo,created_by) SELECT ${quote(id)},${quote(d)},${quote(category)},${quote(start)},${quote(end)},${quote(memo)},(SELECT id FROM users WHERE disabled_at IS NULL ORDER BY created_at LIMIT 1) WHERE changes()=1 AND NOT EXISTS (SELECT 1 FROM events WHERE id=${quote(id)});`); eventsOk++; }
for (const [i,row] of parseCsv(diaryCsv).slice(1).entries()) { candidates++; const [rawDate,text='',timelineRaw='[]',weather=''] = row; const d=normDate(rawDate), timeline=parseTimeline(timelineRaw); const reason=!d?'invalid date':timeline==null?'invalid timeline JSON':text.length>12000?'diary too long':weather.length>40?'weather too long':null; if(reason){skipped++;errors.push({file:'diaries',line:i+2,reason});continue;} const key=`diary:${d}`; console.log(`INSERT OR IGNORE INTO import_ledger(source_key) VALUES(${quote(key)});`); console.log(`INSERT INTO diaries(date,text,timeline,weather,generated_by) SELECT ${quote(d)},${quote(text)},${quote(timeline)},${quote(weather||null)},(SELECT id FROM users WHERE disabled_at IS NULL ORDER BY created_at LIMIT 1) WHERE changes()=1 AND NOT EXISTS (SELECT 1 FROM diaries WHERE date=${quote(d)});`); diariesOk++; }
console.log('COMMIT;');
console.error(JSON.stringify({ candidates, events_ok: eventsOk, diaries_ok: diariesOk, skipped, errors }));
