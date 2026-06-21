// ============================================================
// Auto-calculations & standard comparison (要件 §6).
// All pure functions over a job + masters; no side effects.
// ============================================================

import { EVENT_TYPES, EVENT_CATEGORY } from "./events.js";
import { eventDurationMs, toMinutes } from "../lib/time.js";

const CATEGORY_BY_TYPE = new Map(EVENT_TYPES.map((e) => [e.id, e.category]));

/** Total defect count = sum of per-mode defect counts (§5/§6). */
export function totalDefects(result) {
  if (!result || !result.defects) return 0;
  return Object.values(result.defects).reduce((sum, n) => sum + (Number(n) || 0), 0);
}

/** Sum event durations (ms) for a given category. */
function categoryMs(job, category) {
  return job.events
    .filter((e) => CATEGORY_BY_TYPE.get(e.type) === category)
    .reduce((sum, e) => sum + eventDurationMs(e), 0);
}

/** 段取り計（分） */
export function setupMinutes(job) {
  return toMinutes(categoryMs(job, EVENT_CATEGORY.SETUP));
}

/** 検査計（分） */
export function inspectMinutes(job) {
  return toMinutes(categoryMs(job, EVENT_CATEGORY.INSPECT));
}

/** その他（分）— トラブル・片付け・休憩 等 */
export function otherMinutes(job) {
  return toMinutes(categoryMs(job, EVENT_CATEGORY.OTHER));
}

/** 負荷時間（分）＝ ジョブ開始〜終了（進行中はnow）の総経過。 */
export function loadMinutes(job, nowMs) {
  const end = job.endedAt == null ? nowMs : job.endedAt;
  return toMinutes(Math.max(0, end - job.startedAt));
}

/**
 * 稼働率（%）。負荷時間のうち、段取り・検査・その他（非稼働）を除いた
 * 正味稼働時間の割合。簡易モデルだが主指標の算出に用いる（§8）。
 */
export function utilization(job, nowMs) {
  const load = loadMinutes(job, nowMs);
  if (load <= 0) return 0;
  const nonRun = setupMinutes(job) + inspectMinutes(job) + otherMinutes(job);
  const run = Math.max(0, load - nonRun);
  return Math.round((run / load) * 100);
}

/** 不良率（%）＝ 不良数 / 生産数。 */
export function defectRate(result) {
  if (!result || !result.productionCount) return 0;
  return (totalDefects(result) / result.productionCount) * 100;
}

/**
 * 標準比較（§6）。実績段取り時間と標準段取り時間の差異・達成率、
 * 実績SPMと標準SPMの比較を返す。
 */
export function standardComparison(job, product, nowMs) {
  const actualSetup = setupMinutes(job);
  const stdSetup = product ? product.standardSetupMin : 0;
  const stdSpm = product ? product.standardSpm : 0;

  // 実績SPM ＝ 総ショット数 / 正味稼働分 (概算)
  const load = loadMinutes(job, nowMs);
  const runMin = Math.max(1, load - actualSetup - inspectMinutes(job) - otherMinutes(job));
  const shots = job.result?.totalShots || 0;
  const actualSpm = shots > 0 ? Math.round(shots / runMin) : 0;

  return {
    actualSetup,
    stdSetup,
    setupDiff: actualSetup - stdSetup,
    setupAchievement: stdSetup > 0 ? Math.round((stdSetup / Math.max(1, actualSetup)) * 100) : null,
    actualSpm,
    stdSpm,
    spmAchievement: stdSpm > 0 && actualSpm > 0 ? Math.round((actualSpm / stdSpm) * 100) : null,
  };
}
