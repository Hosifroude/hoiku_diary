# ほいくにっき（ChatGPT Sites 移行版）

GitHub をソースの正本とし、ChatGPT Sites の Cloudflare Workers 互換サーバー、D1、将来用の R2 で運用する構成です。ブラウザは `/api` だけを呼び、Claude API と認証情報はサーバーの非公開ランタイム設定からのみ使用します。

## ローカル確認

`npm run build` は静的クライアントを `dist/` に出力します。Worker の実行・D1 の適用は Sites/Workers の管理画面または対応 CLI で行い、`migrations/0001_initial.sql`、続いて `0002_import_ledger.sql` を適用してください。`npm test` は移行補助の形式チェックを実行します。

## Sites 公開前の設定

`.openai/hosting.json` の D1 論理バインディング `DB` を対象の D1 に結びます。公開前に次の**値を GitHub に保存せず**ランタイム秘密情報として設定します。

* `FAMILY_INVITE_CODE` — 初回登録の家族用招待コード。
* `ANTHROPIC_API_KEY` — Claude API キー。
* `SESSION_SECRET` — 十分にランダムなセッション・トークン保護用秘密値。
* `CLAUDE_MODEL` — 任意の非秘密設定（例: 使用する Claude モデル名）。

Sites でビルド設定を読み込み、D1 バインディングと上記設定を投入してからプレビューし、問題なければ Sites 側で公開します。このリポジトリからデプロイはしません。初回は各利用者が「初回登録」から別々の ID、12 文字以上のパスワード、招待コードを入れます。有効アカウントは 2 名までです。

## 既存データの移行

GAS とスプレッドシートは削除・変更しません。管理者がシートを CSV としてローカルにエクスポートし、最初の Sites アカウントを作った後に `node scripts/import-csv.mjs events.csv diary.csv > import.sql` を実行します。生成された SQL をレビューして D1 に適用してください。`import_ledger` により同じ source key は再実行しても重複しません。標準エラーの JSON に候補件数と失敗行が出ます。CSV の引用符を含むメモは、実行前に RFC 4180 対応ツールで検証してください。

## 切替・ロールバック

Sites のプレビューで 2 台の端末のログイン、同期、固定、オフライン再送を確認してから公開します。移行後に GAS/スプレッドシートを止める場合は、D1 のバックアップと読み取り確認を済ませ、GAS デプロイを無効化して共有設定を撤去します。問題時は Sites の公開を前のデプロイへ戻し、GAS は変更していないため旧 URL を暫定的に再公開できます。

> **セキュリティ注意:** 旧クライアントにあった同期資格情報は漏えい済みとして扱い、GAS 側で必ず無効化・変更してください。履歴は破壊的に書き換えません。

## Sites / D1 移行後の運用メモ

GitHub リポジトリをソースコードの正本とし、Sites は `dist/index.html` を公開します。ブラウザには旧 GAS 資格情報、旧同期パスワード、Claude/Anthropic API キーを保存しません。Claude 呼び出しは Worker の `/api/diaries/generate` だけが `ANTHROPIC_API_KEY` を使って実行します。

### 非公開ランタイム設定

Sites / Worker には `FAMILY_INVITE_CODE`, `ANTHROPIC_API_KEY`, `SESSION_SECRET`, 任意の `CLAUDE_MODEL`, 必要に応じて `ALLOWED_ORIGINS` を秘密値として設定してください。これらを GitHub、PR 本文、ログ、公開 HTML に保存しないでください。

### D1 マイグレーション

適用順は `migrations/0001_initial.sql`, `migrations/0002_import_ledger.sql`, `migrations/0003_security_integrity.sql` です。D1 の適用履歴または運用台帳で一度だけ適用されたことを管理し、適用前に D1 のバックアップを取得してください。適用後は users/events/diaries/day_locks/import_ledger の件数、`sessions_expires_idx`、`users_active_slot_unique`、固定日ガードトリガーの存在を確認します。ロールバックはバックアップからの復元を基本とし、本番 DB に直接破壊的変更を加えないでください。

### 初回登録と 2 アカウント制限

初回登録画面で家族用招待コードを入力して登録します。有効アカウントは D1 の `account_slots` と `users_active_slot_unique` により最大 2 名です。3 人目、同一ログイン ID、同時登録競合は一定のエラーで拒否します。

### 固定日の扱い

固定中はイベント追加・削除、天気変更、日記生成・保存をサーバー側でも拒否します。CSV 移行は通常 API とは別の管理作業です。固定済みの日のデータを上書きする可能性があるため、生成 SQL を必ず確認し、移行対象日と既存件数を照合してから D1 に適用してください。

### オフラインキュー

オフラインキューにはイベント追加・削除のみを保存し、パスワード、API キー、招待コードは保存しません。ネットワーク障害などサーバーへ到達できない場合だけ自動再送します。`400`, `403`, `409`, `423` は再送しても成功しないためキューから除外します。`401` は操作を保持して再ログインを促します。`423` は固定日の操作として通知し自動再送を停止します。イベント ID は冪等キーで、追加前に削除した場合は追加と削除を相殺します。2 端末から同じイベント ID を別ユーザーが送った場合は競合として拒否します。

### CSV 形式と移行手順

旧スプレッドシートから events CSV は `id,date,category,start,end,memo`、diaries CSV は `date,text,timeline,weather` の列で出力します。CSV は RFC 4180 形式で、カンマ、二重引用符、改行を含める場合は引用符で囲み、引用符は二重化してください。`node scripts/import-csv.mjs events.csv diaries.csv > import.sql` で SQL を生成し、stderr の candidates / ok / skipped / errors を確認します。生成 SQL は `BEGIN IMMEDIATE` と `COMMIT` を含み、`import_ledger` と既存レコード確認により再実行時の重複を避けます。実際の D1 適用前に SQL 全体、除外行、移行前後の events/diaries 件数を確認してください。

### Sites プレビュー確認チェックリスト

1. Sites プレビューでログイン前に認証ゲートが出ること。
2. 初回登録、2 名までの登録、3 人目拒否、ログイン、ログアウトを確認すること。
3. 夫婦 2 端末で同じ日付のイベント・天気・日記が同期されること。
4. 時刻ピッカー、日付ピッカー、スマートフォン幅 UI が維持されること。
5. 固定後にイベント追加・削除、天気変更、日記生成が拒否され、固定解除後に再開できること。
6. 機内モードでイベント追加、復旧後の再送、固定日/不正入力/未ログイン時のキュー挙動を確認すること。
7. 旧 GAS と旧スプレッドシートは移行確認完了まで削除しないこと。GitHub Pages 停止は Sites/D1 で全日付と 2 端末同期を確認した後に検討してください。
