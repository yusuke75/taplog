// Record list (記録一覧): history of events for a job, with edit/delete
// for correcting mis-records (要件 §4 イベント).

import { el, icon, mount } from "../lib/dom.js";
import { jobs, machines, products } from "../data/store.js";
import { Router } from "../lib/router.js";
import { toast, openModal, confirmModal, field } from "../lib/ui.js";
import { EVENT_TYPES, eventType, eventLabel } from "../domain/events.js";
import { clock, timeOfDay, eventDurationMs, toDatetimeLocal, fromDatetimeLocal } from "../lib/time.js";
import { workerShell, requireOperator } from "./shell.js";

const APP_ROOT = () => document.getElementById("app");

export function renderRecords(params) {
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
    title: "記録一覧",
    onBack: () => Router.go(`/worker/job/${job.id}`),
  });

  body.append(
    el("div", { class: "worker-section-label" }, `${machine ? machine.name : "?"} ・ ${product ? product.code : "?"} の作業記録`)
  );

  const events = [...job.events].sort((a, b) => a.startedAt - b.startedAt);

  if (events.length === 0) {
    body.append(
      el("div", { class: "empty" }, [icon("history"), el("div", {}, "記録はまだありません")])
    );
  } else {
    events.forEach((e) => body.append(recordRow(job.id, e)));
  }

  mount(APP_ROOT(), root);
}

function recordRow(jobId, e) {
  const t = eventType(e.type);
  const running = e.endedAt == null;
  const timeText = running
    ? `${timeOfDay(e.startedAt)} 〜 実行中`
    : `${timeOfDay(e.startedAt)} 〜 ${timeOfDay(e.endedAt)}`;
  const durText = running ? "実行中" : clock(eventDurationMs(e));

  return el("div", { class: "rec-row" }, [
    el("div", { class: "rec-icon" }, icon(t ? t.icon : "circle")),
    el("div", { class: "rec-main" }, [
      el("div", { class: "rec-name" }, eventLabel(e.type)),
      el("div", { class: "rec-time" }, timeText),
    ]),
    el("div", { class: "rec-dur" }, durText),
    el("div", { class: "rec-actions" }, [
      el("button", { class: "icon-btn", title: "編集", onclick: () => openEdit(jobId, e) }, icon("edit")),
      el("button", { class: "icon-btn danger", title: "削除", onclick: () => askDelete(jobId, e) }, icon("delete")),
    ]),
  ]);
}

function openEdit(jobId, e) {
  const typeSelect = el(
    "select",
    {},
    EVENT_TYPES.map((t) => el("option", { value: t.id, selected: t.id === e.type }, t.label))
  );
  const startInput = el("input", { type: "datetime-local", value: toDatetimeLocal(e.startedAt) });
  const endInput = el("input", {
    type: "datetime-local",
    value: e.endedAt == null ? "" : toDatetimeLocal(e.endedAt),
  });

  openModal({
    title: "記録を編集",
    body: [
      field("作業の種類", typeSelect),
      field("開始時刻", startInput),
      field("終了時刻（空欄＝実行中）", endInput),
    ],
    actions: [
      { label: "キャンセル", kind: "btn-ghost", onClick: (c) => c() },
      {
        label: "保存",
        kind: "btn-primary",
        onClick: (close) => {
          const startedAt = fromDatetimeLocal(startInput.value);
          const endedAt = fromDatetimeLocal(endInput.value);
          if (startedAt == null) return toast("開始時刻を入力してください", "danger");
          if (endedAt != null && endedAt < startedAt) return toast("終了時刻は開始時刻以降にしてください", "danger");
          jobs.updateEvent(jobId, e.id, { type: typeSelect.value, startedAt, endedAt });
          toast("記録を更新しました", "success");
          close();
          rerender();
        },
      },
    ],
  });
}

function askDelete(jobId, e) {
  confirmModal({
    title: "記録を削除",
    message: `「${eventLabel(e.type)}」（${timeOfDay(e.startedAt)}）を削除します。よろしいですか？`,
    onConfirm: () => {
      jobs.deleteEvent(jobId, e.id);
      toast("記録を削除しました", "success");
      rerender();
    },
  });
}

function rerender() {
  window.dispatchEvent(new CustomEvent("taplog:rerender"));
}
