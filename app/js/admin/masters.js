// Master management (要件 §8): add/edit/delete + active toggle for
// 品番 / 号機 / ユーザー / 不良モード. Config-driven so the four
// masters share one table/dialog implementation.

import { el, icon, mount } from "../lib/dom.js";
import { machines, products, users, defectModes } from "../data/store.js";
import { openModal, confirmModal, toast, field } from "../lib/ui.js";
import { adminShell, adminHeader, breadcrumb } from "./shell.js";

const ROLE_LABELS = { sysadmin: "システム管理者", admin: "管理者", worker: "作業者" };

// ---- master configs ----
const CONFIGS = {
  products: {
    title: "品番マスタ",
    store: products,
    columns: [
      { key: "code", label: "品番", weight: 1 },
      { key: "name", label: "名称", weight: 1 },
      { key: "standardSpm", label: "標準SPM", align: "right", render: (r) => `${r.standardSpm} spm` },
      { key: "standardSetupMin", label: "標準段取り", align: "right", render: (r) => `${r.standardSetupMin} 分` },
    ],
    fields: [
      { key: "code", label: "品番", type: "text", required: true },
      { key: "name", label: "名称", type: "text", required: true },
      { key: "standardSpm", label: "標準SPM", type: "number" },
      { key: "standardSetupMin", label: "標準段取り時間（分）", type: "number" },
    ],
  },
  machines: {
    title: "号機マスタ",
    store: machines,
    columns: [{ key: "name", label: "号機名", weight: 1 }],
    fields: [{ key: "name", label: "号機名", type: "text", required: true }],
  },
  users: {
    title: "ユーザー（作業者）マスタ",
    store: users,
    columns: [
      { key: "employeeNo", label: "社員ID", weight: 1 },
      { key: "name", label: "氏名", weight: 1 },
      { key: "cardCode", label: "社員IDコード", weight: 1 },
      { key: "role", label: "ロール", render: (r) => ROLE_LABELS[r.role] || r.role },
    ],
    fields: [
      { key: "employeeNo", label: "社員ID", type: "text", required: true },
      { key: "name", label: "氏名", type: "text", required: true },
      { key: "cardCode", label: "社員IDコード", type: "text" },
      {
        key: "role",
        label: "ロール",
        type: "select",
        options: [
          { value: "worker", label: "作業者" },
          { value: "admin", label: "管理者" },
          { value: "sysadmin", label: "システム管理者" },
        ],
      },
    ],
  },
  defects: {
    title: "不良モードマスタ",
    store: defectModes,
    columns: [
      { key: "name", label: "名称", weight: 1 },
      { key: "order", label: "表示順", align: "center" },
    ],
    fields: [
      { key: "name", label: "名称", type: "text", required: true },
      { key: "order", label: "表示順", type: "number" },
    ],
    footnote: "有効にした不良モードが、作業者の生産実績入力に表示順どおりに並びます。",
  },
};

export function renderMasters(params) {
  const cfg = CONFIGS[params.type];
  const main = adminShell(`/admin/masters/${params.type}`);
  if (!cfg) {
    main.append(adminHeader("不明なマスタ"));
    return;
  }

  main.append(
    breadcrumb([
      { label: "マスタ管理", href: "#/admin" },
      { label: cfg.title },
    ]),
    el("div", { class: "section-head", style: { marginTop: "8px" } }, [
      el("h2", {}, cfg.title),
      el("button", { class: "btn btn-primary", onclick: () => openForm(cfg, null) }, [icon("add"), "追加"]),
    ]),
    tableFor(cfg)
  );

  if (cfg.footnote) {
    main.append(el("div", { class: "muted", style: { fontSize: "0.85rem", marginTop: "12px" } }, cfg.footnote));
  }
}

function tableFor(cfg) {
  const rows = cfg.store.list();
  const thead = el("tr", {}, [
    ...cfg.columns.map((c) =>
      el("th", { class: c.align === "right" ? "cell-right" : c.align === "center" ? "cell-center" : "" }, c.label)
    ),
    el("th", { class: "cell-center" }, "状態"),
    el("th", { class: "cell-right" }, "操作"),
  ]);

  const body = rows.map((row) => {
    const tds = cfg.columns.map((c) =>
      el(
        "td",
        { class: c.align === "right" ? "cell-right" : c.align === "center" ? "cell-center" : "" },
        c.render ? c.render(row) : String(row[c.key] ?? "")
      )
    );

    const statusBadge = el(
      "span",
      { class: `badge ${row.active ? "badge-success" : "badge-neutral"}`, style: { cursor: "pointer" } },
      row.active ? "有効" : "無効"
    );
    statusBadge.addEventListener("click", () => {
      cfg.store.toggle(row.id);
      toast(row.active ? "無効にしました" : "有効にしました");
      rerender();
    });

    const actions = el("div", { class: "row-actions" }, [
      iconBtn("edit", "編集", () => openForm(cfg, row)),
      iconBtn("delete", "削除", () => confirmDelete(cfg, row), true),
    ]);

    return el("tr", {}, [...tds, el("td", { class: "cell-center" }, statusBadge), el("td", { class: "cell-right" }, actions)]);
  });

  return el("div", { class: "table-wrap" }, [
    el("table", { class: "data" }, [
      el("thead", {}, thead),
      el("tbody", {}, body.length ? body : [emptyRow(cfg.columns.length + 2)]),
    ]),
  ]);
}

function emptyRow(span) {
  return el("tr", {}, el("td", { colspan: span, class: "muted", style: { textAlign: "center", padding: "32px" } }, "データがありません"));
}

function iconBtn(name, title, onClick, danger = false) {
  return el("button", { class: `icon-btn ${danger ? "danger" : ""}`, title, onclick: onClick }, icon(name));
}

function openForm(cfg, existing) {
  const values = { ...(existing || {}) };
  const inputs = {};

  const body = cfg.fields.map((f) => {
    let control;
    if (f.type === "select") {
      control = el(
        "select",
        {},
        f.options.map((o) => el("option", { value: o.value, selected: values[f.key] === o.value }, o.label))
      );
    } else {
      control = el("input", {
        type: f.type === "number" ? "number" : "text",
        value: values[f.key] ?? "",
        placeholder: f.label,
      });
    }
    inputs[f.key] = control;
    return field(f.label + (f.required ? " *" : ""), control);
  });

  openModal({
    title: existing ? `${cfg.title}を編集` : `${cfg.title}を追加`,
    body,
    actions: [
      { label: "キャンセル", kind: "btn-ghost", onClick: (c) => c() },
      {
        label: "保存",
        kind: "btn-primary",
        onClick: (close) => {
          const data = {};
          for (const f of cfg.fields) {
            let v = inputs[f.key].value;
            if (f.type === "number") v = v === "" ? 0 : Number(v);
            else v = v.trim();
            if (f.required && (v === "" || v == null)) {
              toast(`${f.label} を入力してください`, "danger");
              return;
            }
            data[f.key] = v;
          }
          if (existing) {
            cfg.store.update(existing.id, data);
            toast("更新しました", "success");
          } else {
            cfg.store.add(data);
            toast("追加しました", "success");
          }
          close();
          rerender();
        },
      },
    ],
  });
}

function confirmDelete(cfg, row) {
  confirmModal({
    title: `${cfg.title}を削除`,
    message: `「${row.name || row.code || row.employeeNo}」を削除します。よろしいですか？`,
    onConfirm: () => {
      cfg.store.remove(row.id);
      toast("削除しました", "success");
      rerender();
    },
  });
}

function rerender() {
  window.dispatchEvent(new CustomEvent("taplog:rerender"));
}
