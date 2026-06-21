-- 設備・ユーザーにグループ列を追加し、既存データを整える1回限りのマイグレーション。
-- Supabase ダッシュボード → SQL Editor に貼り付けて Run してください。
-- （新しいアプリコードをデプロイする前に実行してください）

-- 1) グループ列を追加
alter table machines  add column if not exists group_id text;
alter table machines  add column if not exists group_name text;
alter table app_users add column if not exists group_id text;
alter table app_users add column if not exists group_name text;

-- 2) 設備名「N号機」を「設備N」に統一
update machines set name = '設備' || substring(name from '[0-9]+')
  where name like '%号機%';

-- 3) デモ用のグループ割り当て（運用に合わせて変更可）
update machines set group_id='A', group_name='プレスA班' where id in ('m1','m2','m3');
update machines set group_id='B', group_name='プレスB班' where id in ('m4','m5','m6');
update machines set group_id='C', group_name='プレスC班' where id in ('m7','m8','m9');

update app_users set group_id='A', group_name='プレスA班' where id='u1';
update app_users set group_id='B', group_name='プレスB班' where id in ('u2','u3');
-- 管理者(u4,u5)はグループなし（全設備を閲覧）
