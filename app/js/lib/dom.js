// ============================================================
// Tiny DOM helpers — keep view code declarative without a framework.
// ============================================================

/**
 * Hyperscript-style element factory.
 *   el("div", { class: "card", onclick: fn }, [child, "text"])
 */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "html") node.innerHTML = value;
    else if (key === "dataset") Object.assign(node.dataset, value);
    else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === "style" && typeof value === "object") {
      Object.assign(node.style, value);
    } else node.setAttribute(key, value);
  }
  appendChildren(node, children);
  return node;
}

function appendChildren(node, children) {
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

/** Material Symbols icon span. */
export function icon(name, extra = {}) {
  return el("span", { class: "material-symbols-rounded", ...extra }, name);
}

/** Replace all children of a container with new content. */
export function mount(container, ...nodes) {
  container.replaceChildren(...nodes.filter(Boolean));
}

export function clear(container) {
  container.replaceChildren();
}

/** HTML-escape for the few places we build markup strings. */
export function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}
