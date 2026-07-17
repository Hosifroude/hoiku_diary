const SHEET_ID = '1z2ubnPp8iiXNp0jT8KtkLNCzNpGlbSajdZ6b-B0ZmPI';
const SHEET_NAME = 'events';
const DIARY_SHEET_NAME = 'diary';
const LOCK_SHEET_NAME = 'locks';
const ACCESS_PASSWORD = PropertiesService.getScriptProperties().getProperty('ACCESS_PASSWORD');

function doPost(e) {
  try {
    const raw = e.postData ? e.postData.contents : '{}';
    const data = JSON.parse(raw);
    const action = data.action;

    if (data.password !== ACCESS_PASSWORD) {
      return error('unauthorized');
    }

    if (action === 'setLock') {
      setLock(data.date, data.locked);
      return ok('locked');
    }
    if (action === 'getLock') {
      return ok(getLock(data.date));
    }

    if (['save', 'delete', 'saveDiary'].includes(action)) {
      const date = data.date || (data.event && data.event.date) || getEventDateById(data.id);
      if (date && getLock(date)) {
        return error('locked');
      }
    }

    if (action === 'save') {
      saveEvent(data.event);
      return ok('saved');
    }
    if (action === 'delete') {
      deleteEvent(data.id);
      return ok('deleted');
    }
    if (action === 'getAll') {
      return ok(getEvents(data.date));
    }
    if (action === 'saveDiary') {
      saveDiary(data.date, data.diary);
      return ok('saved');
    }
    if (action === 'getDiary') {
      return ok(getDiary(data.date));
    }

    return error('unknown action: ' + action);
  } catch(err) {
    return error(err.message);
  }
}

function doGet(e) {
  return ok('GAS is running');
}

function getOrCreateSheet(name) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(name);

  if (!sheet) {
    sheet = ss.insertSheet(name);

    if (name === SHEET_NAME) {
      sheet.appendRow(['id', 'date', 'category', 'start', 'end', 'memo', 'createdAt']);
    }
    if (name === DIARY_SHEET_NAME) {
      sheet.appendRow(['date', 'text', 'timeline', 'updatedAt']);
    }
    if (name === LOCK_SHEET_NAME) {
      sheet.appendRow(['date', 'locked', 'updatedAt']);
    }
  }

  return sheet;
}

function saveEvent(ev) {
  if (!ev || !ev.id) throw new Error('event.id is required');
  if (!ev.date) throw new Error('event.date is required');

  const sheet = getOrCreateSheet(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const idStr = String(ev.id);
  const row = [
    ev.id,
    ev.date,
    ev.category,
    ev.start,
    ev.end,
    ev.memo,
    new Date().toISOString()
  ];

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === idStr) {
      sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
      return;
    }
  }

  sheet.appendRow(row);
}

function deleteEvent(id) {
  const sheet = getOrCreateSheet(SHEET_NAME);
  const data = sheet.getDataRange().getValues();

  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
}

function getEventDateById(id) {
  if (!id) return '';

  const sheet = getOrCreateSheet(SHEET_NAME);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      return normalizeDateValue(data[i][1]);
    }
  }

  return '';
}

function getEvents(date) {
  const sheet = getOrCreateSheet(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const dateStr = String(date).trim();
  const result = [];

  for (let i = 1; i < data.length; i++) {
    const cellDate = normalizeDateValue(data[i][1]);

    if (cellDate === dateStr) {
      result.push({
        id: String(data[i][0]),
        date: cellDate,
        category: String(data[i][2]),
        start: formatTimeValue(data[i][3]),
        end: formatTimeValue(data[i][4]),
        memo: String(data[i][5] || '')
      });
    }
  }

  return result;
}

function saveDiary(date, diary) {
  const sheet = getOrCreateSheet(DIARY_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const dateStr = String(date);

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === dateStr) {
      sheet.getRange(i + 1, 1, 1, 4).setValues([[
        dateStr,
        diary.text,
        JSON.stringify(diary.timeline || []),
        new Date().toISOString()
      ]]);
      return;
    }
  }

  sheet.appendRow([
    dateStr,
    diary.text,
    JSON.stringify(diary.timeline || []),
    new Date().toISOString()
  ]);
}

function getDiary(date) {
  const sheet = getOrCreateSheet(DIARY_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const dateStr = String(date);

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === dateStr) {
      return {
        text: String(data[i][1] || ''),
        timeline: JSON.parse(data[i][2] || '[]')
      };
    }
  }

  return null;
}

function setLock(date, locked) {
  const sheet = getOrCreateSheet(LOCK_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const dateStr = String(date);
  const lockValue = locked === true || String(locked).toLowerCase() === 'true';

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === dateStr) {
      sheet.getRange(i + 1, 1, 1, 3).setValues([[
        dateStr,
        lockValue,
        new Date().toISOString()
      ]]);
      return;
    }
  }

  sheet.appendRow([dateStr, lockValue, new Date().toISOString()]);
}

function getLock(date) {
  const sheet = getOrCreateSheet(LOCK_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const dateStr = String(date);

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === dateStr) {
      return data[i][1] === true || String(data[i][1]).toLowerCase() === 'true';
    }
  }

  return false;
}

function normalizeDateValue(val) {
  if (!val) return '';

  if (val && val.constructor && val.constructor.name === 'Date') {
    return val.getFullYear() + '-' + (val.getMonth() + 1) + '-' + val.getDate();
  }

  return String(val).trim();
}

function formatTimeValue(val) {
  if (!val) return '';

  if (val && val.constructor && val.constructor.name === 'Date') {
    return String(val.getHours()).padStart(2, '0') + ':' + String(val.getMinutes()).padStart(2, '0');
  }

  const s = String(val).trim();
  if (/^\d:\d{2}$/.test(s)) return '0' + s;
  return s;
}

function ok(data) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', data: data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function error(msg) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'error', message: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}
