// Admin home (要件 §8): operating summary + entry tiles to masters
// and analytics.

import { el, icon } from "../lib/dom.js";
import { machines, products, users, defectModes, productMachines, jobs } from "../data/store.js";
import { dateStr } from "../lib/time.js";
import { now } from "../lib/id.js";
import { utilization, defectRate, totalDefects, setupMinutes } from "../domain/calc.js";
import { adminShell, adminHeader } from "./shell.js";

export function renderAdminHome() {
  const main = adminShell("/admin");
  const todays = todaysJobs();

  main.append(
    adminHeader(
      "管理者ホーム",
      el("span", { class: "breadcrumb" }, dateStr(now()))
    ),
    kpiGrid(todays),
    sectionHead(),
    tileGrid()
  );
}

function todaysJobs() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const from = start.getTime();
  return jobs.list().filter((j) => j.startedAt >= from || (j.endedAt && j.endedAt >= from));
}

function avg(nums) {
  const valid = nums.filter((n) => n != null && !Number.isNaN(n));
  if (!valid.length) return 0;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function kpiGrid(todays) {
  const util = Math.round(avg(todays.map((j) => utilization(j, now()))));
  const setup = Math.round(avg(todays.map((j) => setupMinutes(j)).filter((m) => m > 0)));
  const totProd = todays.reduce((s, j) => s + (j.result?.productionCount || 0), 0);
  const totDef = todays.reduce((s, j) => s + totalDefects(j.result), 0);
  const dRate = totProd > 0 ? ((totDef / totProd) * 100).toFixed(1) : "0.0";

  const kpi = (label, value, sub, iconName) =>
    el("div", { class: "kpi" }, [
      el("div", { class: "k-label" }, [icon(iconName, { style: { fontSize: "18px" } }), label]),
      el("div", { class: "k-value" }, value),
      el("div", { class: "k-sub" }, sub),
    ]);

  return el("div", { class: "kpi-grid" }, [
    kpi("本日の稼働率", `${util}%`, "全設備平均", "speed"),
    kpi("平均段取り", `${setup}分`, "本日のジョブ平均", "build"),
    kpi("本日の不良率", `${dRate}%`, `不良 ${totDef} / 生産 ${totProd.toLocaleString()}`, "report"),
    kpi("本日のジョブ", `${todays.length}件`, "開始/終了ベース", "receipt_long"),
  ]);
}

function sectionHead() {
  return el("div", { class: "section-head" }, [
    el("h2", {}, "マスタ管理"),
    el("a", { href: "#/admin/dashboard", class: "breadcrumb", style: { color: "var(--color-text-info)" } }, [
      "集計・分析を開く ",
      icon("arrow_forward", { style: { fontSize: "16px" } }),
    ]),
  ]);
}

function tileGrid() {
  const tile = (href, iconName, title, count) =>
    el("a", { href, class: "master-tile" }, [
      icon(iconName),
      el("div", { class: "t-title" }, title),
      el("div", { class: "t-count" }, count),
    ]);

  return el("div", { class: "tile-grid" }, [
    tile("#/admin/masters/products", "inventory_2", "品番マスタ", `${products.list().length} 件`),
    tile("#/admin/masters/machines", "precision_manufacturing", "設備マスタ", `${machines.list().length} 台`),
    tile("#/admin/masters/users", "group", "ユーザー", `${users.list().length} 名`),
    tile("#/admin/masters/defects", "report", "不良モード", `${defectModes.active().length} 種（有効）`),
    tile("#/admin/product-machines", "link", "品番×設備 対応", `${productMachines.list().length} 件`),
  ]);
}
