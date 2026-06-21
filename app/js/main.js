// ============================================================
// TapLog entry point — wires routes to views.
// ============================================================

import { Router } from "./lib/router.js";
import { renderLauncher } from "./launcher.js";
import { renderLogin } from "./worker/login.js";
import { renderHome } from "./worker/home.js";
import { renderJobNew } from "./worker/job-new.js";
import { renderRecord } from "./worker/record.js";
import { renderResult } from "./worker/result.js";
import { renderAdminHome } from "./admin/home.js";
import { renderMasters } from "./admin/masters.js";
import { renderDashboard } from "./admin/dashboard.js";
import { renderJobs, renderJobDetail } from "./admin/jobs.js";

const router = new Router();

router
  .on("/", renderLauncher)
  // --- worker ---
  .on("/worker/login", renderLogin)
  .on("/worker", renderHome)
  .on("/worker/job/new", renderJobNew)
  .on("/worker/job/:id", renderRecord)
  .on("/worker/job/:id/result", renderResult)
  // --- admin ---
  .on("/admin", renderAdminHome)
  .on("/admin/masters/:type", renderMasters)
  .on("/admin/dashboard", renderDashboard)
  .on("/admin/jobs", renderJobs)
  .on("/admin/jobs/:id", renderJobDetail)
  .fallback(renderLauncher);

// Allow views to request an in-place re-render (e.g. after login/handover,
// master edits) without changing the route.
window.addEventListener("taplog:rerender", () => router.resolve());

router.start();
