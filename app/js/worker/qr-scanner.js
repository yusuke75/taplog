// ============================================================
// Camera QR scanner (要件 §7). Uses the vendored jsQR (offline-
// capable, loaded as window.jsQR via a <script> tag). Decodes the
// rear-camera video stream and returns the QR text (= 社員ID).
//
// Requires a secure context (HTTPS or localhost) for camera access.
// ============================================================

let stream = null;
let rafId = null;

export function isSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.jsQR);
}

/**
 * Start scanning. Calls onResult(text) once on the first decoded QR,
 * then stops automatically. Throws if the camera cannot be opened.
 */
export async function startScan(video, canvas, onResult) {
  stop();
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error("このブラウザはカメラに対応していません");
  }
  if (!window.jsQR) {
    throw new Error("QR読取ライブラリの読み込みに失敗しました");
  }

  stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment" },
    audio: false,
  });

  video.srcObject = stream;
  video.setAttribute("playsinline", "true"); // iOS: keep inline, no fullscreen
  video.muted = true;
  await video.play();

  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  const tick = () => {
    if (!stream) return;
    if (video.readyState >= video.HAVE_ENOUGH_DATA && video.videoWidth) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = window.jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
      if (code && code.data) {
        const value = code.data.trim();
        stop();
        onResult(value);
        return;
      }
    }
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
}

/** Stop the camera and decode loop (idempotent). */
export function stop() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
}
