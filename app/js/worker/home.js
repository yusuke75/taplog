// Worker home (要件 §7): assigned machines as cards showing in-progress
// jobs, plus a big "新規ジョブ開始" CTA.

import { el, icon, mount } from "../lib/dom.js";
import { machines, products, jobs } from "../data/store.js";
import { Router } from "../lib/router.js";
import { eventLabel } from "../domain/events.js";
import { elapsed, eventDurationMs } from "../lib/time.js";
import { now } from "../lib/id.js";
import { workerShell, requireOperator } from "./shell.js";

const APP_ROOT = () => document.getElementById("app");

export function renderHome() {
  if (!requireOperator()) return;

  const { root, body } = workerShell({ title: "担当号機" });

  const list = machines.active();
  if (list.length === 0) {
    body.append(emptyState());
  } else {
    list.forEach((m) => body.append(machineCard(m)));
  }

  body.append(
    el("button", { class: "worker-cta", onclick: () => Router.go("/worker/job/new") }, [
      icon("add"),
      "新規ジョブ開始",
    ])
  );

  mount(APP_ROOT(), root);
}

function machineCard(machine) {
  const job = jobs.forMachine(machine.id);

  if (!job) {
    return el(
      "div",
      { class: "machine-card is-idle", onclick: () => Router.go(`/worker/job/new?machine=${machine.id}`) },
      [
        el("div", { class: "machine-no", style: { color: "var(--color-text-secondary)" } }, machine.name),
        el("div", { class: "machine-main" }, [
          el("div", { class: "line1", style: { color: "var(--color-text-secondary)" } }, "ジョブ未開始"),
          el("div", { class: "line2" }, "タップして開始"),
        ]),
        el("span", { class: "badge badge-neutral" }, "空き"),
      ]
    );
  }

  const product = products.get(job.productId);
  const running = jobs.runningEvent(job.id);
  const shots = job.result?.totalShots;

  let line2, badge;
  if (running) {
    line2 = `${eventLabel(running.type)} ・ ${elapsed(eventDurationMs(running))} 経過`;
    badge = el("span", { class: "badge badge-warning" }, eventLabel(running.type) + "中");
  } else {
    const shotText = shots ? `ショット ${shots.toLocaleString()}` : "稼働中";
    line2 = `${shotText} ・ 経過 ${elapsed(now() - job.startedAt)}`;
    badge = el("span", { class: "badge badge-success" }, "生産中");
  }

  return el("div", { class: "machine-card", onclick: () => Router.go(`/worker/job/${job.id}`) }, [
    el("div", { class: "machine-no" }, machine.name),
    el("div", { class: "machine-main" }, [
      el("div", { class: "line1" }, `品番 ${product ? product.code : "-"}`),
      el("div", { class: "line2" }, line2),
    ]),
    badge,
  ]);
}

function emptyState() {
  return el("div", { class: "empty" }, [
    icon("precision_manufacturing"),
    el("div", {}, "有効な号機がありません"),
    el("div", { style: { fontSize: "0.85rem", marginTop: "4px" } }, "管理者に号機マスタの登録を依頼してください"),
  ]);
}
