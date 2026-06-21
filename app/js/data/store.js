// ============================================================
// TapLog store — single source of truth.
//
// Persists to localStorage (offline-first, 要件 §9). All updates
// are immutable: every mutator returns a brand-new state object
// and never edits the previous one in place (coding-style rule).
// A tiny pub/sub notifies views on change.
// ============================================================

import { buildSeed, emptyResult } from "./seed.js";
import { uid, now } from "../lib/id.js";

const STORAGE_KEY = "taplog.state.v1";

let state = load();
const listeners = new Set();

// ---- persistence ----
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.error("TapLog: failed to read saved state, reseeding.", err);
  }
  const seed = buildSeed();
  persist(seed);
  return seed;
}

function persist(next) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    // Never silently swallow — surface to console (coding-style rule).
    console.error("TapLog: failed to persist state.", err);
  }
}

/** Replace state immutably, persist, and notify subscribers. */
function commit(next) {
  state = next;
  persist(state);
  listeners.forEach((fn) => {
    try {
      fn(state);
    } catch (err) {
      console.error("TapLog: subscriber threw.", err);
    }
  });
}

// ---- public read API ----
export function getState() {
  return state;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function resetAll() {
  commit(buildSeed());
}

// ---- generic collection helpers (immutable) ----
function addTo(key, record) {
  commit({ ...state, [key]: [...state[key], record] });
}

function updateIn(key, id, patch) {
  commit({
    ...state,
    [key]: state[key].map((r) => (r.id === id ? { ...r, ...patch } : r)),
  });
}

function removeFrom(key, id) {
  commit({ ...state, [key]: state[key].filter((r) => r.id !== id) });
}

// ============================================================
// Masters — Machines
// ============================================================
export const machines = {
  list: () => state.machines,
  active: () => state.machines.filter((m) => m.active),
  get: (id) => state.machines.find((m) => m.id === id) || null,
  add: (data) => addTo("machines", { id: uid("m"), active: true, ...data }),
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
  list: () => state.products,
  active: () => state.products.filter((p) => p.active),
  get: (id) => state.products.find((p) => p.id === id) || null,
  add: (data) =>
    addTo("products", {
      id: uid("p"),
      active: true,
      standardSpm: 0,
      standardSetupMin: 0,
      ...data,
    }),
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
  list: () => state.users,
  active: () => state.users.filter((u) => u.active),
  get: (id) => state.users.find((u) => u.id === id) || null,
  add: (data) => addTo("users", { id: uid("u"), active: true, role: "worker", ...data }),
  update: (id, patch) => updateIn("users", id, patch),
  toggle: (id) => {
    const u = users.get(id);
    if (u) updateIn("users", id, { active: !u.active });
  },
  remove: (id) => removeFrom("users", id),
  /** Login lookup: by card code OR employee number (要件 §7). */
  authenticate: (code) => {
    const key = String(code || "").trim();
    if (!key) return null;
    return (
      state.users.find(
        (u) => u.active && (u.cardCode === key || u.employeeNo === key)
      ) || null
    );
  },
};

// ============================================================
// Masters — Defect modes (不良モード)
// ============================================================
export const defectModes = {
  list: () => [...state.defectModes].sort((a, b) => a.order - b.order),
  active: () =>
    state.defectModes.filter((d) => d.active).sort((a, b) => a.order - b.order),
  get: (id) => state.defectModes.find((d) => d.id === id) || null,
  add: (data) => {
    const maxOrder = state.defectModes.reduce((m, d) => Math.max(m, d.order), 0);
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
// Session (current logged-in operator on the shared device)
// ============================================================
export const session = {
  current: () => (state.session.operatorId ? users.get(state.session.operatorId) : null),
  login: (userId) => commit({ ...state, session: { operatorId: userId } }),
  logout: () => commit({ ...state, session: { operatorId: null } }),
};

// ============================================================
// Jobs (ジョブ＝紙1枚) + events
// ============================================================
export const jobs = {
  list: () => state.jobs,
  active: () => state.jobs.filter((j) => j.status === "active"),
  get: (id) => state.jobs.find((j) => j.id === id) || null,
  forMachine: (machineId) =>
    state.jobs.find((j) => j.machineId === machineId && j.status === "active") || null,

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

  // ---- events ----
  startEvent(jobId, type, operatorId) {
    const job = jobs.get(jobId);
    if (!job) return;
    // Close any still-running event first (one active event at a time).
    const closed = job.events.map((e) =>
      e.endedAt == null ? { ...e, endedAt: now() } : e
    );
    const event = { id: uid("evt"), type, operatorId, startedAt: now(), endedAt: null };
    updateIn("jobs", jobId, { events: [...closed, event] });
    return event;
  },

  stopEvent(jobId, eventId) {
    const job = jobs.get(jobId);
    if (!job) return;
    updateIn("jobs", jobId, {
      events: job.events.map((e) =>
        e.id === eventId && e.endedAt == null ? { ...e, endedAt: now() } : e
      ),
    });
  },

  runningEvent(jobId) {
    const job = jobs.get(jobId);
    if (!job) return null;
    return job.events.find((e) => e.endedAt == null) || null;
  },
};
