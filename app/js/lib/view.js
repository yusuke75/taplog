// ============================================================
// View lifecycle helper — tracks per-view intervals (live clocks)
// so they can be cleared when navigating to another screen.
//
// Each view calls clearViewTimers() at the start of its render, then
// registers any live-updating interval via viewInterval(). This keeps
// at most the current screen's timers running.
// ============================================================

const timers = new Set();

export function viewInterval(fn, ms) {
  const id = setInterval(fn, ms);
  timers.add(id);
  return id;
}

export function clearViewTimers() {
  timers.forEach((id) => clearInterval(id));
  timers.clear();
}
