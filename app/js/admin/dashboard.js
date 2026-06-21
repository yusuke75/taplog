// Dashboard (要件 §8): primary KPIs 設備別稼働率 / 品番別稼働率,
// auxiliary 全体稼働率・平均段取り・不良率・総ショット数, period switch.

import { el, icon, mount } from "../lib/dom.js";
import { machines, products, jobs } from "../data/store.js";
import { utilization, setupMinutes, totalDefects } from "../domain/calc.js";
import { now } from "../lib/id.js";
import { adminShell, adminHeader } from "./shell.js";

const PERIODS = [
  { id: "today", label: "今日" },
  { id: "week", label: "今週" },
  { id: "month", label: "今月" },
];

let period = "today";

export function renderDashboard() {
  const main = adminShell("/admin/dashboard");
  draw(main);
}

function draw(main) {
  const list = jobsInPeriod(period);

  mount(
    main,
    adminHeader("ダッシュボード", periodTabs(main)),
    auxKpis(list),
    el("div", { class: "two-col" }, [
      panel("設備別 稼働率", machineUtilChart(list)),
      panel("品番別 稼働率", productUtilChart(list)),
    ])
  );
}

function periodTabs(main) {
  return el(
    "div",
    { class: "period-tabs" },
    PERIODS.map((p) =>
      el(
        "button",
        {
          class: `period-tab ${period === p.id ? "active" : ""}`,
          onclick: () => {
            period = p.id;
            draw(main);
          },
        },
        p.label
      )
    )
  );
}

function jobsInPeriod(p) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (p === "week") start.setDate(start.getDate() - start.getDay());
  if (p === "month") start.setDate(1);
  const from = start.getTime();
  return jobs.list().filter((j) => j.startedAt >= from || (j.endedAt && j.endedAt >= from));
}

function avg(nums) {
  const v = nums.filter((n) => n != null && !Number.isNaN(n));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
}

function auxKpis(list) {
  const util = Math.round(avg(list.map((j) => utilization(j, now()))));
  const setup = Math.round(avg(list.map((j) => setupMinutes(j)).filter((m) => m > 0)));
  const prod = list.reduce((s, j) => s + (j.result?.productionCount || 0), 0);
  const def = list.reduce((s, j) => s + totalDefects(j.result), 0);
  const shots = list.reduce((s, j) => s + (j.result?.totalShots || 0), 0);
  const dRate = prod > 0 ? ((def / prod) * 100).toFixed(2) : "0.00";

  const kpi = (label, value, iconName) =>
    el("div", { class: "kpi" }, [
      el("div", { class: "k-label" }, [icon(iconName, { style: { fontSize: "18px" } }), label]),
      el("div", { class: "k-value" }, value),
    ]);

  return el("div", { class: "kpi-grid" }, [
    kpi("全体稼働率", `${util}%`, "speed"),
    kpi("平均段取り時間", `${setup}分`, "build"),
    kpi("不良率", `${dRate}%`, "report"),
    kpi("総ショット数", shots.toLocaleString(), "bolt"),
  ]);
}

function panel(title, content) {
  return el("div", { class: "panel" }, [el("h3", {}, title), content]);
}

/** Group jobs and average utilization per key, render a bar chart. */
function utilChart(list, keyFn, labelFn) {
  const groups = new Map();
  list.forEach((j) => {
    const k = keyFn(j);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(utilization(j, now()));
  });

  if (groups.size === 0) {
    return el("div", { class: "empty", style: { padding: "24px" } }, [
      icon("bar_chart"),
      el("div", {}, "対象データがありません"),
    ]);
  }

  const rows = [...groups.entries()]
    .map(([k, vals]) => ({ label: labelFn(k), value: Math.round(avg(vals)) }))
    .sort((a, b) => b.value - a.value);

  return el(
    "div",
    { class: "bar-chart" },
    rows.map((r) =>
      el("div", { class: "bar-row" }, [
        el("span", {}, r.label),
        el("div", { class: "bar-track" }, el("div", { class: "bar-fill", style: { width: `${r.value}%` } })),
        el("span", { class: "bar-value" }, `${r.value}%`),
      ])
    )
  );
}

function machineUtilChart(list) {
  return utilChart(
    list,
    (j) => j.machineId,
    (id) => {
      const m = machines.get(id);
      return m ? m.name : "不明";
    }
  );
}

function productUtilChart(list) {
  return utilChart(
    list,
    (j) => j.productId,
    (id) => {
      const p = products.get(id);
      return p ? p.code : "不明";
    }
  );
}
