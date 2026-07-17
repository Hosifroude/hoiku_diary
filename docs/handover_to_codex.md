# ほいくにっき 開発引き継ぎドキュメント

> この文書は旧GAS構成の引き継ぎ資料です。現在の実装は `index.html` と `gas/Code.gs` を正としてください。秘密情報はGitHubに保存しません。

## プロジェクト概要

保育園に通う子供の日常イベントを記録し、Claude AIが日記を自動生成するWebアプリ。
夫婦2台のiPhoneでリアルタイム同期が可能。

---

## 公開情報

| 項目 | 値 |
|---|---|
| GitHub リポジトリ | https://github.com/Hosifroude/hoiku_diary |
| 公開URL | https://Hosifroude.github.io/hoiku_diary/ |
| Googleスプレッドシート | https://docs.google.com/spreadsheets/d/1z2ubnPp8iiXNp0jT8KtkLNCzNpGlbSajdZ6b-B0ZmPI |

---

## 技術スタック

- **フロントエンド**: HTML / CSS / JavaScript（単一ファイル構成）
- **バックエンド**: Google Apps Script（GAS）
- **データ保存**: Googleスプレッドシート + localStorage
- **AI**: Claude API（claude-sonnet-4-20250514）
- **ホスティング**: GitHub Pages

---

## ファイル構成

```
hoiku_diary/
└── index.html          ← アプリ本体（HTML + CSS + JavaScript 全1642行）

Googleスプレッドシート/
├── events シート       ← イベント記録（日付・カテゴリ・時刻・メモ）
└── diary シート        ← 生成日記（初回生成時に自動作成）

Google Apps Script/
└── doPost関数          ← REST API（save/delete/getAll/saveDiary/getDiary）
```

---

## セキュリティ設計

**重要：以下の情報はコードに書かずlocalStorageで管理している**

| 情報 | localStorageキー | 設定場所 |
|---|---|---|
| Claude APIキー | `hoiku_api_key` | 日記タブ or 設定タブ |
| GAS ID | `hoiku_gas_url` | 設定タブ（IDのみ入力、URLは自動組み立て） |
| 同期パスワード | `hoiku_gas_password` | 設定タブ |

GAS IDからURLの組み立て：
```javascript
GAS_URL = 'https://script.google.com/macros/s/' + GAS_ID + '/exec'
```

GAS側でパスワード認証を実装済み：
```javascript
const ACCESS_PASSWORD = PropertiesService.getScriptProperties().getProperty('ACCESS_PASSWORD'); // GASスクリプト内に定義
if (data.password !== ACCESS_PASSWORD) {
  return error('unauthorized');
}
```

---

## アプリの主要機能

### 1. イベント記録
- カテゴリ選択（11種類）
- 独自時刻ピッカー（iOSネイティブUIを使わない）
- メモ入力（任意）
- 記録後すぐ画面に反映（楽観的UI更新）

### 2. カテゴリ一覧

| グループ | カテゴリ |
|---|---|
| 食事 | breakfast / lunch / dinner / snack |
| 睡眠 | wakeup / nap / bedtime |
| 生活 | play / bath / poop / temp / other |

### 3. 日記生成
- Claude APIでイベント記録をもとに日記文を生成
- 出力形式：タイムライン（時系列リスト）+ 日記文の2段構成
- 過去日付の再生成可能
- 生成した日記はlocalStorage + GASのdiaryシートに保存

### 4. データ同期
- 記録・削除時にGASのeventsシートへ自動同期
- 「最新を取得」ボタンでGASから最新データを取得
- オフライン対応：送信失敗した操作をsyncQueueに積み、電波回復後に自動再送

### 5. 日付切り替え
- ヘッダーの日付をタップでカレンダー表示
- 過去日付に切り替えるとその日のイベント・日記を表示
- 未来日付は選択不可

### 6. 天気記録
- ヘッダーに晴れ/くもり/雨/雪ボタン
- 選択した天気は日記生成プロンプトに反映

---

## GAS API仕様

**エンドポイント**: `https://script.google.com/macros/s/{ID}/exec`  
**メソッド**: POST  
**認証**: 全リクエストに `password` フィールドが必要

### リクエスト一覧

```javascript
// イベント保存
{ action: 'save', event: { id, date, category, start, end, memo }, password }

// イベント削除
{ action: 'delete', id: '...', password }

// イベント取得
{ action: 'getAll', date: '2026-3-28', password }

// 日記保存
{ action: 'saveDiary', date: '2026-3-28', diary: { text, timeline }, password }

// 日記取得
{ action: 'getDiary', date: '2026-3-28', password }
```

### レスポンス形式

```javascript
// 成功
{ status: 'ok', data: ... }

// 失敗
{ status: 'error', message: '...' }

// 認証失敗
{ status: 'error', message: 'unauthorized' }
```

---

## localStorageキー一覧

| キー | 内容 |
|---|---|
| `hoiku_events_YYYY-M-D` | その日のイベント配列（JSON） |
| `hoiku_diary_YYYY-M-D` | その日の日記データ { text, timeline }（JSON） |
| `hoiku_weather_YYYY-M-D` | その日の天気 |
| `hoiku_api_key` | Claude APIキー |
| `hoiku_gas_url` | GAS ID（URLではなくIDのみ） |
| `hoiku_gas_password` | GAS同期パスワード |
| `hoiku_child_name` | 子供の名前 |
| `hoiku_child_birthday` | 子供の誕生日 |
| `hoiku_generate_time` | 自動生成時刻 |
| `hoiku_sync_queue` | 未送信の操作キュー（JSON） |
| `hoiku_last_auto` | 最後に自動生成した日付 |

---

## 主要JavaScript関数一覧

| 関数名 | 役割 |
|---|---|
| `init()` | アプリ起動時の初期化・localStorageからの復元 |
| `switchTab(name)` | タブ切り替え |
| `addEvent()` | イベント記録（ローカル保存 + GAS送信） |
| `deleteEvent(id)` | イベント削除（ローカル + GAS） |
| `renderEvents()` | 一覧画面の描画 |
| `loadEventsFromGAS()` | GASからイベントを取得 |
| `saveEventToGAS(ev)` | GASにイベントを保存 |
| `deleteEventFromGAS(id)` | GASからイベントを削除 |
| `generateDiary()` | Claude APIで日記生成 |
| `loadDiaryForDate(dateKey)` | 指定日の日記を読み込み |
| `renderDiaryDisplay(text, timeline)` | 日記の2段表示を描画 |
| `saveDiaryToGAS(dateKey, data)` | GASに日記を保存 |
| `loadDiaryFromGAS(dateKey)` | GASから日記を取得 |
| `processQueue()` | 未送信キューを処理 |
| `openDatePicker()` | カレンダーを表示 |
| `selectDate(year, month, day)` | 日付を切り替え |
| `openTimePicker(target)` | 時刻ピッカーを表示 |
| `setPickerNow()` | 時刻ピッカーに現在時刻をセット |
| `selectWeather(btn)` | 天気を選択 |
| `saveSettings()` | 設定を保存 |
| `updateAge()` | 年齢を自動計算 |
| `showSync(text)` | 同期インジケーターを表示 |
| `hideSync()` | 同期インジケーターを非表示 |
| `showToast(msg)` | トースト通知を表示 |

---

## スプレッドシート構造

### eventsシート

| 列 | 内容 | 型 |
|---|---|---|
| A | id | 数値（Date.now()） |
| B | date | 文字列 or 日付型（自動変換される） |
| C | category | 文字列 |
| D | start | 文字列 or 時刻型（自動変換される） |
| E | end | 文字列 or 時刻型（自動変換される） |
| F | memo | 文字列 |
| G | createdAt | ISO8601文字列 |

**注意**: スプレッドシートがB/D/E列を自動的に日付型・時刻型に変換するため、GAS側で`constructor.name === 'Date'`で判定して文字列に変換する処理が必要。`instanceof Date`はGASの実行環境では動作しない。

### diaryシート（初回生成時に自動作成）

| 列 | 内容 |
|---|---|
| A | date（YYYY-M-D形式） |
| B | text（日記文） |
| C | timeline（イベント配列のJSON文字列） |
| D | updatedAt（ISO8601） |

---

## 既知の問題・注意点

1. **スプレッドシートの型変換問題**  
   B列（日付）・D/E列（時刻）がGoogleスプレッドシートにより自動的に型変換される。GAS側で`constructor.name === 'Date'`を使って対処済み。

2. **GASのデプロイ更新が必要**  
   GASのコードを変更しても、デプロイを「新しいバージョン」で更新しないと反映されない。

3. **オフライン時の同期**  
   電波なしで操作した内容はsyncQueueに積まれ、電波回復時・アプリ起動時に自動送信される。削除操作もキューに積まれる。

4. **日記の同期方向**  
   日記はlocalStorage優先で表示される。別端末で生成した日記はGASから取得する必要があり、localStorageにない場合のみGASに問い合わせる。

5. **カレンダーの月またぎ**  
   pickerMonthはDateオブジェクトで管理。setMonth()で月を変更すると日付が翌月にずれることがある（例：1月31日の翌月は3月2日になる）。必要に応じて修正を検討。

---

## 今後の実装候補

- 通知機能（設定時刻に日記生成を促すプッシュ通知）
- 写真添付（Googleドライブ連携）
- 月次サマリー生成
- 複数の子供への対応
- 奥さん側での日記生成（現在はAPIキーが必要）

---

## GASコードの最新版

```javascript
const SHEET_ID = '1z2ubnPp8iiXNp0jT8KtkLNCzNpGlbSajdZ6b-B0ZmPI';
const SHEET_NAME = 'events';
const DIARY_SHEET_NAME = 'diary';
const ACCESS_PASSWORD = PropertiesService.getScriptProperties().getProperty('ACCESS_PASSWORD');

function doPost(e) {
  try {
    const raw = e.postData ? e.postData.contents : '{}';
    const data = JSON.parse(raw);
    const action = data.action;

    if (data.password !== ACCESS_PASSWORD) {
      return error('unauthorized');
    }

    if (action === 'save')       { saveEvent(data.event);            return ok('saved'); }
    if (action === 'delete')     { deleteEvent(data.id);             return ok('deleted'); }
    if (action === 'getAll')     { return ok(getEvents(data.date)); }
    if (action === 'saveDiary')  { saveDiary(data.date, data.diary); return ok('saved'); }
    if (action === 'getDiary')   { return ok(getDiary(data.date)); }
    return error('unknown action: ' + action);
  } catch(err) {
    return error(err.message);
  }
}

function doGet(e) { return ok('GAS is running'); }

function getOrCreateSheet(name) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (name === DIARY_SHEET_NAME) {
      sheet.appendRow(['date', 'text', 'timeline', 'updatedAt']);
    }
  }
  return sheet;
}

function saveEvent(ev) {
  const sheet = getOrCreateSheet(SHEET_NAME);
  sheet.appendRow([ev.id, ev.date, ev.category, ev.start, ev.end, ev.memo, new Date().toISOString()]);
}

function deleteEvent(id) {
  const sheet = getOrCreateSheet(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === String(id)) { sheet.deleteRow(i + 1); break; }
  }
}

function getEvents(date) {
  const sheet = getOrCreateSheet(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const result = [];
  for (let i = 1; i < data.length; i++) {
    const cell = data[i][1];
    let cellDate = '';
    if (cell && cell.constructor && cell.constructor.name === 'Date') {
      cellDate = cell.getFullYear() + '-' + (cell.getMonth()+1) + '-' + cell.getDate();
    } else {
      cellDate = String(cell).trim();
    }
    if (cellDate === String(date).trim()) {
      result.push({
        id: String(data[i][0]), date: cellDate,
        category: String(data[i][2]),
        start: formatTimeValue(data[i][3]),
        end: formatTimeValue(data[i][4]),
        memo: String(data[i][5])
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
        dateStr, diary.text, JSON.stringify(diary.timeline), new Date().toISOString()
      ]]);
      return;
    }
  }
  sheet.appendRow([dateStr, diary.text, JSON.stringify(diary.timeline), new Date().toISOString()]);
}

function getDiary(date) {
  const sheet = getOrCreateSheet(DIARY_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const dateStr = String(date);
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === dateStr) {
      return {
        text: String(data[i][1]),
        timeline: JSON.parse(data[i][2] || '[]')
      };
    }
  }
  return null;
}

function formatTimeValue(val) {
  if (!val) return '';
  if (val && val.constructor && val.constructor.name === 'Date') {
    return String(val.getHours()).padStart(2,'0') + ':' + String(val.getMinutes()).padStart(2,'0');
  }
  const s = String(val).trim();
  if (/^\d:\d{2}$/.test(s)) return '0' + s;
  return s;
}

function ok(data) {
  return ContentService.createTextOutput(JSON.stringify({ status: 'ok', data: data })).setMimeType(ContentService.MimeType.JSON);
}

function error(msg) {
  return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: msg })).setMimeType(ContentService.MimeType.JSON);
}
```
