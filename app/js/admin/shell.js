// Admin shell: persistent sidebar nav + main content area.

import { el, icon, mount } from "../lib/dom.js";

const APP_ROOT = () => document.getElementById("app");

const NAV = [
  { group: "概要", items: [{ href: "#/admin", icon: "dashboard", label: "ホーム", match: "/admin" }] },
  {
    group: "マスタ管理",
    items: [
      { href: "#/admin/masters/products", icon: "inventory_2", label: "品番マスタ", match: "/admin/masters/products" },
      { href: "#/admin/masters/machines", icon: "precision_manufacturing", label: "設備マスタ", match: "/admin/masters/machines" },
      { href: "#/admin/masters/users", icon: "group", label: "ユーザー", match: "/admin/masters/users" },
      { href: "#/admin/masters/defects", icon: "report", label: "不良モード", match: "/admin/masters/defects" },
    ],
  },
  {
    group: "集計・分析",
    items: [
      { href: "#/admin/dashboard", icon: "monitoring", label: "ダッシュボード", match: "/admin/dashboard" },
      { href: "#/admin/jobs", icon: "receipt_long", label: "ジョブ一覧", match: "/admin/jobs" },
    ],
  },
];

/**
 * Render the admin frame and return the main content element to fill.
 * `active` is the current route path used to highlight the nav item.
 */
export function adminShell(active) {
  const root = el("div", { class: "admin" });
  const closeDrawer = () => root.classList.remove("drawer-open");

  const navItems = NAV.flatMap((section) => [
    el("div", { class: "nav-group-label" }, section.group),
    ...section.items.map((item) =>
      el(
        "a",
        { href: item.href, class: `nav-item ${active === item.match ? "active" : ""}`, onclick: closeDrawer },
        [icon(item.icon), item.label]
      )
    ),
  ]);

  const sidebar = el("aside", { class: "admin-sidebar" }, [
    el("div", { class: "admin-brand" }, [icon("touch_app"), "TapLog"]),
    ...navItems,
    el("a", { href: "#/", class: "nav-item", style: { marginTop: "auto" }, onclick: closeDrawer }, [
      icon("logout"),
      "入口に戻る",
    ]),
  ]);

  // Mobile-only top bar with a hamburger that toggles the drawer.
  const topbar = el("header", { class: "admin-topbar" }, [
    el("button", { class: "admin-hamburger", "aria-label": "メニュー", onclick: () => root.classList.toggle("drawer-open") }, icon("menu")),
    el("div", { class: "admin-brand", style: { padding: "0", fontSize: "1.1rem" } }, [icon("touch_app"), "TapLog"]),
  ]);

  const scrim = el("div", { class: "admin-scrim", onclick: closeDrawer });
  const main = el("div", { class: "admin-main" });

  root.append(topbar, sidebar, scrim, main);
  mount(APP_ROOT(), root);
  return main;
}

export function adminHeader(title, right = null) {
  return el("div", { class: "admin-header" }, [el("h1", {}, title), right]);
}

export function breadcrumb(parts) {
  // parts: [{label, href}] — last has no href
  const nodes = [];
  parts.forEach((p, i) => {
    if (i > 0) nodes.push(el("span", { class: "muted" }, " ／ "));
    nodes.push(
      p.href
        ? el("a", { href: p.href }, p.label)
        : el("span", { style: { color: "var(--color-text-primary)", fontWeight: "600" } }, p.label)
    );
  });
  return el("div", { class: "breadcrumb" }, nodes);
}
