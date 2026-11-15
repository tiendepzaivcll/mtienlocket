export function isUploadBusy(queueState = {}) {
  if (queueState.isQueueRunning) return true;
  return Boolean(
    queueState.uploadItems?.some((item) => item.status === "uploading"),
  );
}

export function isChunkLoadError(error) {
  const message = String(error?.message || error?.reason?.message || error || "");
  return /chunkloaderror|loading chunk|failed to fetch dynamically imported module|importing a module script failed/i.test(
    message,
  );
}

export function shouldReloadForVersion({ runningCommit, serverCommit, guardCommit }) {
  return Boolean(
    runningCommit &&
      runningCommit !== "local" &&
      serverCommit &&
      serverCommit !== runningCommit &&
      guardCommit !== serverCommit,
  );
}
