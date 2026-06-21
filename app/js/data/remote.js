// ============================================================
// Supabase adapter — talks to the shared database.
//
// Responsibilities:
//   - create the client
//   - load every table into the in-memory cache shape used by the app
//   - upsert / delete single rows (camelCase cache <-> snake_case DB)
//   - subscribe to realtime changes from other devices
//
// The cache object shape is identical to the local (seed) shape so
// the rest of the app (store + views) is unchanged.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

// collection key -> DB table name
const TABLE = {
  machines: "machines",
  products: "products",
  users: "app_users",
  defectModes: "defect_modes",
  jobs: "jobs",
  events: "events",
};

// ---- row mappers (DB row -> cache object) ----
const FROM_DB = {
  machines: (r) => ({ id: r.id, name: r.name, active: r.active, sortOrder: r.sort_order }),
  products: (r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    standardSpm: r.standard_spm,
    standardSetupMin: r.standard_setup_min,
    active: r.active,
  }),
  users: (r) => ({
    id: r.id,
    employeeNo: r.employee_no,
    name: r.name,
    role: r.role,
    active: r.active,
  }),
  defectModes: (r) => ({ id: r.id, name: r.name, order: r.sort_order, active: r.active }),
  jobs: (r) => ({
    id: r.id,
    machineId: r.machine_id,
    productId: r.product_id,
    lot: r.lot || "",
    spm: r.spm || 0,
    status: r.status,
    operatorId: r.operator_id,
    startedAt: Number(r.started_at),
    endedAt: r.ended_at == null ? null : Number(r.ended_at),
    result: r.result || {},
    comment: r.comment || "",
    events: [],
  }),
  events: (r) => ({
    id: r.id,
    jobId: r.job_id,
    type: r.type,
    operatorId: r.operator_id,
    startedAt: Number(r.started_at),
    endedAt: r.ended_at == null ? null : Number(r.ended_at),
  }),
};

// ---- row mappers (cache object -> DB row) ----
const TO_DB = {
  machines: (m) => ({ id: m.id, name: m.name, active: m.active, sort_order: m.sortOrder ?? 0 }),
  products: (p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    standard_spm: p.standardSpm ?? 0,
    standard_setup_min: p.standardSetupMin ?? 0,
    active: p.active,
  }),
  users: (u) => ({
    id: u.id,
    employee_no: u.employeeNo,
    name: u.name,
    role: u.role,
    active: u.active,
  }),
  defectModes: (d) => ({ id: d.id, name: d.name, sort_order: d.order ?? 0, active: d.active }),
  jobs: (j) => ({
    id: j.id,
    machine_id: j.machineId,
    product_id: j.productId,
    lot: j.lot || "",
    spm: j.spm || 0,
    status: j.status,
    operator_id: j.operatorId,
    started_at: j.startedAt,
    ended_at: j.endedAt,
    result: j.result || {},
    comment: j.comment || "",
  }),
  events: (e) => ({
    id: e.id,
    job_id: e.jobId,
    type: e.type,
    operator_id: e.operatorId,
    started_at: e.startedAt,
    ended_at: e.endedAt,
  }),
};

const ORDER_BY = { machines: "sort_order", defectModes: "sort_order", jobs: "started_at" };

/** Load all tables and assemble the cache shape (jobs carry their events). */
export async function loadAll() {
  const results = await Promise.all(
    Object.keys(TABLE).map(async (key) => {
      let q = supabase.from(TABLE[key]).select("*");
      if (ORDER_BY[key]) q = q.order(ORDER_BY[key]);
      const { data, error } = await q;
      if (error) throw new Error(`${TABLE[key]} の読み込みに失敗: ${error.message}`);
      return [key, data.map(FROM_DB[key])];
    })
  );

  const byKey = Object.fromEntries(results);

  // attach events to their jobs
  const jobsById = new Map(byKey.jobs.map((j) => [j.id, j]));
  for (const ev of byKey.events) {
    const job = jobsById.get(ev.jobId);
    if (job) job.events.push(ev);
  }
  for (const job of byKey.jobs) {
    job.events.sort((a, b) => a.startedAt - b.startedAt);
  }

  return {
    machines: byKey.machines,
    products: byKey.products,
    users: byKey.users,
    defectModes: byKey.defectModes,
    jobs: byKey.jobs,
  };
}

/** Insert or update one row. */
export async function upsert(collection, cacheRow) {
  const row = TO_DB[collection](cacheRow);
  const { error } = await supabase.from(TABLE[collection]).upsert(row);
  if (error) throw new Error(`${TABLE[collection]} の保存に失敗: ${error.message}`);
}

/** Delete one row by id. */
export async function remove(collection, id) {
  const { error } = await supabase.from(TABLE[collection]).delete().eq("id", id);
  if (error) throw new Error(`${TABLE[collection]} の削除に失敗: ${error.message}`);
}

/** Subscribe to all table changes; calls onChange() on any remote mutation. */
export function subscribeRealtime(onChange) {
  const channel = supabase.channel("taplog-realtime");
  for (const table of Object.values(TABLE)) {
    channel.on("postgres_changes", { event: "*", schema: "public", table }, onChange);
  }
  channel.subscribe();
  return channel;
}
