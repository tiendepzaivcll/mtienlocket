import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { registerSW } from "virtual:pwa-register";
import ErrorBoundary from "./components/pages/ErrorBoundary";
import {
  clearRuntimeCaches,
  forceServiceWorkerUpdate,
  installChunkRecovery,
  runWhenUploadsIdle,
} from "./utils/pwaUtils/safeUpdate";
import { shouldReloadForVersion } from "./utils/pwaUtils/updatePolicy";

// Draft support was retired. Remove any media blobs left by the previous local
// build so they do not continue consuming browser storage.
if (typeof indexedDB !== "undefined") {
  indexedDB.deleteDatabase("MomentDraftsDB");
}

if (import.meta.env.PROD) {
  // --- Ép làm mới khi server đã deploy phiên bản khác với bản JS đang chạy ---
  // Chạy độc lập với service worker nên đáng tin cả trên iOS PWA (nơi SW hay
  // không tự cập nhật khi app bị đóng/nền).
  const RUNNING_VERSION =
    import.meta.env.VITE_BUILD_ID || import.meta.env.VITE_BUILD_COMMIT;
  let lastVersionCheck = 0;
  let updateSW = () => Promise.resolve(false);

  const reloadWithVersion = async (version, parameter = "_v") => {
    await clearRuntimeCaches();
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set(parameter, version || Date.now().toString());
    window.location.replace(nextUrl.toString());
  };

  const ensureFreshVersion = async () => {
    try {
      if (!RUNNING_VERSION || RUNNING_VERSION === "local") return;
      lastVersionCheck = Date.now();

      const res = await fetch(`/version.json?_=${Date.now()}`, {
        cache: "no-store",
      });
      if (!res.ok) return;

      const { buildId, commit } = await res.json();
      const serverVersion = buildId || commit;
      const guardKey = "t97-reloaded-to";
      if (
        !shouldReloadForVersion({
          runningCommit: RUNNING_VERSION,
          serverCommit: serverVersion,
          guardCommit: sessionStorage.getItem(guardKey),
        })
      ) {
        return;
      }

      runWhenUploadsIdle(`version-${serverVersion}`, async () => {
        sessionStorage.setItem(guardKey, serverVersion);
        await forceServiceWorkerUpdate({ activateUpdate: updateSW });
        await reloadWithVersion(serverVersion);
      });
    } catch {
      // Mạng lỗi thì bỏ qua, lần mở sau sẽ kiểm tra lại.
    }
  };

  navigator.serviceWorker?.addEventListener("controllerchange", () => {
    const guardKey = "t97-controller-reloaded-from";
    if (sessionStorage.getItem(guardKey) === RUNNING_VERSION) return;

    sessionStorage.setItem(guardKey, RUNNING_VERSION);
    runWhenUploadsIdle("service-worker-controller", () =>
      reloadWithVersion(Date.now().toString(), "_sw"),
    );
  });

  let activeRegistration;
  updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      activeRegistration = registration;
      registration?.update().catch(() => {});
    },
    onNeedRefresh() {
      console.log("Có bản mới, sẽ cập nhật khi hàng đợi upload rảnh...");
      runWhenUploadsIdle("service-worker", () => updateSW(false));
    },
    onOfflineReady() {
      console.log("Đã sẵn sàng để dùng offline!");
    },
  });

  const checkForUpdates = () => {
    activeRegistration?.update().catch(() => {});
    ensureFreshVersion();
  };

  checkForUpdates();
  // iOS thường giữ nguyên PWA khi mở lại từ nền. Kiểm tra cả worker lẫn
  // version.json ở mọi điểm app có thể được đưa trở lại tiền cảnh.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    if (Date.now() - lastVersionCheck < 30_000) return;
    checkForUpdates();
  });
  window.addEventListener("pageshow", checkForUpdates);
  window.addEventListener("online", checkForUpdates);
  window.addEventListener("focus", () => {
    if (Date.now() - lastVersionCheck >= 30_000) checkForUpdates();
  });

  // A PWA can stay in the foreground for hours. Poll both sources so an
  // activated worker never leaves an old JavaScript bundle running.
  window.setInterval(() => {
    if (document.visibilityState !== "visible") return;
    if (Date.now() - lastVersionCheck < 45_000) return;
    checkForUpdates();
  }, 60_000);

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
