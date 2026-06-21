-- ============================================================
-- TapLog — Supabase スキーマ
--   Supabase ダッシュボードの「SQL Editor」に貼り付けて Run。
--   何度実行しても安全（再実行可能）に書いています。
-- ============================================================

-- ---- テーブル ----
create table if not exists machines (
  id text primary key,
  name text not null,
  group_id text,
  group_name text,
  active boolean not null default true,
  sort_order int not null default 0
);

create table if not exists products (
  id text primary key,
  code text not null,
  name text not null,
  standard_spm int not null default 0,
  standard_setup_min int not null default 0,
  active boolean not null default true
);

-- "users" は予約語と紛らわしいため app_users とする
create table if not exists app_users (
  id text primary key,
  employee_no text not null,
  name text not null,
  group_id text,
  group_name text,
  role text not null default 'worker',
  active boolean not null default true
);

create table if not exists defect_modes (
  id text primary key,
  name text not null,
  sort_order int not null default 0,
  active boolean not null default true
);

create table if not exists jobs (
  id text primary key,
  machine_id text,
  product_id text,
  lot text default '',
  spm int default 0,
  status text not null default 'active',
  operator_id text,
  started_at bigint not null,   -- epoch ミリ秒（JS の Date.now() と一致）
  ended_at bigint,
  result jsonb not null default '{}'::jsonb,
  comment text default ''
);

create table if not exists events (
  id text primary key,
  job_id text references jobs(id) on delete cascade,
  type text not null,
  operator_id text,
  started_at bigint not null,
  ended_at bigint
);

create index if not exists idx_events_job on events(job_id);
create index if not exists idx_jobs_status on jobs(status);

-- ============================================================
-- Row Level Security
--   社内向け試作のため、anon キーで読み書き可能にする許可ポリシー。
--   ※ URL と anon キーを知っていれば誰でも読み書きできます。
--     本格運用で権限を絞る場合はこのポリシーを見直してください。
-- ============================================================
alter table machines     enable row level security;
alter table products     enable row level security;
alter table app_users    enable row level security;
alter table defect_modes enable row level security;
alter table jobs         enable row level security;
alter table events       enable row level security;

do $$
declare t text;
begin
  foreach t in array array['machines','products','app_users','defect_modes','jobs','events']
  loop
    execute format('drop policy if exists "taplog_all" on %I', t);
    execute format(
      'create policy "taplog_all" on %I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- ============================================================
-- リアルタイム（他端末の変更を自動反映）
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['machines','products','app_users','defect_modes','jobs','events']
  loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ============================================================
-- 初期マスタ（既にあれば上書きしない）
-- ============================================================
insert into machines (id, name, group_id, group_name, active, sort_order) values
  ('m1','設備1','A','プレスA班',true,1),('m2','設備2','A','プレスA班',true,2),('m3','設備3','A','プレスA班',true,3),
  ('m4','設備4','B','プレスB班',true,4),('m5','設備5','B','プレスB班',true,5),('m6','設備6','B','プレスB班',true,6),
  ('m7','設備7','C','プレスC班',true,7),('m8','設備8','C','プレスC班',true,8),('m9','設備9','C','プレスC班',false,9)
on conflict (id) do nothing;

insert into products (id, code, name, standard_spm, standard_setup_min, active) values
  ('p1','A-2203','ブラケットA',120,15,true),
  ('p2','B-5510','ステーB',90,20,true),
  ('p3','C-1180','カラーC',150,12,true),
  ('p4','D-7702','プレートD',80,25,true),
  ('p5','E-3344','クリップE',200,10,true)
on conflict (id) do nothing;

insert into app_users (id, employee_no, name, group_id, group_name, role, active) values
  ('u1','1001','山田 太郎','A','プレスA班','worker',true),
  ('u2','1002','佐藤 花子','B','プレスB班','worker',true),
  ('u3','1003','鈴木 一郎','B','プレスB班','worker',true),
  ('u4','9001','高橋 管理',null,null,'admin',true),
  ('u5','9000','システム管理者',null,null,'sysadmin',true)
on conflict (id) do nothing;

insert into defect_modes (id, name, sort_order, active) values
  ('d1','巻き不良',1,true),('d2','寸法不良',2,true),
  ('d3','外観不良',3,true),('d4','その他',4,true),
  ('d5','バリ不良',5,false)
on conflict (id) do nothing;
