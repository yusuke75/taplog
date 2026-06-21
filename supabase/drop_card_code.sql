-- 不要になった社員IDコード列（card_code）を削除する1回限りのマイグレーション。
-- Supabase ダッシュボード → SQL Editor に貼り付けて Run してください。
-- （アプリ側は既に card_code を使用していないため、削除しても影響ありません）

alter table app_users drop column if exists card_code;
