// Record screen (要件 §7): select machine(job) -> tap event type ->
// start/stop (time auto-recorded). Shows live stopwatch + auto totals.

import { el, icon, mount } from "../lib/dom.js";
import { products, machines, jobs, session } from "../data/store.js";
import { Router } from "../lib/router.js";
import { toast, confirmModal } from "../lib/ui.js";
import { EVENT_TYPES, eventLabel } from "../domain/events.js";
import { clock, eventDurationMs } from "../lib/time.js";
import { setupMinutes, inspectMinutes, loadMinutes } from "../domain/calc.js";
import { now } from "../lib/id.js";
import { viewInterval, clearViewTimers } from "../lib/view.js";
import { workerShell, requireOperator } from "./shell.js";

const APP_ROOT = () => document.getElementById("app");

export function renderRecord(params) {
  clearViewTimers();
  if (!requireOperator()) return;

  const job = jobs.get(params.id);
  if (!job) {
    toast("ジョブが見つかりません", "danger");
    Router.go("/worker");
    return;
  }

  const machine = machines.get(job.machineId);
  const product = products.get(job.productId);

  const { root, body } = workerShell({
    title: `${machine ? machine.name : "?"} ・ ${product ? product.code : "?"}`,
    onBack: () => Router.go("/worker"),
  });

  // running banner placeholder (updated live)
  const banner = el("div", {});
  body.append(banner);

  // event grid
  body.append(el("div", { class: "worker-section-label" }, "作業を記録（タップで開始／終了）"));
  const grid = el("div", { class: "event-grid" });
  body.append(grid);

  // auto metrics
  const metricRow = el("div", { class: "metric-row", style: { marginTop: "6px" } });
  body.append(metricRow);

  // CTAs
  body.append(
    el(
      "button",
      { class: "worker-cta tonal", onclick: () => Router.go(`/worker/job/${job.id}/records`) },
      [icon("history"), "記録一覧"]
    ),
    el("button", { class: "worker-cta", onclick: () => Router.go(`/worker/job/${job.id}/result`) }, [
      "生産実績を入力",
      icon("arrow_forward"),
    ]),
    el(
      "button",
      {
        class: "worker-cta tonal",
        style: { background: "var(--color-background-secondary)", color: "var(--color-text-secondary)" },
        onclick: () => confirmFinish(job.id),
      },
      [icon("stop_circle"), "ジョブを終了"]
    )
  );

  let lastRunningId = "__init__";
  const repaint = () => {
    const fresh = jobs.get(job.id);
    if (!fresh) return;
    const running = jobs.runningEvent(fresh.id);
    // Banner + metrics tick every second (live clock); the grid is only
    // re-mounted when the running event changes, to avoid losing taps.
    mount(banner, running ? runningBanner(fresh, running) : idleBanner());
    paintMetrics(metricRow, fresh);
    const runId = running ? running.id : null;
    if (runId !== lastRunningId) {
      lastRunningId = runId;
      paintGrid(grid, fresh, running);
    }
  };

  repaint();
  viewInterval(repaint, 1000);

  mount(APP_ROOT(), root);
}

function runningBanner(job, running) {
  return el("div", { class: "run-banner" }, [
    el("div", { style: { flex: "1" } }, [
      el("div", { class: "run-name" }, eventLabel(running.type)),
      el("div", { class: "run-sub" }, "実行中"),
    ]),
    el("div", { class: "run-clock" }, clock(eventDurationMs(running))),
    el(
      "button",
      {
        class: "run-stop",
        onclick: () => {
          jobs.stopEvent(job.id, running.id);
          toast(`${eventLabel(running.type)} を終了`, "success");
        },
      },
      "終了"
    ),
  ]);
}

function idleBanner() {
  return el(
    "div",
    {
      class: "run-banner",
      style: { borderStyle: "dashed", borderColor: "var(--color-border-secondary)", justifyContent: "center" },
    },
    [el("div", { style: { color: "var(--color-text-tertiary)", textAlign: "center", width: "100%" } }, "実行中の作業はありません")]
  );
}

function paintGrid(grid, job, running) {
  const buttons = EVENT_TYPES.map((t) => {
    const isRunning = running && running.type === t.id;
    return el(
      "button",
      {
        class: `event-btn ${isRunning ? "is-running" : ""}`,
        onclick: () => {
          if (isRunning) {
            jobs.stopEvent(job.id, running.id);
            toast(`${t.label} を終了`, "success");
          } else {
            jobs.startEvent(job.id, t.id, session.current().id);
            toast(`${t.label} を開始`);
          }
        },
      },
      [icon(t.icon), el("span", {}, t.label), isRunning ? el("span", { class: "badge badge-info" }, "実行中") : null]
    );
  });
  mount(grid, ...buttons);
}

function paintMetrics(row, job) {
  const tile = (label, value) =>
    el("div", { class: "metric-tile" }, [
      el("div", { class: "m-label" }, label),
      el("div", { class: "m-value" }, value),
    ]);
  mount(
    row,
    tile("段取り計", `${setupMinutes(job)}分`),
    tile("検査計", `${inspectMinutes(job)}分`),
    tile("負荷", `${loadMinutes(job, now())}分`)
  );
}

function confirmFinish(jobId) {
  confirmModal({
    title: "ジョブを終了しますか？",
    message: "終了後は記録できなくなります。生産実績の入力は終了前に行ってください。",
    confirmLabel: "終了する",
    kind: "btn-primary",
    onConfirm: () => {
      jobs.finish(jobId);
      clearViewTimers();
      toast("ジョブを終了しました", "success");
      Router.go("/worker");
    },
  });
}
