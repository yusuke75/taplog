// Job list & detail (要件 §8) + CSV export.

import { el, icon, mount } from "../lib/dom.js";
import { machines, products, users, jobs, defectModes } from "../data/store.js";
import { dateTimeStr } from "../lib/time.js";
import { now } from "../lib/id.js";
import { eventLabel } from "../domain/events.js";
import { clock, eventDurationMs } from "../lib/time.js";
import {
  totalDefects,
  setupMinutes,
  inspectMinutes,
  loadMinutes,
  utilization,
  defectRate,
  standardComparison,
} from "../domain/calc.js";
import { exportJobsCsv } from "./export.js";
import { adminShell, adminHeader, breadcrumb } from "./shell.js";
import { toast } from "../lib/ui.js";

const STATUS = {
  active: { label: "進行中", badge: "badge-success" },
  done: { label: "完了", badge: "badge-neutral" },
};

export function renderJobs() {
  const main = adminShell("/admin/jobs");
  const list = [...jobs.list()].sort((a, b) => b.startedAt - a.startedAt);

  main.append(
    adminHeader(
      "ジョブ一覧",
      el("button", { class: "btn btn-outline", onclick: () => doExport() }, [icon("download"), "CSVエクスポート"])
    ),
    table(list)
  );
}

function table(list) {
  const head = el("tr", {}, [
    el("th", {}, "号機"),
    el("th", {}, "品番"),
    el("th", {}, "ロット"),
    el("th", {}, "開始"),
    el("th", { class: "cell-right" }, "生産数"),
    el("th", { class: "cell-right" }, "不良"),
    el("th", { class: "cell-center" }, "状態"),
    el("th", { class: "cell-right" }, ""),
  ]);

  const rows = list.map((j) => {
    const m = machines.get(j.machineId);
    const p = products.get(j.productId);
    const st = STATUS[j.status] || STATUS.done;
    return el("tr", {}, [
      el("td", {}, m ? m.name : "-"),
      el("td", {}, p ? p.code : "-"),
      el("td", { class: "muted" }, j.lot || "—"),
      el("td", { class: "muted" }, dateTimeStr(j.startedAt)),
      el("td", { class: "cell-right" }, (j.result?.productionCount ?? "—").toLocaleString?.() ?? "—"),
      el("td", { class: "cell-right" }, String(totalDefects(j.result))),
      el("td", { class: "cell-center" }, el("span", { class: `badge ${st.badge}` }, st.label)),
      el(
        "td",
        { class: "cell-right" },
        el("a", { href: `#/admin/jobs/${j.id}`, class: "icon-btn", title: "詳細" }, icon("chevron_right"))
      ),
    ]);
  });

  return el("div", { class: "table-wrap" }, [
    el("table", { class: "data" }, [
      el("thead", {}, head),
      el("tbody", {}, rows.length ? rows : [el("tr", {}, el("td", { colspan: 8, class: "muted", style: { textAlign: "center", padding: "32px" } }, "ジョブがありません"))]),
    ]),
  ]);
}

export function renderJobDetail(params) {
  const main = adminShell("/admin/jobs");
  const job = jobs.get(params.id);
  if (!job) {
    main.append(adminHeader("ジョブが見つかりません"), el("a", { href: "#/admin/jobs", class: "breadcrumb" }, "← 一覧へ戻る"));
    return;
  }
  const m = machines.get(job.machineId);
  const p = products.get(job.productId);
  const op = users.get(job.operatorId);
  const cmp = standardComparison(job, p, now());

  main.append(
    breadcrumb([{ label: "ジョブ一覧", href: "#/admin/jobs" }, { label: `${m ? m.name : "?"} ・ ${p ? p.code : "?"}` }]),
    adminHeader(`${m ? m.name : "?"} ・ ${p ? p.code : "?"}`),
    el("div", { class: "kpi-grid" }, [
      miniKpi("負荷時間", `${loadMinutes(job, now())}分`),
      miniKpi("段取り計", `${setupMinutes(job)}分`),
      miniKpi("検査計", `${inspectMinutes(job)}分`),
      miniKpi("稼働率", `${utilization(job, now())}%`),
    ]),
    el("div", { class: "two-col" }, [
      panel("生産実績", resultPanel(job)),
      panel("標準比較", comparePanel(cmp)),
    ]),
    el("div", { style: { marginTop: "20px" } }, panel("イベント履歴", eventsTable(job))),
    job.comment ? el("div", { style: { marginTop: "20px" } }, panel("コメント", el("p", { style: { margin: 0 } }, job.comment))) : null,
    el("div", { style: { marginTop: "12px" }, class: "muted" }, `記録者: ${op ? op.name : "—"} ／ 開始 ${dateTimeStr(job.startedAt)}${job.endedAt ? ` ／ 終了 ${dateTimeStr(job.endedAt)}` : ""}`)
  );
}

function miniKpi(label, value) {
  return el("div", { class: "kpi" }, [el("div", { class: "k-label" }, label), el("div", { class: "k-value" }, value)]);
}

function panel(title, content) {
  return el("div", { class: "panel" }, [el("h3", {}, title), content]);
}

function resultPanel(job) {
  const r = job.result || {};
  const line = (label, value) =>
    el("div", { style: { display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: "1px solid var(--color-border-tertiary)" } }, [
      el("span", { class: "muted" }, label),
      el("strong", {}, value),
    ]);

  const defectLines = defectModes.list()
    .filter((d) => (r.defects || {})[d.id])
    .map((d) => line(`　${d.name}`, `${r.defects[d.id]} 個`));

  return el("div", {}, [
    line("生産数", fmt(r.productionCount, "個")),
    line("ロット数", fmt(r.lotCount, "個")),
    line("総ショット数", fmt(r.totalShots, "")),
    line("ロス", fmt(r.loss, "個")),
    line("不良数（合計）", `${totalDefects(r)} 個`),
    line("不良率", `${defectRate(r).toFixed(2)} %`),
    ...defectLines,
  ]);
}

function comparePanel(cmp) {
  const row = (label, actual, std, ach) =>
    el("div", { style: { display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: "1px solid var(--color-border-tertiary)" } }, [
      el("span", { class: "muted" }, label),
      el("span", {}, [
        el("strong", {}, actual),
        el("span", { class: "muted" }, ` / 標準 ${std}`),
        ach != null ? el("span", { class: `badge ${ach >= 100 ? "badge-success" : "badge-warning"}`, style: { marginLeft: "8px" } }, `${ach}%`) : null,
      ]),
    ]);

  return el("div", {}, [
    row("段取り時間", `${cmp.actualSetup}分`, `${cmp.stdSetup}分`, cmp.setupAchievement),
    row("SPM", cmp.actualSpm ? `${cmp.actualSpm}` : "—", `${cmp.stdSpm}`, cmp.spmAchievement),
    el("div", { class: "muted", style: { fontSize: "0.8rem", marginTop: "10px" } }, "達成率 ≥100% は標準以上を示します（段取りは短いほど良）。"),
  ]);
}

function eventsTable(job) {
  if (!job.events.length) return el("div", { class: "muted" }, "イベント記録はありません");
  const head = el("tr", {}, [el("th", {}, "種類"), el("th", { class: "cell-right" }, "所要"), el("th", { class: "cell-center" }, "状態")]);
  const rows = job.events.map((e) =>
    el("tr", {}, [
      el("td", {}, eventLabel(e.type)),
      el("td", { class: "cell-right" }, clock(eventDurationMs(e))),
      el("td", { class: "cell-center" }, e.endedAt == null ? el("span", { class: "badge badge-info" }, "実行中") : el("span", { class: "muted" }, "完了")),
    ])
  );
  return el("table", { class: "data" }, [el("thead", {}, head), el("tbody", {}, rows)]);
}

function fmt(v, unit) {
  if (v == null) return "—";
  return `${v.toLocaleString()} ${unit}`.trim();
}

function doExport() {
  try {
    exportJobsCsv();
    toast("CSVをエクスポートしました", "success");
  } catch (err) {
    console.error(err);
    toast("エクスポートに失敗しました", "danger");
  }
}
