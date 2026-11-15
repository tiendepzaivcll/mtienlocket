import { useUploadQueueStore } from "@/stores";
import { isChunkLoadError, isUploadBusy } from "./updatePolicy";

const pendingActions = new Map();

export function runWhenUploadsIdle(key, action) {
  if (!isUploadBusy(useUploadQueueStore.getState())) {
    pendingActions.delete(key);
    Promise.resolve(action()).catch((error) => {
      console.warn("Không thể áp dụng bản cập nhật:", error);
    });
    return true;
  }

  if (pendingActions.has(key)) return false;

  const unsubscribe = useUploadQueueStore.subscribe((state) => {
    if (isUploadBusy(state)) return;
    unsubscribe();
    pendingActions.delete(key);
    Promise.resolve(action()).catch((error) => {
      console.warn("Không thể áp dụng bản cập nhật:", error);
    });
  });
  pendingActions.set(key, unsubscribe);
  window.dispatchEvent(new Event("t97:update-deferred-for-upload"));
  return false;
}

export async function clearRuntimeCaches() {
  if (!("caches" in window)) return;
  const names = await caches.keys();
  await Promise.all(
    names
      .filter((name) => name !== "t97-images-v1")
      .map((name) => caches.delete(name)),
  );
}

function notifyWorkerToActivate(worker) {
  if (!worker) return;

  const activate = () => {
    try {
      worker.postMessage({ type: "SKIP_WAITING" });
    } catch {
      // The worker may have become redundant between update checks.
    }
  };
  activate();
  worker.addEventListener?.("statechange", () => {
    if (worker.state === "installed") activate();
  });
}

export async function forceServiceWorkerUpdate({
  activateUpdate,
  timeoutMs = 8_000,
} = {}) {
  if (!("serviceWorker" in navigator)) return false;

  const serviceWorker = navigator.serviceWorker;
  const previousController = serviceWorker.controller;
  let controllerChanged = false;
  let finishControllerWait;
  const controllerWait = new Promise((resolve) => {
    finishControllerWait = resolve;
  });
  const onControllerChange = () => {
    controllerChanged = true;
    finishControllerWait();
  };

  serviceWorker.addEventListener("controllerchange", onControllerChange);

  try {
    const registrations = await serviceWorker.getRegistrations();

    await Promise.all(
      registrations.map(async (registration) => {
        const inspectInstallingWorker = () => {
          notifyWorkerToActivate(registration.installing);
        };

        registration.addEventListener?.("updatefound", inspectInstallingWorker);
        notifyWorkerToActivate(registration.waiting);
        notifyWorkerToActivate(registration.installing);

        try {
          await registration.update();
        } catch (error) {
          console.warn("Không thể kiểm tra Service Worker mới:", error);
        }

        notifyWorkerToActivate(registration.waiting);
        notifyWorkerToActivate(registration.installing);
      }),
    );

    // virtual:pwa-register knows about the worker it registered. Passing false
    // activates it without performing its own reload; controllerchange below is
    // the single source of truth for reloading the app.
    await Promise.resolve(activateUpdate?.(false));

    await Promise.race([
      controllerWait,
      new Promise((resolve) => window.setTimeout(resolve, timeoutMs)),
    ]);

    return Boolean(
      controllerChanged ||
      (previousController && serviceWorker.controller !== previousController)
    );
  } finally {
    serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }
}

export function installChunkRecovery() {
  const recover = (error) => {
    if (!isChunkLoadError(error)) return;

    const guardKey = "t97-chunk-recovery-url";
    const currentUrl = window.location.href;
    if (sessionStorage.getItem(guardKey) === currentUrl) return;

    runWhenUploadsIdle("chunk-recovery", async () => {
      sessionStorage.setItem(guardKey, currentUrl);
      await clearRuntimeCaches();
      window.location.reload();
    });
  };

  window.addEventListener("error", recover);
  window.addEventListener("unhandledrejection", recover);
}
