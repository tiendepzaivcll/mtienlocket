import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { registerSW } from "virtual:pwa-register";
import ErrorBoundary from "./components/pages/ErrorBoundary";
import { installChunkRecovery } from "./utils/pwaUtils/safeUpdate";
import { syncPWAClass } from "./utils/logic/checkIfRunningAsPWA";

// Đồng bộ class .is-pwa trên body ngay khi app khởi động
syncPWAClass();

// Draft support was retired. Remove any media blobs left by the previous local
// build so they do not continue consuming browser storage.
if (typeof indexedDB !== "undefined") {
  indexedDB.deleteDatabase("MomentDraftsDB");
}

if (import.meta.env.PROD) {
  // Service Worker background registration:
  // Cập nhật ngầm trong nền, TUYỆT ĐỐI KHÔNG tự động ép reload khi người dùng đang thao tác
  let updateSW = () => Promise.resolve(false);

  updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      registration?.update().catch(() => {});
    },
    onNeedRefresh() {
      console.log("Service worker mới sẵn sàng trong nền.");
    },
    onOfflineReady() {
      console.log("Đã sẵn sàng để dùng offline!");
    },
  });

  installChunkRecovery();
} else {
  const clearLocalPwaState = async () => {
    const hadController = Boolean(navigator.serviceWorker?.controller);

    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }

    if ("caches" in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    }

    const resetKey = "t97-local-pwa-reset";
    if (hadController && sessionStorage.getItem(resetKey) !== "done") {
      sessionStorage.setItem(resetKey, "done");
      window.location.reload();
      return;
    }

    if (!hadController) sessionStorage.removeItem(resetKey);
  };

  clearLocalPwaState().catch((error) => {
    console.warn("Không thể dọn cache local:", error);
  });
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
