// ============================================================
// TapLog store — single source of truth.
//
// Two backends, same public API:
//   - "remote": Supabase shared DB (multi-device + realtime). Writes
//     are optimistic (cache updates instantly) and queued to an
//     offline outbox if the network is down, then flushed on reconnect.
//   - "local": localStorage only (used when Supabase is not configured).
//
// Reads are always synchronous from an in-memory cache, so views are
// unchanged. All cache updates are immutable (coding-style rule).
// ============================================================

import { buildSeed, emptyResult } from "./seed.js";
import { uid, now } from "../lib/id.js";
import { isSupabaseConfigured } from "./supabase-config.js";
import * as remote from "./remote.js";

const STORAGE_KEY = "taplog.state.v1";
const SESSION_KEY = "taplog.session.v1";
const OUTBOX_KEY = "taplog.outbox.v1";

let mode = "local"; // set during init()
let cache = emptyCache();
const listeners = new Set();

function emptyCache() {
  return { machines: [], products: [], users: [], defectModes: [], jobs: [], session: { operatorId: null } };
}

// ============================================================
// Initialisation — called once at startup before the first render.
// ============================================================
export async function init() {
  if (isSupabaseConfigured()) {
    mode = "remote";
    const data = await remote.loadAll();
    cache = { ...data, session: loadSession() };
    remote.subscribeRealtime(scheduleReload);
    window.addEventListener("online", flushOutbox);
    flushOutbox();
  } else {
    mode = "local";
    cache = loadLocal();
  }
}

export function getMode() {
  return mode;
}

// ============================================================
// Persistence helpers
// ============================================================
function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.error("TapLog: failed to read saved state, reseeding.", err);
  }
  const seed = buildSeed();
  persistLocal(seed);
  return seed;
}

function persistLocal(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error("TapLog: failed to persist state.", err);
  }
}

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.error("TapLog: failed to read session.", err);
  }
  return { operatorId: null };
}

function persistSession(session) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (err) {
    console.error("TapLog: failed to persist session.", err);
  }
}

// ============================================================
// Commit: replace cache immutably, persist, notify subscribers.
// `ops` is a list of remote operations to send (remote mode only).
// ============================================================
function commit(next, ops = []) {
  cache = next;
  if (mode === "local") persistLocal(cache);
  else persistSession(cache.session); // session always local (per device)
  notify();
  if (mode === "remote" && ops.length) sendOps(ops);
}

function notify() {
  listeners.forEach((fn) => {
    try {
      fn(cache);
    } catch (err) {
      console.error("TapLog: subscriber threw.", err);
    }
  });
}

export function getState() {
  return cache;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ============================================================
// Remote send + offline outbox
// ============================================================
function makeUpsert(collection, row) {
  return { kind: "upsert", collection, row };
}
function makeDelete(collection, id) {
  return { kind: "delete", collection, id };
}

async function runOp(op) {
  if (op.kind === "upsert") return remote.upsert(op.collection, op.row);
  return remote.remove(op.collection, op.id);
}

// All remote ops run through one serialized chain so they persist in
// submission order (e.g. a job row before its event rows — events have a
// foreign key to jobs). Without this, parallel upserts can violate the FK.
let sendChain = Promise.resolve();
function sendOps(ops) {
  sendChain = sendChain.then(() => sendOpsNow(ops));
  return sendChain;
}

async function sendOpsNow(ops) {
  for (const op of ops) {
    if (!navigator.onLine) {
      enqueue(op);
      continue;
    }
    try {
      await runOp(op);
    } catch (err) {
      console.error("TapLog: remote op failed, queued for retry.", err);
      enqueue(op);
    }
  }
}

function loadOutbox() {
  try {
    return JSON.parse(localStorage.getItem(OUTBOX_KEY) || "[]");
  } catch {
    return [];
  }
}
function saveOutbox(ops) {
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(ops));
}
function enqueue(op) {
  const box = loadOutbox();
  box.push(op);
  saveOutbox(box);
}

let flushing = false;
export async function flushOutbox() {
  if (flushing || mode !== "remote" || !navigator.onLine) return;
  flushing = true;
  try {
    let box = loadOutbox();
    const remaining = [];
    for (const op of box) {
      try {
        await runOp(op);
      } catch (err) {
        remaining.push(op);
      }
    }
    saveOutbox(remaining);
  } finally {
    flushing = false;
  }
}

export function pendingCount() {
  return loadOutbox().length;
}

// ============================================================
// Realtime: debounced full reload from server.
// ============================================================
let reloadTimer = null;
function scheduleReload() {
  if (mode !== "remote") return;
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(reloadFromRemote, 250);
}

async function reloadFromRemote() {
  try {
    const data = await remote.loadAll();
    cache = { ...data, session: cache.session };
    notify();
  } catch (err) {
    console.error("TapLog: realtime reload failed.", err);
  }
}

export async function resetAll() {
  if (mode === "remote") {
    await reloadFromRemote(); // never wipe shared data; just refresh
  } else {
    commit(buildSeed());
  }
}

// ============================================================
// Generic immutable collection helpers (build new cache + ops)
// ============================================================
function addTo(key, record) {
  commit({ ...cache, [key]: [...cache[key], record] }, [makeUpsert(key, record)]);
}

function updateIn(key, id, patch) {
  const updated = cache[key].map((r) => (r.id === id ? { ...r, ...patch } : r));
  const row = updated.find((r) => r.id === id);
  commit({ ...cache, [key]: updated }, row ? [makeUpsert(key, row)] : []);
}

function removeFrom(key, id) {
  commit({ ...cache, [key]: cache[key].filter((r) => r.id !== id) }, [makeDelete(key, id)]);
}

// ============================================================
// Masters — Machines
// ============================================================
export const machines = {
  list: () => cache.machines,
  active: () => cache.machines.filter((m) => m.active),
  get: (id) => cache.machines.find((m) => m.id === id) || null,
  add: (data) => {
    const maxOrder = cache.machines.reduce((m, x) => Math.max(m, x.sortOrder || 0), 0);
    addTo("machines", { id: uid("m"), active: true, sortOrder: maxOrder + 1, ...data });
  },
  update: (id, patch) => updateIn("machines", id, patch),
  toggle: (id) => {
    const m = machines.get(id);
    if (m) updateIn("machines", id, { active: !m.active });
  },
  remove: (id) => removeFrom("machines", id),
};

// ============================================================
// Masters — Products (品番)
// ============================================================
export const products = {
  list: () => cache.products,
  active: () => cache.products.filter((p) => p.active),
  get: (id) => cache.products.find((p) => p.id === id) || null,
  add: (data) =>
    addTo("products", { id: uid("p"), active: true, standardSpm: 0, standardSetupMin: 0, ...data }),
  update: (id, patch) => updateIn("products", id, patch),
  toggle: (id) => {
    const p = products.get(id);
    if (p) updateIn("products", id, { active: !p.active });
  },
  remove: (id) => removeFrom("products", id),
};

// ============================================================
// Masters — Users (作業者)
// ============================================================
export const users = {
  list: () => cache.users,
  active: () => cache.users.filter((u) => u.active),
  get: (id) => cache.users.find((u) => u.id === id) || null,
  add: (data) => addTo("users", { id: uid("u"), active: true, role: "worker", ...data }),
  update: (id, patch) => updateIn("users", id, patch),
  toggle: (id) => {
    const u = users.get(id);
    if (u) updateIn("users", id, { active: !u.active });
  },
  remove: (id) => removeFrom("users", id),
  authenticate: (code) => {
    const key = String(code || "").trim();
    if (!key) return null;
    return cache.users.find((u) => u.active && u.employeeNo === key) || null;
  },
};

// ============================================================
// Masters — Defect modes (不良モード)
// ============================================================
export const defectModes = {
  list: () => [...cache.defectModes].sort((a, b) => a.order - b.order),
  active: () => cache.defectModes.filter((d) => d.active).sort((a, b) => a.order - b.order),
  get: (id) => cache.defectModes.find((d) => d.id === id) || null,
  add: (data) => {
    const maxOrder = cache.defectModes.reduce((m, d) => Math.max(m, d.order), 0);
    addTo("defectModes", { id: uid("d"), active: true, order: maxOrder + 1, ...data });
  },
  update: (id, patch) => updateIn("defectModes", id, patch),
  toggle: (id) => {
    const d = defectModes.get(id);
    if (d) updateIn("defectModes", id, { active: !d.active });
  },
  remove: (id) => removeFrom("defectModes", id),
};

// ============================================================
// Session (per-device; never shared)
// ============================================================
export const session = {
  current: () => (cache.session.operatorId ? users.get(cache.session.operatorId) : null),
  login: (userId) => commit({ ...cache, session: { operatorId: userId } }),
  logout: () => commit({ ...cache, session: { operatorId: null } }),
};

// ============================================================
// Jobs (ジョブ＝紙1枚) + events
// ============================================================
export const jobs = {
  list: () => cache.jobs,
  active: () => cache.jobs.filter((j) => j.status === "active"),
  get: (id) => cache.jobs.find((j) => j.id === id) || null,
  forMachine: (machineId) =>
    cache.jobs.find((j) => j.machineId === machineId && j.status === "active") || null,

  start({ machineId, productId, lot, operatorId }) {
    const product = products.get(productId);
    const job = {
      id: uid("job"),
      machineId,
      productId,
      lot: lot || "",
      spm: product ? product.standardSpm : 0,
      status: "active",
      operatorId,
      startedAt: now(),
      endedAt: null,
      events: [],
      result: emptyResult(),
      comment: "",
    };
    addTo("jobs", job);
    return job;
  },

  finish(jobId) {
    updateIn("jobs", jobId, { status: "done", endedAt: now() });
  },

  saveResult(jobId, result) {
    updateIn("jobs", jobId, { result, comment: result.comment || "" });
  },

  // ---- events (stored in cache nested under the job; in DB as rows) ----
  startEvent(jobId, type, operatorId) {
    const job = jobs.get(jobId);
    if (!job) return;
    const ops = [];
    const closed = job.events.map((e) => {
      if (e.endedAt == null) {
        const c = { ...e, endedAt: now() };
        ops.push(makeUpsert("events", c));
        return c;
      }
      return e;
    });
    const event = { id: uid("evt"), jobId, type, operatorId, startedAt: now(), endedAt: null };
    ops.push(makeUpsert("events", event));
    commitJob(jobId, { events: [...closed, event] }, ops);
    return event;
  },

  stopEvent(jobId, eventId) {
    const job = jobs.get(jobId);
    if (!job) return;
    const ops = [];
    const events = job.events.map((e) => {
      if (e.id === eventId && e.endedAt == null) {
        const c = { ...e, endedAt: now() };
        ops.push(makeUpsert("events", c));
        return c;
      }
      return e;
    });
    commitJob(jobId, { events }, ops);
  },

  runningEvent(jobId) {
    const job = jobs.get(jobId);
    if (!job) return null;
    return job.events.find((e) => e.endedAt == null) || null;
  },
};

/** Patch a single job in cache immutably and send the given ops. */
function commitJob(jobId, patch, ops) {
  commit(
    { ...cache, jobs: cache.jobs.map((j) => (j.id === jobId ? { ...j, ...patch } : j)) },
    ops
  );
}
