// Production result form (要件 §7): 生産数/ロット/総ショット数/ロス +
// per-defect-mode counts (master-driven). 不良数 auto-sums.

import { el, icon, mount } from "../lib/dom.js";
import { machines, defectModes, jobs } from "../data/store.js";
import { Router } from "../lib/router.js";
import { toast } from "../lib/ui.js";
import { totalDefects } from "../domain/calc.js";
import { workerShell, requireOperator } from "./shell.js";

const APP_ROOT = () => document.getElementById("app");

export function renderResult(params) {
  if (!requireOperator()) return;

  const job = jobs.get(params.id);
  if (!job) {
    toast("ジョブが見つかりません", "danger");
    Router.go("/worker");
    return;
  }
  const machine = machines.get(job.machineId);

  const { root, body } = workerShell({
    title: `生産実績 ・ ${machine ? machine.name : "?"}`,
    onBack: () => Router.go(`/worker/job/${job.id}`),
  });

  // working copy of the result (immutable—never edits store until save)
  const r = {
    productionCount: job.result?.productionCount ?? "",
    lotCount: job.result?.lotCount ?? "",
    totalShots: job.result?.totalShots ?? "",
    loss: job.result?.loss ?? "",
    defects: { ...(job.result?.defects || {}) },
    comment: job.result?.comment ?? "",
  };

  const totalNode = el("span", { class: "dt-value" }, "0 個");
  const refreshTotal = () => {
    totalNode.textContent = `${totalDefects({ defects: r.defects })} 個`;
  };

  const numField = (label, key) => {
    const input = el("input", { type: "number", inputmode: "numeric", min: "0", value: r[key] });
    input.addEventListener("input", (e) => (r[key] = e.target.value));
    return el("div", { class: "field" }, [el("span", { class: "field-label" }, label), input]);
  };

  // master-driven defect rows
  const defectRows = defectModes.active().map((mode) => {
    const input = el("input", { type: "number", inputmode: "numeric", min: "0", value: r.defects[mode.id] ?? "" });
    input.addEventListener("input", (e) => {
      r.defects[mode.id] = e.target.value;
      refreshTotal();
    });
    return el("div", { class: "defect-row" }, [
      el("span", { class: "d-name" }, mode.name),
      input,
      el("span", { style: { color: "var(--color-text-secondary)" } }, "個"),
    ]);
  });

  const commentArea = el("textarea", { rows: "2", placeholder: "気づいた点があれば記入" }, r.comment);
  commentArea.addEventListener("input", (e) => (r.comment = e.target.value));

  body.append(
    el("div", { class: "result-grid" }, [
      numField("生産数（個）", "productionCount"),
      numField("ロット数（個）", "lotCount"),
      numField("総ショット数", "totalShots"),
      numField("ロス（個）", "loss"),
    ]),
    el("div", { class: "defect-total", style: { margin: "14px 0" } }, [
      el("span", { style: { color: "var(--color-text-secondary)" } }, "不良数（自動合計）"),
      totalNode,
    ]),
    el("div", { class: "worker-section-label" }, "工程内不良（個数）"),
    ...defectRows,
    el(
      "div",
      { style: { display: "flex", gap: "6px", alignItems: "center", color: "var(--color-text-tertiary)", fontSize: "0.8rem", margin: "6px 0 14px" } },
      [icon("settings", { style: { fontSize: "16px" } }), "不良モードはマスタ管理で追加・編集できます"]
    ),
    el("label", { class: "field" }, [
      el("span", { class: "field-label" }, "コメント"),
      commentArea,
    ]),
    el("button", { class: "worker-cta", style: { marginTop: "16px" }, onclick: () => save(job.id, r) }, [
      icon("check"),
      "保存する",
    ])
  );

  refreshTotal();
  mount(APP_ROOT(), root);
}

function toNum(v) {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function save(jobId, r) {
  const defects = {};
  for (const [k, v] of Object.entries(r.defects)) {
    const n = toNum(v);
    if (n != null) defects[k] = n;
  }
  const result = {
    productionCount: toNum(r.productionCount),
    lotCount: toNum(r.lotCount),
    totalShots: toNum(r.totalShots),
    loss: toNum(r.loss),
    defects,
    comment: r.comment.trim(),
  };
  jobs.saveResult(jobId, result);
  toast("生産実績を保存しました", "success");
  Router.go(`/worker/job/${jobId}`);
}
