// Entry launcher — choose the worker (smartphone) or admin (PC) front
// (要件 §3 「2フロント」). Also offers a demo-data reset.

import { el, icon, mount } from "./lib/dom.js";
import { Router } from "./lib/router.js";
import { resetAll, getMode } from "./data/store.js";
import { toast, confirmModal } from "./lib/ui.js";

const APP_ROOT = () => document.getElementById("app");

export function renderLauncher() {
  const remote = getMode() === "remote";
  const card = (iconName, title, desc, onClick, accent) =>
    el(
      "button",
      {
        class: "master-tile",
        style: { textAlign: "left", alignItems: "flex-start", border: accent ? "2px solid var(--md-primary)" : null },
        onclick: onClick,
      },
      [
        el("span", { class: "material-symbols-rounded", style: { fontSize: "40px", color: "var(--md-primary)" } }, iconName),
        el("div", { class: "t-title", style: { fontSize: "1.2rem" } }, title),
        el("div", { class: "t-count", style: { lineHeight: "1.5" } }, desc),
      ]
    );

  const root = el("div", { style: { maxWidth: "760px", margin: "0 auto", padding: "48px 24px" } }, [
    el("div", { style: { textAlign: "center", marginBottom: "8px" } }, [
      el("div", { style: { display: "inline-flex", alignItems: "center", gap: "10px", fontSize: "2rem", fontWeight: "700" } }, [
        icon("touch_app", { style: { fontSize: "36px", color: "var(--md-primary)" } }),
        "TapLog",
      ]),
    ]),
    el("p", { style: { textAlign: "center", color: "var(--color-text-secondary)", margin: "4px 0 36px" } }, "製造日報デジタル化 — タップで記録"),
    el("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" } }, [
      card("smartphone", "作業者（スマホ）", "現場で記録。号機カード・イベント記録・生産実績入力。", () => Router.go("/worker"), true),
      card("desktop_windows", "管理者（PC）", "マスタ管理・集計・分析・ジョブ閲覧・CSV出力。", () => Router.go("/admin")),
    ]),
    el(
      "div",
      { style: { textAlign: "center", marginTop: "40px" } },
      remote
        ? el("button", { class: "btn btn-ghost", onclick: () => refresh() }, [icon("sync"), "最新の状態に更新"])
        : el("button", { class: "btn btn-ghost", onclick: () => askReset() }, [icon("restart_alt"), "デモデータを初期化"])
    ),
    el(
      "p",
      { style: { textAlign: "center", color: "var(--color-text-tertiary)", fontSize: "0.8rem", marginTop: "8px", display: "flex", gap: "6px", justifyContent: "center", alignItems: "center" } },
      remote
        ? [icon("cloud_done", { style: { fontSize: "16px", color: "var(--color-text-success)" } }), "共有データベース（Supabase）に保存され、全端末でリアルタイム共有されます。"]
        : [icon("smartphone", { style: { fontSize: "16px" } }), "データは端末のローカル（localStorage）に保存されます。"]
    ),
  ]);

  mount(APP_ROOT(), root);
}

function refresh() {
  resetAll();
  toast("最新の状態に更新しました", "success");
}

function askReset() {
  confirmModal({
    title: "デモデータを初期化",
    message: "記録済みのジョブやマスタ変更がすべて消え、初期データに戻ります。よろしいですか？",
    confirmLabel: "初期化する",
    onConfirm: () => {
      resetAll();
      toast("初期化しました", "success");
      Router.go("/");
    },
  });
}
