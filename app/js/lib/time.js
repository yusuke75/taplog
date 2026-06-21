// ============================================================
// Time / duration formatting helpers.
// ============================================================

import { now } from "./id.js";

/** ms -> "MM:SS" (for running stopwatches). */
export function clock(ms) {
  if (ms == null || ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** ms -> "H:MM" elapsed (for long-running jobs). */
export function elapsed(ms) {
  if (ms == null || ms < 0) ms = 0;
  const total = Math.floor(ms / 60000);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

/** ms duration -> whole minutes (rounded). */
export function toMinutes(ms) {
  return Math.round((ms || 0) / 60000);
}

/** Duration of an event in ms; open events run to "now". */
export function eventDurationMs(event) {
  const end = event.endedAt == null ? now() : event.endedAt;
  return Math.max(0, end - event.startedAt);
}

/** epoch ms -> "HH:MM" local clock time. */
export function timeOfDay(ms) {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** epoch ms -> "YYYY/MM/DD". */
export function dateStr(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** epoch ms -> "YYYY/MM/DD HH:MM". */
export function dateTimeStr(ms) {
  return `${dateStr(ms)} ${timeOfDay(ms)}`;
}
