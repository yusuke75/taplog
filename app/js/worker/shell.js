// Worker shell: topbar (title + network) and an operator bar with
// the always-visible "現在ログイン中" + 交代 button (要件 §7).

import { el, icon, mount } from "../lib/dom.js";
import { networkPill, toast } from "../lib/ui.js";
import { session } from "../data/store.js";
import { Router } from "../lib/router.js";
import { openHandover } from "./login.js";

/**
 * Build the worker page frame.
 *   title: header text (string or node)
 *   onBack: optional handler -> shows back chevron instead of title icon
 *   showOperator: render the operator/交代 bar (default true)
 * Returns { root, body } — append content to `body`.
 */
export function workerShell({ title, onBack = null, showOperator = true }) {
  const body = el("div", { class: "worker-body" });

  const titleNode = onBack
    ? el("button", { class: "worker-back", onclick: onBack }, [icon("arrow_back"), title])
    : el("span", { class: "worker-title" }, [icon("touch_app"), title]);

  const topbar = el("div", { class: "worker-topbar" }, [titleNode, networkPill()]);

  const root = el("div", { class: "worker" }, [topbar]);

  if (showOperator) root.append(operatorBar());
  root.append(body);
  return { root, body };
}

function operatorBar() {
  const op = session.current();
  const bar = el("div", { class: "worker-body", style: { paddingBottom: "0" } });

  const inner = el("div", { class: "operator-bar" }, [
    el("div", { class: "operator-chip" }, [
      el("span", { class: "operator-avatar" }, op ? op.name.slice(0, 1) : "?"),
      el("span", {}, [
        el("span", { style: { color: "var(--color-text-tertiary)", marginRight: "6px" } }, "ログイン中"),
        el("strong", { style: { color: "var(--color-text-primary)" } }, op ? op.name : "未ログイン"),
      ]),
    ]),
    el(
      "button",
      {
        class: "handover-btn",
        onclick: () => openHandover(),
      },
      [icon("sync_alt"), "交代"]
    ),
  ]);

  mount(bar, inner);
  return bar;
}

/** Guard: redirect to login if no operator is logged in. */
export function requireOperator() {
  if (!session.current()) {
    Router.go("/worker/login");
    return false;
  }
  return true;
}

export { toast };
