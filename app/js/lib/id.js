// Small id + clock helpers shared across the app.

let counter = 0;

/** Monotonic-ish unique id. Prefixed for readability in storage. */
export function uid(prefix = "id") {
  counter += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${rand}`;
}

/** Current epoch ms — wrapped so it can be stubbed in tests. */
export function now() {
  return Date.now();
}
