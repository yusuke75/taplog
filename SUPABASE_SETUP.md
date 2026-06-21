# TapLog × Supabase 共有DB セットアップ手順

複数端末でデータを共有するための設定です。所要時間およそ5〜10分。
**あなたにお願いするのは「1〜3」だけ**で、アプリ側のコード対応は別途行います。

---

## 1. Supabase プロジェクトを作成（無料）

1. https://supabase.com/ にアクセスし、GitHub アカウント等でサインイン
2. **New project** を作成
   - Name: `taplog`（任意）
   - Database Password: 任意の強いパスワード（**控えておく**）
   - Region: `Northeast Asia (Tokyo)` を推奨
3. 作成完了まで1〜2分待つ

## 2. データベースを構築（SQLを実行）

1. 左メニューの **SQL Editor** を開く
2. **New query** を選び、リポジトリの [`supabase/schema.sql`](./supabase/schema.sql) の中身を**全部コピー**して貼り付け
3. **Run**（▶）を押す → テーブル・初期マスタ・リアルタイム設定が一括で作られます

> 何度実行しても安全な内容です。エラーが出たらメッセージを共有してください。

## 3. 接続情報（URL と anon キー）を控える

1. 左メニュー **Settings（歯車）→ API** を開く
2. 次の2つをコピー：
   - **Project URL** … 例 `https://abcdxyz.supabase.co`
   - **Project API keys → `anon` `public`** … `eyJhbG...` で始まる長い文字列
3. この2つを開発者（このチャット）に共有、または下記4を自分で行う

> anon キーは**フロントエンド公開前提の公開キー**なので、共有しても安全です。
> （アクセス制御はDB側の RLS ポリシーで行います。）

---

## 4.（コード側・開発担当が実施）

- [`app/js/data/supabase-config.js`](./app/js/data/supabase-config.js) に URL と anon キーを設定
- データ層（`store.js`）を Supabase 読み書き＋リアルタイム同期に対応
- localhost で動作確認 → `git push` で Vercel に自動デプロイ

設定後の挙動：
- どの端末で記録しても **Supabase に集約**され、全端末・管理者PCで同じデータが見える
- 他端末の変更は**リアルタイムで自動反映**
- ログイン中の作業者（誰が操作中か）は**端末ごと**に保持（共有しない）

---

## セキュリティについて（重要）

初期設定では「URL と anon キーを知っていれば誰でも読み書き可能」です（社内試作向け）。
公開範囲を絞りたい場合の選択肢：

- Supabase Auth を導入して認証ユーザーのみ許可（RLSポリシー変更）
- Vercel 側でパスワード保護（Deployment Protection）をかける
- 社内ネットワーク限定での利用に留める

本格運用に進む際に、改めて権限設計をご相談ください。
