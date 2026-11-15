const crypto = require("crypto");
const authServices = require("../LocketAuth/AuthService");
const friendServices = require("../LocketFriend");
const store = require("./store");
const { decryptSecret, encryptSecret, getEncryptionKey } = require("./crypto");
const { decodeFirebaseUid, extractCelebritySnapshot } = require("./core");

const POLL_INTERVAL_MS = Math.min(
  3 * 60 * 1000,
  Math.max(10_000, Number(process.env.SLOT_POLL_INTERVAL_MS) || 30_000),
);
const WORKER_TICK_MS = Math.min(15_000, Math.max(5_000, POLL_INTERVAL_MS / 2));
const LEASE_TTL_MS = Math.max(30_000, WORKER_TICK_MS * 3);
const ID_TOKEN_CACHE_MS = 45 * 60 * 1000;
const tokenCache = new Map();
const workerOwnerId = `${process.pid}-${crypto.randomUUID()}`;
let workerTimer = null;
let workerBusy = false;

function envEnabled(value) {
  return ["1", "true", "yes", "on", "enabled"].includes(
    String(value || "").trim().toLowerCase(),
  );
}

function isWorkerEnabled() {
  return envEnabled(process.env.SLOT_MONITOR_WORKER_ENABLED);
}

function getPublicConfig() {
  const firestoreConfigured = store.isConfigured();
  const encryptionConfigured = Boolean(getEncryptionKey());
  return {
    enabled: firestoreConfigured && encryptionConfigured,
    firestoreConfigured,
    encryptionConfigured,
    workerEnabled: isWorkerEnabled(),
    pollIntervalMs: POLL_INTERVAL_MS,
    maxWatches: 20,
    storage: "firestore",
  };
}

function rememberIdToken(userUid, idToken) {
  tokenCache.set(String(userUid), {
    idToken,
    expiresAt: Date.now() + ID_TOKEN_CACHE_MS,
  });
}

function cachedIdToken(userUid) {
  const cached = tokenCache.get(String(userUid));
  if (!cached || cached.expiresAt <= Date.now()) {
    tokenCache.delete(String(userUid));
    return null;
  }
  return cached.idToken;
}

async function enableSession(userUid, refreshToken) {
  if (!getPublicConfig().enabled) {
    const error = new Error("Slot Monitor chưa kết nối được Firebase Admin/Firestore.");
    error.code = "SLOT_MONITOR_UNAVAILABLE";
    error.status = 503;
    throw error;
  }
  if (!refreshToken) {
    const error = new Error("Thiếu refresh token để chạy nền 24/7.");
    error.code = "REFRESH_TOKEN_REQUIRED";
    error.status = 400;
    throw error;
  }

  const refreshed = await authServices.refreshIdToken(String(refreshToken));
  const idToken = refreshed?.id_token || refreshed?.access_token;
  const refreshedUid = decodeFirebaseUid(idToken);
  if (!idToken || !refreshedUid || refreshedUid !== String(userUid)) {
    const error = new Error("Phiên nền không khớp tài khoản đang đăng nhập.");
    error.code = "SLOT_SESSION_MISMATCH";
    error.status = 403;
    throw error;
  }

  const rotatedRefreshToken = refreshed?.refresh_token || refreshToken;
  await store.saveSession(userUid, encryptSecret(rotatedRefreshToken));
  rememberIdToken(userUid, idToken);
  return getPublicConfig();
}

async function refreshBackgroundIdToken(userUid) {
  const cached = cachedIdToken(userUid);
  if (cached) return cached;
  const session = await store.getSession(userUid);
  if (!session?.enabled || !session?.refreshTokenEncrypted) {
    const error = new Error("Chưa nạp phiên nền cho Slot Monitor.");
    error.code = "SLOT_SESSION_MISSING";
    error.status = 409;
    throw error;
  }

  try {
    const refreshed = await authServices.refreshIdToken(
      decryptSecret(session.refreshTokenEncrypted),
    );
    const idToken = refreshed?.id_token || refreshed?.access_token;
    if (!idToken || decodeFirebaseUid(idToken) !== String(userUid)) {
      const error = new Error("Phiên nền không còn khớp tài khoản.");
      error.code = "SLOT_SESSION_MISMATCH";
      error.status = 403;
      throw error;
    }
    const rotatedRefreshToken = refreshed?.refresh_token;
    await store.markSessionRefreshed(
      userUid,
      rotatedRefreshToken ? encryptSecret(rotatedRefreshToken) : null,
    );
    rememberIdToken(userUid, idToken);
    return idToken;
  } catch (error) {
    tokenCache.delete(String(userUid));
    await store.markSessionError(userUid, error.message);
    throw error;
  }
}

async function maybeSendAutoRequest(watch, idToken) {
  if (
    !watch?.autoRequestEnabled ||
    Number(watch.availableSlots) <= 0 ||
    watch.relationship !== "none"
  ) return { attempted: false };

  const claimed = await store.claimAutoRequest(watch);
  if (!claimed) return { attempted: false, duplicatePrevented: true };

  try {
    const result = await friendServices.sendFollowRequest(idToken, watch.celebUid);
    await store.markAutoRequestResult(watch.userUid, watch.celebUid, true);
    return { attempted: true, success: true, result };
  } catch (error) {
    await store.markAutoRequestResult(watch.userUid, watch.celebUid, false, error);
    return {
      attempted: true,
      success: false,
      code: error.code || "AUTO_REQUEST_FAILED",
      message: error.message,
    };
  }
}

async function getUsernameSnapshot(watch, idToken) {
  const live = await friendServices.getUserByUsername(
    idToken,
    watch.username,
    { celebrityUid: watch.celebUid },
  );
  return {
    ...extractCelebritySnapshot(live),
    snapshotSource: "username",
  };
}

async function getInviteSnapshot(watch, idToken) {
  const inviteProfile = await friendServices.getUserForInviteProfile(
    idToken,
    watch.username,
  );
  return {
    ...extractCelebritySnapshot(inviteProfile),
    snapshotSource: "invite",
  };
}

function selectSnapshotError(firstError, fallbackError) {
  const firstStatus = Number(
    firstError?.response?.status || firstError?.status || 0,
  );
  const fallbackStatus = Number(
    fallbackError?.response?.status || fallbackError?.status || 0,
  );
  if ([401, 403].includes(fallbackStatus)) return fallbackError;
  if ([401, 403].includes(firstStatus)) return firstError;
  if (fallbackError?.code === "CELEBRITY_SNAPSHOT_UNAVAILABLE") {
    return fallbackError;
  }
  return firstError || fallbackError;
}

async function resolveCelebritySnapshot(watch, idToken) {
  const preferInvite = watch?.snapshotSource === "invite";
  const firstLoader = preferInvite ? getInviteSnapshot : getUsernameSnapshot;
  const fallbackLoader = preferInvite ? getUsernameSnapshot : getInviteSnapshot;
  const firstSource = preferInvite ? "invite" : "username";
  const fallbackSource = preferInvite ? "username" : "invite";

  let firstError;
  try {
    return await firstLoader(watch, idToken);
  } catch (error) {
    firstError = error;
    console.warn(`[slot-monitor] ${firstSource} snapshot unavailable; trying ${fallbackSource}`, {
      celebUid: String(watch.celebUid || "").slice(-6),
      status: error?.response?.status || error?.status || null,
      code: error?.code || null,
    });
  }

  try {
    const snapshot = await fallbackLoader(watch, idToken);
    console.log(`[slot-monitor] snapshot recovered via ${fallbackSource}`, {
      celebUid: String(watch.celebUid || "").slice(-6),
    });
    return snapshot;
  } catch (fallbackError) {
    throw selectSnapshotError(firstError, fallbackError);
  }
}

async function checkWatch(watch, providedIdToken = null) {
  const idToken = providedIdToken || (await refreshBackgroundIdToken(watch.userUid));
  try {
    const snapshot = await resolveCelebritySnapshot(watch, idToken);
    const updated = await store.applySnapshot(
      watch.userUid,
      watch.celebUid,
      snapshot,
      POLL_INTERVAL_MS,
    );
    const autoRequest = await maybeSendAutoRequest(updated, idToken);
    return { watch: updated, autoRequest };
  } catch (error) {
    await store.markWatchError(
      watch.userUid,
      watch.celebUid,
      error,
      error?.response?.status === 429 ? POLL_INTERVAL_MS * 4 : POLL_INTERVAL_MS,
    );
    throw error;
  }
}

async function checkNowForUser(userUid, celebUid, idToken) {
  const watch = await store.getWatch(userUid, celebUid);
  if (!watch) {
    const error = new Error("Không tìm thấy Celebrity đang canh.");
    error.code = "SLOT_WATCH_NOT_FOUND";
    error.status = 404;
    throw error;
  }
  return checkWatch(watch, idToken);
}

async function workerTick() {
  if (workerBusy || !isWorkerEnabled() || !getPublicConfig().enabled) return;
  workerBusy = true;
  try {
    const hasLease = await store.acquireLease(workerOwnerId, LEASE_TTL_MS);
    if (!hasLease) return;
    const watches = await store.listDueWatches(Date.now(), 100);
    for (let index = 0; index < watches.length; index += 4) {
      await Promise.allSettled(
        watches.slice(index, index + 4).map((watch) => checkWatch(watch)),
      );
    }
  } catch (error) {
    console.warn("[slot-monitor] worker tick failed:", error.message);
  } finally {
    workerBusy = false;
  }
}

function startWorker() {
  if (!isWorkerEnabled()) {
    console.log("[slot-monitor] worker disabled; set SLOT_MONITOR_WORKER_ENABLED=true to run");
    return false;
  }
  if (!getPublicConfig().enabled) {
    console.warn("[slot-monitor] Firestore or encryption key is not configured");
    return false;
  }
  if (workerTimer) return true;
  void store
    .resumeLegacyWaitlistWatches()
    .then((count) => {
      if (count) console.log(`[slot-monitor] resumed ${count} legacy waitlist watch(es)`);
    })
    .catch((error) => {
      console.warn("[slot-monitor] waitlist recovery failed:", error.message);
    })
    .finally(() => void workerTick());
  workerTimer = setInterval(() => void workerTick(), WORKER_TICK_MS);
  workerTimer.unref?.();
  console.log(`[slot-monitor] worker started; poll interval ${POLL_INTERVAL_MS}ms`);
  return true;
}

function stopWorker() {
  if (workerTimer) clearInterval(workerTimer);
  workerTimer = null;
}

module.exports = {
  checkNowForUser,
  enableSession,
  getPublicConfig,
  isWorkerEnabled,
  maybeSendAutoRequest,
  refreshBackgroundIdToken,
  resolveCelebritySnapshot,
  startWorker,
  stopWorker,
  workerTick,
};
