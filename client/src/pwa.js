// src/pwa.js
export async function setupPWA() {
  try {
    const { registerSW } = await import("virtual:pwa-register");
    registerSW({
      immediate: true,
      onNeedRefresh() {
        if (confirm("A new version is available. Update now?")) location.reload();
      },
      onOfflineReady() {
        console.log("[PWA] offline ready");
      },
    });
  } catch (e) {
    console.warn("[PWA] registration skipped:", e);
  }
}
