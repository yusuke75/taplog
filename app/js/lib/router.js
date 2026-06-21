// ============================================================
// Minimal hash router. Routes look like:
//   #/worker            #/worker/job/:id          #/admin/masters/products
// Params are captured from :segments.
// ============================================================

export class Router {
  constructor() {
    this.routes = [];
    this.notFound = null;
    window.addEventListener("hashchange", () => this.resolve());
  }

  on(pattern, handler) {
    this.routes.push({ parts: pattern.split("/").filter(Boolean), handler });
    return this;
  }

  fallback(handler) {
    this.notFound = handler;
    return this;
  }

  start() {
    if (!location.hash) location.hash = "#/";
    this.resolve();
  }

  static go(path) {
    location.hash = path.startsWith("#") ? path : `#${path}`;
  }

  current() {
    return location.hash.replace(/^#/, "") || "/";
  }

  resolve() {
    const raw = this.current();
    const [path, queryStr = ""] = raw.split("?");
    const segs = path.split("/").filter(Boolean);
    const query = Object.fromEntries(new URLSearchParams(queryStr));
    for (const route of this.routes) {
      const params = match(route.parts, segs);
      if (params) {
        route.handler({ ...query, ...params });
        return;
      }
    }
    if (this.notFound) this.notFound(path);
  }
}

function match(parts, segs) {
  if (parts.length !== segs.length) return null;
  const params = {};
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].startsWith(":")) params[parts[i].slice(1)] = decodeURIComponent(segs[i]);
    else if (parts[i] !== segs[i]) return null;
  }
  return params;
}
