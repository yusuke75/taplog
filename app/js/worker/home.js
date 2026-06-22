// Worker home (要件 §7): the operator's group equipment as cards showing
// in-progress jobs. Tapping an idle card starts a new job; tapping an
// active card opens recording. Cards update live (elapsed time).

import { el, icon, mount } from "../lib/dom.js";
import { machines, products, jobs, session } from "../data/store.js";
import { Router } from "../lib/router.js";
import { eventLabel } from "../domain/events.js";
import { elapsed, clock, eventDurationMs } from "../lib/time.js";
import { now } from "../lib/id.js";
import { viewInterval, clearViewTimers } from "../lib/view.js";
import { workerShell, requireOperator } from "./shell.js";

const APP_ROOT = () => document.getElementById("app");

export function renderHome() {
  clearViewTimers();
  if (!requireOperator()) return;

  const { root, body } = workerShell({ title: "設備一覧", homeLink: true });

  // updaters refresh each card's dynamic text/badge in place every second
  const updaters = [];

  // Show only equipment in the operator's group (要件). Operators with no
  // group (e.g. admins) see all equipment.
  const op = session.current();
  const list = op && op.groupId
    ? machines.active().filter((m) => m.groupId === op.groupId)
    : machines.active();

  if (op && op.groupName) {
    body.append(
      el("div", { class: "group-chip" }, [icon("groups"), op.groupName])
    );
  }

  if (list.length === 0) {
    body.append(emptyState(!!(op && op.groupId)));
  } else {
    list.forEach((m) => body.append(machineCard(m, updaters)));
  }

  mount(APP_ROOT(), root);

  if (updaters.length) viewInterval(() => updaters.forEach((fn) => fn()), 1000);
}

function machineCard(machine, updaters) {
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
  const line2 = el("div", { class: "line2" });
  const badgeHost = el("span", {});

  // recompute the live parts (elapsed time + status badge) from fresh state
  const update = () => {
    const fresh = jobs.get(job.id) || job;
    const running = jobs.runningEvent(fresh.id);
    if (running) {
      line2.textContent = `${eventLabel(running.type)} ・ ${clock(eventDurationMs(running))} 経過`;
      mount(badgeHost, el("span", { class: "badge badge-warning" }, `${eventLabel(running.type)}中`));
    } else {
      const shots = fresh.result?.totalShots;
      const shotText = shots ? `ショット ${shots.toLocaleString()}` : "稼働中";
      line2.textContent = `${shotText} ・ 経過 ${elapsed(now() - fresh.startedAt)}`;
      mount(badgeHost, el("span", { class: "badge badge-success" }, "生産中"));
    }
  };
  update();
  updaters.push(update);

  return el("div", { class: "machine-card", onclick: () => Router.go(`/worker/job/${job.id}`) }, [
    el("div", { class: "machine-no" }, machine.name),
    el("div", { class: "machine-main" }, [
      el("div", { class: "line1" }, `品番 ${product ? product.code : "-"}`),
      line2,
    ]),
    badgeHost,
  ]);
}

function emptyState(grouped) {
  return el("div", { class: "empty" }, [
    icon("precision_manufacturing"),
    el("div", {}, grouped ? "担当グループの設備がありません" : "有効な設備がありません"),
    el(
      "div",
      { style: { fontSize: "0.85rem", marginTop: "4px" } },
      grouped ? "管理者にグループ・設備の割り当てを確認してください" : "管理者に設備マスタの登録を依頼してください"
    ),
  ]);
}
