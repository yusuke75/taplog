// ============================================================
// TapLog entry point — initialises the data layer (local or
// Supabase shared DB), then wires routes to views.
// ============================================================

import { Router } from "./lib/router.js";
import { el, icon, mount } from "./lib/dom.js";
import { init as initStore, subscribe, getMode } from "./data/store.js";
import { renderLauncher } from "./launcher.js";
import { renderLogin } from "./worker/login.js";
import { renderHome } from "./worker/home.js";
import { renderJobNew } from "./worker/job-new.js";
import { renderRecord } from "./worker/record.js";
import { renderRecords } from "./worker/records.js";
import { renderResult } from "./worker/result.js";
import { renderAdminHome } from "./admin/home.js";
import { renderMasters } from "./admin/masters.js";
import { renderProductMachines } from "./admin/product-machines.js";
import { renderDashboard } from "./admin/dashboard.js";
import { renderJobs, renderJobDetail } from "./admin/jobs.js";

const APP_ROOT = () => document.getElementById("app");
const router = new Router();

router
  .on("/", renderLauncher)
  .on("/worker/login", renderLogin)
  .on("/worker", renderHome)
  .on("/worker/job/new", renderJobNew)
  .on("/worker/job/:id", renderRecord)
  .on("/worker/job/:id/records", renderRecords)
  .on("/worker/job/:id/result", renderResult)
  .on("/admin", renderAdminHome)
  .on("/admin/masters/:type", renderMasters)
  .on("/admin/product-machines", renderProductMachines)
  .on("/admin/dashboard", renderDashboard)
  .on("/admin/jobs", renderJobs)
  .on("/admin/jobs/:id", renderJobDetail)
  .fallback(renderLauncher);

// ---- live re-render on data changes (local actions OR other devices) ----
// Forms keep a local working copy, so skip auto-rerender there to avoid
// wiping in-progress input when a remote change arrives.
const NO_AUTO_RERENDER = [/\/result$/, /\/job\/new/];
let rerenderTimer = null;
function scheduleRerender() {
  if (NO_AUTO_RERENDER.some((re) => re.test(location.hash))) return;
  clearTimeout(rerenderTimer);
  rerenderTimer = setTimeout(() => router.resolve(), 40);
}

window.addEventListener("taplog:rerender", () => router.resolve());
subscribe(scheduleRerender);

// Reset scroll to top on navigation (not on in-place re-renders).
window.addEventListener("hashchange", () => window.scrollTo(0, 0));

// ---- boot ----
showLoading();
initStore()
  .then(() => {
    if (getMode() === "remote") console.info("TapLog: connected to Supabase shared DB.");
    router.start();
  })
  .catch((err) => {
    console.error("TapLog: initialisation failed.", err);
    showError(err);
  });

function showLoading() {
  mount(
    APP_ROOT(),
    el("div", { style: centered() }, [
      el("div", { class: "spinner" }),
      el("div", { style: { color: "var(--color-text-secondary)" } }, "読み込み中…"),
    ])
  );
}

function showError(err) {
  mount(
    APP_ROOT(),
    el("div", { style: centered() }, [
      icon("cloud_off", { style: { fontSize: "48px", color: "var(--color-text-danger)" } }),
      el("div", { style: { fontWeight: "600", fontSize: "1.1rem" } }, "共有DBに接続できませんでした"),
      el("div", { style: { color: "var(--color-text-secondary)", maxWidth: "420px", textAlign: "center" } }, String(err.message || err)),
      el("button", { class: "btn btn-primary", onclick: () => location.reload() }, [icon("refresh"), "再読み込み"]),
    ])
  );
}

function centered() {
  return {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "14px",
    padding: "24px",
  };
}
