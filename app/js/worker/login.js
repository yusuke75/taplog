// Worker login (要件 §7): QR/barcode scan (simulated) OR manual
// employee-number entry. Works offline. Also exposes the 交代
// (handover) flow that switches the logged-in operator.

import { el, icon, mount } from "../lib/dom.js";
import { users, session } from "../data/store.js";
import { openModal, toast, field } from "../lib/ui.js";
import { Router } from "../lib/router.js";

const APP_ROOT = () => document.getElementById("app");

export function renderLogin() {
  const wrap = el("div", { class: "login-wrap" });

  const corner = (pos) => {
    const styleByPos = {
      tl: { top: "12px", left: "12px", borderTop: "3px solid var(--color-text-info)", borderLeft: "3px solid var(--color-text-info)" },
      tr: { top: "12px", right: "12px", borderTop: "3px solid var(--color-text-info)", borderRight: "3px solid var(--color-text-info)" },
      bl: { bottom: "12px", left: "12px", borderBottom: "3px solid var(--color-text-info)", borderLeft: "3px solid var(--color-text-info)" },
      br: { bottom: "12px", right: "12px", borderBottom: "3px solid var(--color-text-info)", borderRight: "3px solid var(--color-text-info)" },
    };
    return el("span", { class: "qr-corner", style: styleByPos[pos] });
  };

  wrap.append(
    el("p", { style: { color: "var(--color-text-secondary)", fontSize: "0.95rem", margin: "0" } }, "TapLog ・ プレス日報"),
    el("h2", { style: { fontSize: "1.4rem", fontWeight: "600", margin: "8px 0 4px" } }, "社員証をスキャン"),
    el("p", { style: { color: "var(--color-text-secondary)", margin: "0" } }, "QRコードを枠内にかざしてください"),
    el("div", { class: "qr-frame" }, [icon("qr_code_2"), corner("tl"), corner("tr"), corner("bl"), corner("br")]),
    el("button", { class: "worker-cta tonal", onclick: simulateScan }, [icon("qr_code_scanner"), "スキャンをシミュレート"]),
    el("div", { class: "login-divider" }, "または"),
    el("button", { class: "worker-cta tonal", onclick: () => openManualLogin(false) }, [icon("keyboard"), "社員番号を手入力"]),
    el("div", { style: { display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--color-text-secondary)", fontSize: "0.85rem", marginTop: "12px" } }, [
      icon("cloud_off", { style: { fontSize: "18px" } }),
      "オフラインでもログインできます",
    ])
  );

  const root = el("div", { class: "worker" }, [
    el("div", { class: "worker-topbar" }, [el("span", { class: "worker-title" }, [icon("touch_app"), "TapLog"])]),
    wrap,
  ]);
  mount(APP_ROOT(), root);
}

/** Simulate a QR scan by picking the first active worker's card. */
function simulateScan() {
  const worker = users.active().find((u) => u.role === "worker");
  if (!worker) {
    toast("有効な作業者がいません", "danger");
    return;
  }
  doLogin(worker.cardCode, false);
}

function openManualLogin(isHandover) {
  const input = el("input", { type: "text", inputmode: "numeric", placeholder: "例: 1001", autocomplete: "off" });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submit();
  });

  const submit = () => {
    if (doLogin(input.value, isHandover)) close();
  };

  const close = openModal({
    title: isHandover ? "交代：社員番号を入力" : "社員番号でログイン",
    body: [field("社員番号 または 社員証コード", input)],
    actions: [
      { label: "キャンセル", kind: "btn-ghost", onClick: (c) => c() },
      { label: "ログイン", kind: "btn-primary", onClick: submit },
    ],
  });
}

/** Returns true on success. */
function doLogin(code, isHandover) {
  const user = users.authenticate(code);
  if (!user) {
    toast("該当する作業者が見つかりません", "danger");
    return false;
  }
  session.login(user.id);
  toast(`${user.name} さんがログインしました`, "success");
  if (!isHandover) Router.go("/worker");
  else window.dispatchEvent(new CustomEvent("taplog:rerender")); // stay on current page
  return true;
}

/** 交代 (handover) — switch operator via scan or manual entry. */
export function openHandover() {
  openModal({
    title: "記録者を交代",
    body: [
      el("p", { style: { margin: 0, color: "var(--color-text-secondary)" } }, "進行中のジョブはそのまま継続し、ログインだけ切り替えます。"),
    ],
    actions: [
      { label: "閉じる", kind: "btn-ghost", onClick: (c) => c() },
      {
        label: "別の社員証をスキャン",
        kind: "btn-tonal",
        onClick: (c) => {
          c();
          handoverScan();
        },
      },
      {
        label: "手入力で交代",
        kind: "btn-primary",
        onClick: (c) => {
          c();
          openManualLogin(true);
        },
      },
    ],
  });
}

function handoverScan() {
  const current = session.current();
  const next = users.active().find((u) => u.role === "worker" && (!current || u.id !== current.id));
  if (!next) {
    toast("交代できる作業者がいません", "danger");
    return;
  }
  session.login(next.id);
  toast(`${next.name} さんに交代しました`, "success");
  window.dispatchEvent(new CustomEvent("taplog:rerender"));
}
