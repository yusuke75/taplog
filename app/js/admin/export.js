// CSV export of jobs (要件 §8). Builds a UTF-8 (BOM) CSV so Excel
// reads Japanese correctly, then triggers a download.

import { machines, products, users, jobs, defectModes } from "../data/store.js";
import { dateTimeStr } from "../lib/time.js";
import { now } from "../lib/id.js";
import { totalDefects, setupMinutes, inspectMinutes, loadMinutes, utilization } from "../domain/calc.js";

function csvCell(value) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildCsv() {
  const modes = defectModes.list();
  const header = [
    "設備",
    "品番",
    "品番名",
    "ロット",
    "状態",
    "記録者",
    "開始",
    "終了",
    "負荷時間(分)",
    "段取り計(分)",
    "検査計(分)",
    "稼働率(%)",
    "生産数",
    "ロット数",
    "総ショット数",
    "ロス",
    "不良数",
    ...modes.map((d) => `不良:${d.name}`),
    "コメント",
  ];

  const rows = jobs.list().map((j) => {
    const m = machines.get(j.machineId);
    const p = products.get(j.productId);
    const op = users.get(j.operatorId);
    const r = j.result || {};
    return [
      m ? m.name : "",
      p ? p.code : "",
      p ? p.name : "",
      j.lot,
      j.status === "active" ? "進行中" : "完了",
      op ? op.name : "",
      dateTimeStr(j.startedAt),
      j.endedAt ? dateTimeStr(j.endedAt) : "",
      loadMinutes(j, now()),
      setupMinutes(j),
      inspectMinutes(j),
      utilization(j, now()),
      r.productionCount ?? "",
      r.lotCount ?? "",
      r.totalShots ?? "",
      r.loss ?? "",
      totalDefects(r),
      ...modes.map((d) => (r.defects || {})[d.id] ?? 0),
      r.comment ?? "",
    ];
  });

  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export function exportJobsCsv() {
  const csv = "﻿" + buildCsv();
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `taplog_jobs_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
