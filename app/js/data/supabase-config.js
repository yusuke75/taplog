// ============================================================
// Supabase 接続設定
//
// Supabase ダッシュボード → プロジェクト → Settings → API から
// 「Project URL」と「anon public」キーをコピーして下に貼り付けてください。
//
// ※ anon キーはフロントエンドに埋め込む前提の公開キーで、公開しても
//    問題ありません（アクセス制御はDB側のRLSポリシーで行います）。
//
// 未設定（プレースホルダのまま）の場合、アプリは従来どおり端末内
// （localStorage）保存で動作します。値を設定すると共有DBモードに
// 切り替わります。
// ============================================================

export const SUPABASE_URL = "https://pgptvtvjwceqhlcaygdt.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBncHR2dHZqd2NlcWhsY2F5Z2R0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwMzk5MjQsImV4cCI6MjA5NzYxNTkyNH0.lt_Sg3GfuylodqPg9sjD4ZxOmL9tWsTZuYb-jSJmQgg";

/** 設定が実値に置き換わっているか判定（プレースホルダなら false）。 */
export function isSupabaseConfigured() {
  return (
    !SUPABASE_URL.includes("YOUR-PROJECT") &&
    !SUPABASE_ANON_KEY.includes("YOUR-ANON") &&
    SUPABASE_URL.startsWith("https://")
  );
}
