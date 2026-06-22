-- 品番×設備 対応マスタ用のテーブルを追加する1回限りのマイグレーション。
-- Supabase ダッシュボード → SQL Editor に貼り付けて Run してください。
-- （新しいアプリコードをデプロイする前に実行してください）

-- 1) テーブル作成
create table if not exists product_machines (
  id text primary key,
  product_id text,
  machine_id text
);
create index if not exists idx_pm_machine on product_machines(machine_id);

-- 2) RLS（anon で読み書き可：他テーブルと同方針）
alter table product_machines enable row level security;
drop policy if exists "taplog_all" on product_machines;
create policy "taplog_all" on product_machines
  for all to anon, authenticated using (true) with check (true);

-- 3) リアルタイム購読に追加
do $$
begin
  alter publication supabase_realtime add table product_machines;
exception when duplicate_object then null;
end $$;
