// Worker shell: topbar (title + network + optional home link) and an
// operator bar showing the current operator's name + ログアウト button.

import { el, icon, mount } from "../lib/dom.js";
import { networkPill, toast } from "../lib/ui.js";
import { session } from "../data/store.js";
import { Router } from "../lib/router.js";

/**
 * Build the worker page frame.
 *   title: header text (string or node)
 *   onBack: optional handler -> shows back chevron instead of title icon
 *   showOperator: render the operator/ログアウト bar (default true)
 *   homeLink: show a home icon that returns to the top page "/"
 * Returns { root, body } — append content to `body`.
 */
export function workerShell({ title, onBack = null, showOperator = true, homeLink = false }) {
  const body = el("div", { class: "worker-body" });

  const titleNode = onBack
    ? el("button", { class: "worker-back", onclick: onBack }, [icon("arrow_back"), title])
    : el("span", { class: "worker-title" }, [icon("touch_app"), title]);

  const right = el("div", { style: { display: "flex", alignItems: "center", gap: "10px" } }, [
    homeLink
      ? el("button", { class: "worker-icon-btn", title: "トップページへ", onclick: () => Router.go("/") }, icon("home"))
      : null,
    networkPill(),
  ]);

  const topbar = el("div", { class: "worker-topbar" }, [titleNode, right]);

  const root = el("div", { class: "worker" }, [topbar]);

  if (showOperator) root.append(operatorBar());
  root.append(body);
  return { root, body };
}

function operatorBar() {
  const op = session.current();
  const bar = el("div", { class: "worker-body", style: { paddingBottom: "0", flex: "0 0 auto" } });

  const inner = el("div", { class: "operator-bar" }, [
    el("div", { class: "operator-chip" }, [
      el("span", { class: "operator-avatar" }, op ? op.name.slice(0, 1) : "?"),
      el("strong", { style: { color: "var(--color-text-primary)" } }, op ? op.name : "未ログイン"),
    ]),
    el(
      "button",
      {
        class: "handover-btn",
        onclick: () => logout(),
      },
      [icon("logout"), "ログアウト"]
    ),
  ]);

  mount(bar, inner);
  return bar;
}

function logout() {
  const op = session.current();
  session.logout();
  toast(op ? `${op.name} さんがログアウトしました` : "ログアウトしました", "success");
  Router.go("/worker/login");
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
