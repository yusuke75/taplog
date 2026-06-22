// New job (要件 §7): pick 設備 + 品番 -> SPM auto-shows -> 開始.

import { el, icon, mount } from "../lib/dom.js";
import { machines, products, jobs, session } from "../data/store.js";
import { Router } from "../lib/router.js";
import { toast } from "../lib/ui.js";
import { workerShell, requireOperator } from "./shell.js";

const APP_ROOT = () => document.getElementById("app");

export function renderJobNew(params = {}) {
  if (!requireOperator()) return;

  const { root, body } = workerShell({
    title: "新規ジョブ開始",
    onBack: () => Router.go("/worker"),
  });

  // If a machine was already chosen on the home screen, it is fixed here
  // (no need to re-select). Otherwise show the machine selector.
  const fixedMachine = params.machine ? machines.get(params.machine) : null;
  const state = { machineId: fixedMachine ? fixedMachine.id : "", productId: "", lot: "" };

  // --- 設備: fixed display or selector ---
  const machineField = fixedMachine
    ? el("div", { class: "field" }, [
        el("span", { class: "field-label" }, "設備"),
        el(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "14px 16px",
              background: "var(--color-background-secondary)",
              borderRadius: "var(--border-radius-md)",
            },
          },
          [
            icon("precision_manufacturing", { style: { color: "var(--color-text-info)" } }),
            el("span", { style: { fontSize: "1.15rem", fontWeight: "600" } }, fixedMachine.name),
          ]
        ),
      ])
    : selectField(
        "設備を選択",
        groupMachines().map((m) => ({ value: m.id, label: m.name })),
        "",
        (v) => (state.machineId = v)
      );

  // --- 品番 select (SPM auto-display) ---
  const spmDisplay = el("div", { class: "metric-tile", style: { textAlign: "left", padding: "14px 16px" } }, [
    el("div", { class: "m-label" }, "標準SPM（自動表示）"),
    el("div", { class: "m-value", id: "spm-val" }, "—"),
  ]);

  const updateSpm = () => {
    const p = products.get(state.productId);
    document.getElementById("spm-val").textContent = p ? `${p.standardSpm} spm` : "—";
  };

  const productSelect = selectField(
    "品番を選択",
    products.active().map((p) => ({ value: p.id, label: p.name })),
    state.productId,
    (v) => {
      state.productId = v;
      updateSpm();
    }
  );

  const lotInput = el("input", { type: "text", placeholder: "例: LOT-0621-03" });
  lotInput.addEventListener("input", (e) => (state.lot = e.target.value));

  body.append(
    machineField,
    productSelect,
    spmDisplay,
    el("label", { class: "field" }, [el("span", { class: "field-label" }, "ロット番号（任意）"), lotInput]),
    el(
      "button",
      {
        class: "worker-cta",
        style: { marginTop: "8px" },
        onclick: () => start(state),
      },
      [icon("play_arrow"), "開始する"]
    )
  );

  mount(APP_ROOT(), root);
}

function start(state) {
  if (!state.machineId) return toast("設備を選択してください", "danger");
  if (!state.productId) return toast("品番を選択してください", "danger");

  const existing = jobs.forMachine(state.machineId);
  if (existing) return toast("この設備には進行中のジョブがあります", "danger");

  const op = session.current();
  const job = jobs.start({
    machineId: state.machineId,
    productId: state.productId,
    lot: state.lot,
    operatorId: op.id,
  });
  toast("ジョブを開始しました", "success");
  Router.go(`/worker/job/${job.id}`);
}

/** Active equipment limited to the current operator's group (if any). */
function groupMachines() {
  const op = session.current();
  const list = machines.active();
  return op && op.groupId ? list.filter((m) => m.groupId === op.groupId) : list;
}

function selectField(label, options, value, onChange) {
  const select = el("select", { onchange: (e) => onChange(e.target.value) }, [
    el("option", { value: "" }, "選択してください"),
    ...options.map((o) => el("option", { value: o.value, selected: o.value === value }, o.label)),
  ]);
  return el("label", { class: "field" }, [el("span", { class: "field-label" }, label), select]);
}
