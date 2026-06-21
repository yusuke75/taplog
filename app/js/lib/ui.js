// ============================================================
// Shared UI primitives: toast (snackbar), confirm/form modal,
// and a reactive online/offline indicator (要件 §9 offline).
// ============================================================

import { el, icon, mount } from "./dom.js";

// ---- Toast ----
function toastHost() {
  let host = document.getElementById("toast-host");
  if (!host) {
    host = el("div", { id: "toast-host" });
    document.body.append(host);
  }
  return host;
}

export function toast(message, kind = "default", ms = 2400) {
  const node = el("div", { class: `toast toast-${kind}` }, message);
  toastHost().append(node);
  setTimeout(() => {
    node.style.opacity = "0";
    node.style.transition = "opacity .25s";
    setTimeout(() => node.remove(), 250);
  }, ms);
}

// ---- Modal ----
/**
 * Open a modal. `body` is an array of nodes. `actions` is an array of
 * { label, kind, onClick(close) }. Returns a close() function.
 */
export function openModal({ title, body = [], actions = [] }) {
  const backdrop = el("div", { class: "modal-backdrop" });
  const close = () => backdrop.remove();

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });
  document.addEventListener("keydown", function esc(e) {
    if (e.key === "Escape") {
      close();
      document.removeEventListener("keydown", esc);
    }
  });

  const actionBtns = actions.map((a) =>
    el(
      "button",
      {
        class: `btn ${a.kind || "btn-ghost"}`,
        onclick: () => a.onClick && a.onClick(close),
      },
      a.label
    )
  );

  const modal = el("div", { class: "modal" }, [
    title && el("div", { class: "modal-header" }, title),
    el("div", { class: "modal-body" }, body),
    actionBtns.length ? el("div", { class: "modal-actions" }, actionBtns) : null,
  ]);

  backdrop.append(modal);
  document.body.append(backdrop);
  // focus first input if present
  const firstInput = modal.querySelector("input, select, textarea");
  if (firstInput) firstInput.focus();
  return close;
}

export function confirmModal({ title, message, confirmLabel = "削除", kind = "btn-danger", onConfirm }) {
  openModal({
    title,
    body: [el("p", { style: { margin: 0, color: "var(--color-text-secondary)" } }, message)],
    actions: [
      { label: "キャンセル", kind: "btn-ghost", onClick: (c) => c() },
      {
        label: confirmLabel,
        kind,
        onClick: (c) => {
          onConfirm();
          c();
        },
      },
    ],
  });
}

// ---- Field builder for modal forms ----
export function field(label, control) {
  return el("label", { class: "field" }, [el("span", { class: "field-label" }, label), control]);
}

// ---- Network indicator ----
export function networkPill() {
  const render = () => {
    const online = navigator.onLine;
    mount(
      pill,
      icon(online ? "cloud_done" : "cloud_off"),
      el("span", {}, online ? "オンライン" : "オフライン")
    );
    pill.className = `net-pill ${online ? "online" : "offline"}`;
  };
  const pill = el("span", { class: "net-pill" });
  window.addEventListener("online", render);
  window.addEventListener("offline", render);
  render();
  return pill;
}
