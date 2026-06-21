// Worker login (要件 §7): camera QR scan (社員証 = 社員番号) OR manual
// employee-number entry. Works offline. Also exposes the 交代
// (handover) flow that switches the logged-in operator.

import { el, icon, mount } from "../lib/dom.js";
import { users, session } from "../data/store.js";
import { openModal, toast, field } from "../lib/ui.js";
import { Router } from "../lib/router.js";
import { startScan, stop as stopScan, isSupported } from "./qr-scanner.js";

const APP_ROOT = () => document.getElementById("app");

export function renderLogin() {
  stopScan(); // ensure any previous camera is released
  const wrap = el("div", { class: "login-wrap" });

  const corner = (pos) => {
    const styleByPos = {
      tl: { top: "12px", left: "12px", borderTop: "3px solid var(--color-text-info)", borderLeft: "3px solid var(--color-text-info)" },
      tr: { top: "12px", right: "12px", borderTop: "3px solid var(--color-text-info)", borderRight: "3px solid var(--color-text-info)" },
      bl: { bottom: "12px", left: "12px", borderBottom: "3px solid var(--color-text-info)", borderLeft: "3px solid var(--color-text-info)" },
      br: { bottom: "12px", right: "12px", borderBottom: "3px solid var(--color-text-info)", borderRight: "3px solid var(--color-text-info)" },
    };
    return el("span", { class: "qr-corner", style: styleByPos[pos] });
  };

  const video = el("video", { class: "qr-video", playsinline: "", muted: "" });
  const canvas = el("canvas", { style: { display: "none" } });
  const placeholder = el("div", { class: "qr-placeholder" }, icon("qr_code_2"));
  const frame = el("div", { class: "qr-frame" }, [
    placeholder,
    video,
    canvas,
    corner("tl"),
    corner("tr"),
    corner("bl"),
    corner("br"),
  ]);

  const scanBtn = el("button", { class: "worker-cta tonal" });
  const hint = el("p", { style: { color: "var(--color-text-secondary)", margin: "0", minHeight: "1.2em" } }, "QRコードを枠内にかざしてください");

  let scanning = false;
  const setScanning = (on) => {
    scanning = on;
    frame.classList.toggle("scanning", on);
    placeholder.style.display = on ? "none" : "";
    video.style.display = on ? "" : "none";
    mount(scanBtn, on ? icon("stop") : icon("qr_code_scanner"), on ? "停止" : "カメラでスキャン");
    hint.textContent = on ? "社員証のQRコードを枠内にかざしてください" : "「カメラでスキャン」で社員証を読み取ります";
  };

  scanBtn.addEventListener("click", async () => {
    if (scanning) {
      stopScan();
      setScanning(false);
      return;
    }
    if (!isSupported()) {
      toast("この端末ではカメラ読み取りを利用できません。手入力をご利用ください。", "danger");
      return;
    }
    try {
      setScanning(true);
      await startScan(video, canvas, (value) => {
        setScanning(false);
        doLogin(value, false);
      });
    } catch (err) {
      setScanning(false);
      toast(cameraErrorMessage(err), "danger");
    }
  });

  setScanning(false);

  // Release the camera if the user navigates away mid-scan.
  window.addEventListener("hashchange", stopScan, { once: true });

  wrap.append(
    el("p", { style: { color: "var(--color-text-secondary)", fontSize: "0.95rem", margin: "0" } }, "TapLog ・ プレス日報"),
    el("h2", { style: { fontSize: "1.4rem", fontWeight: "600", margin: "8px 0 4px" } }, "社員証をスキャン"),
    hint,
    frame,
    scanBtn,
    el("div", { class: "login-divider" }, "または"),
    el("button", { class: "worker-cta tonal", onclick: () => openManualLogin(false) }, [icon("keyboard"), "社員番号を手入力"]),
    el("div", { style: { display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--color-text-secondary)", fontSize: "0.85rem", marginTop: "12px" } }, [
      icon("cloud_off", { style: { fontSize: "18px" } }),
      "オフラインでもログインできます",
    ])
  );

  const root = el("div", { class: "worker" }, [
    el("div", { class: "worker-topbar" }, [el("span", { class: "worker-title" }, [icon("touch_app"), "TapLog"])]),
    wrap,
  ]);
  mount(APP_ROOT(), root);
}

/** User-friendly message for common getUserMedia failures. */
function cameraErrorMessage(err) {
  const name = err && err.name;
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "カメラの使用が許可されませんでした。設定で許可するか、手入力をご利用ください。";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "カメラが見つかりませんでした。手入力をご利用ください。";
  }
  return `カメラを起動できませんでした（${err && err.message ? err.message : "不明なエラー"}）。手入力をご利用ください。`;
}

function openManualLogin(isHandover) {
  const input = el("input", { type: "text", inputmode: "numeric", placeholder: "例: 1001", autocomplete: "off" });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submit();
  });

  const submit = () => {
    if (doLogin(input.value, isHandover)) close();
  };

  const close = openModal({
    title: isHandover ? "交代：社員番号を入力" : "社員番号でログイン",
    body: [field("社員番号 または 社員証コード", input)],
    actions: [
      { label: "キャンセル", kind: "btn-ghost", onClick: (c) => c() },
      { label: "ログイン", kind: "btn-primary", onClick: submit },
    ],
  });
}

/** Returns true on success. */
function doLogin(code, isHandover) {
  const user = users.authenticate(code);
  if (!user) {
    toast("該当する作業者が見つかりません", "danger");
    return false;
  }
  session.login(user.id);
  toast(`${user.name} さんがログインしました`, "success");
  if (!isHandover) Router.go("/worker");
  else window.dispatchEvent(new CustomEvent("taplog:rerender")); // stay on current page
  return true;
}

/** 交代 (handover) — switch operator via scan or manual entry. */
export function openHandover() {
  openModal({
    title: "記録者を交代",
    body: [
      el("p", { style: { margin: 0, color: "var(--color-text-secondary)" } }, "進行中のジョブはそのまま継続し、ログインだけ切り替えます。"),
    ],
    actions: [
      { label: "閉じる", kind: "btn-ghost", onClick: (c) => c() },
      {
        label: "別の社員証をスキャン",
        kind: "btn-tonal",
        onClick: (c) => {
          c();
          handoverScan();
        },
      },
      {
        label: "手入力で交代",
        kind: "btn-primary",
        onClick: (c) => {
          c();
          openManualLogin(true);
        },
      },
    ],
  });
}

function handoverScan() {
  const current = session.current();
  const next = users.active().find((u) => u.role === "worker" && (!current || u.id !== current.id));
  if (!next) {
    toast("交代できる作業者がいません", "danger");
    return;
  }
  session.login(next.id);
  toast(`${next.name} さんに交代しました`, "success");
  window.dispatchEvent(new CustomEvent("taplog:rerender"));
}
