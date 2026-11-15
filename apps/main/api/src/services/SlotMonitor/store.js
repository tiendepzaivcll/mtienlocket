const crypto = require("crypto");
const { db } = require("../../config/firebase-admin-config");
const { computeTransition, SLOT_STATUS } = require("./core");

const WATCHES = "slotMonitorWatches";
const SESSIONS = "slotMonitorSessions";
const EVENTS = "slotMonitorEvents";
const LEASES = "slotWorkerLeases";
const CLAIMS = "slotRequestClaims";

const now = () => Date.now();
const idFor = (...parts) =>
  crypto.createHash("sha256").update(parts.map(String).join("\0")).digest("base64url");

function assertConfigured() {
  if (db) return;
  const error = new Error("Firestore chưa sẵn sàng cho Slot Monitor.");
  error.code = "SLOT_FIRESTORE_UNAVAILABLE";
  error.status = 503;
  throw error;
}

function isConfigured() {
  return Boolean(db);
}

function watchRef(userUid, celebUid) {
  return db.collection(WATCHES).doc(idFor(userUid, celebUid));
}

async function saveSession(userUid, refreshTokenEncrypted) {
  assertConfigured();
  await db.collection(SESSIONS).doc(String(userUid)).set(
    {
      userUid: String(userUid),
      refreshTokenEncrypted,
      enabled: true,
      lastError: null,
      updatedAt: now(),
    },
    { merge: true },
  );
}

async function getSession(userUid) {
  assertConfigured();
  const snapshot = await db.collection(SESSIONS).doc(String(userUid)).get();
  return snapshot.exists ? snapshot.data() : null;
}

async function markSessionRefreshed(userUid, refreshTokenEncrypted) {
  await db.collection(SESSIONS).doc(String(userUid)).set(
    {
      ...(refreshTokenEncrypted ? { refreshTokenEncrypted } : {}),
      enabled: true,
      lastError: null,
      lastRefreshAt: now(),
      updatedAt: now(),
    },
    { merge: true },
  );
}

async function markSessionError(userUid, message) {
  await db.collection(SESSIONS).doc(String(userUid)).set(
    { lastError: String(message || "Session refresh failed").slice(0, 500), updatedAt: now() },
    { merge: true },
  );
}

async function upsertWatch(userUid, watch) {
  assertConfigured();
  const ref = watchRef(userUid, watch.uid);
  const existing = await ref.get();
  const createdAt = existing.data()?.createdAt || now();
  const lastWasFull =
    watch.maxFriends > 0 && watch.friendCount >= watch.maxFriends;
  await ref.set(
    {
      userUid: String(userUid),
      celebUid: String(watch.uid),
      username: watch.username,
      displayName: watch.displayName,
      avatar: watch.avatar,
      friendCount: watch.friendCount,
      maxFriends: watch.maxFriends,
      availableSlots: Math.max(0, watch.maxFriends - watch.friendCount),
      lastWasFull,
      status: existing.data()?.status || SLOT_STATUS.WATCHING,
      enabled: true,
      autoRequestEnabled: existing.data()?.autoRequestEnabled === true,
      openVersion: Number(existing.data()?.openVersion) || 0,
      nextCheckAt: 0,
      createdAt,
      updatedAt: now(),
    },
    { merge: true },
  );
  return (await ref.get()).data();
}

async function listUserWatches(userUid) {
  assertConfigured();
  const snapshot = await db.collection(WATCHES).where("userUid", "==", String(userUid)).get();
  return snapshot.docs
    .map((doc) => doc.data())
    .sort((left, right) => Number(left.createdAt) - Number(right.createdAt));
}

async function getWatch(userUid, celebUid) {
  assertConfigured();
  const snapshot = await watchRef(userUid, celebUid).get();
  const watch = snapshot.exists ? snapshot.data() : null;
  return watch?.userUid === String(userUid) ? watch : null;
}

async function updateWatch(userUid, celebUid, patch) {
  const ref = watchRef(userUid, celebUid);
  const snapshot = await ref.get();
  if (!snapshot.exists || snapshot.data()?.userUid !== String(userUid)) return null;
  await ref.set({ ...patch, updatedAt: now() }, { merge: true });
  return (await ref.get()).data();
}

async function removeWatch(userUid, celebUid) {
  const watch = await getWatch(userUid, celebUid);
  if (watch) await watchRef(userUid, celebUid).delete();
  return Boolean(watch);
}

async function listDueWatches(at = now(), limit = 100) {
  assertConfigured();
  const snapshot = await db.collection(WATCHES).where("enabled", "==", true).limit(limit).get();
  return snapshot.docs
    .map((doc) => doc.data())
    .filter((watch) => Number(watch.nextCheckAt || 0) <= at);
}

async function resumeLegacyWaitlistWatches(userUid = null) {
  assertConfigured();
  let query = db.collection(WATCHES);
  query = userUid
    ? query.where("userUid", "==", String(userUid))
    : query.where("status", "==", SLOT_STATUS.REQUESTED);
  const snapshot = await query.get();
  const legacyWatches = snapshot.docs.filter((document) => {
    const watch = document.data();
    return (
      watch.status === SLOT_STATUS.REQUESTED &&
      watch.enabled === false &&
      watch.relationship === "follower-waitlist" &&
      watch.lastAutoRequestStatus !== "SENT"
    );
  });
  if (!legacyWatches.length) return 0;

  const batch = db.batch();
  const updatedAt = now();
  legacyWatches.forEach((document) => {
    batch.set(
      document.ref,
      {
        enabled: true,
        status: SLOT_STATUS.WATCHING,
        nextCheckAt: 0,
        updatedAt,
      },
      { merge: true },
    );
  });
  await batch.commit();
  return legacyWatches.length;
}

async function applySnapshot(userUid, celebUid, snapshot, pollIntervalMs) {
  assertConfigured();
  const ref = watchRef(userUid, celebUid);
  return db.runTransaction(async (transaction) => {
    const document = await transaction.get(ref);
    if (!document.exists) return null;
    const previous = document.data();
    const transition = computeTransition(previous, snapshot);
    const openVersion =
      (Number(previous.openVersion) || 0) + (transition.opened ? 1 : 0);
    const checkedAt = now();
    const enabled = transition.completed ? false : previous.enabled !== false;
    const next = {
      ...transition,
      openVersion,
      enabled,
      autoRequestEnabled: transition.completed
        ? false
        : previous.autoRequestEnabled === true,
      lastCheckedAt: checkedAt,
      nextCheckAt: checkedAt + Number(pollIntervalMs),
      lastError: null,
      updatedAt: checkedAt,
    };
    transaction.set(ref, next, { merge: true });

    if (transition.opened || transition.completed) {
      const eventRef = db.collection(EVENTS).doc();
      transaction.set(eventRef, {
        userUid: String(userUid),
        celebUid: String(celebUid),
        username: previous.username,
        type: transition.completed ? transition.status : "SLOT_OPEN",
        availableSlots: transition.availableSlots,
        friendCount: transition.friendCount,
        maxFriends: transition.maxFriends,
        createdAt: checkedAt,
      });
    }
    return { ...previous, ...next };
  });
}

async function markWatchError(userUid, celebUid, error, pollIntervalMs) {
  return updateWatch(userUid, celebUid, {
    status: SLOT_STATUS.ERROR,
    lastError: String(error?.message || error || "Unknown error").slice(0, 500),
    lastCheckedAt: now(),
    nextCheckAt: now() + Number(pollIntervalMs),
  });
}

async function claimAutoRequest(watch) {
  assertConfigured();
  const claimId = idFor(watch.userUid, watch.celebUid, Number(watch.openVersion) || 0);
  const ref = db.collection(CLAIMS).doc(claimId);
  return db.runTransaction(async (transaction) => {
    const existing = await transaction.get(ref);
    if (existing.exists) return false;
    transaction.create(ref, {
      userUid: watch.userUid,
      celebUid: watch.celebUid,
      openVersion: Number(watch.openVersion) || 0,
      state: "CLAIMED",
      createdAt: now(),
    });
    return true;
  });
}

async function markAutoRequestResult(userUid, celebUid, success, error = null) {
  const patch = {
    status: success ? SLOT_STATUS.REQUESTED : SLOT_STATUS.ERROR,
    lastAutoRequestAt: now(),
    lastAutoRequestStatus: success ? "SENT" : "FAILED",
    lastAutoRequestError: error ? String(error.message || error).slice(0, 500) : null,
  };
  if (success) {
    patch.autoRequestEnabled = false;
    patch.enabled = false;
  }
  return updateWatch(userUid, celebUid, patch);
}

async function acquireLease(ownerId, ttlMs) {
  assertConfigured();
  const ref = db.collection(LEASES).doc("main");
  return db.runTransaction(async (transaction) => {
    const document = await transaction.get(ref);
    const lease = document.data() || {};
    const currentTime = now();
    if (
      document.exists &&
      lease.ownerId !== ownerId &&
      Number(lease.expiresAt) > currentTime
    ) return false;
    transaction.set(ref, {
      ownerId,
      acquiredAt: currentTime,
      expiresAt: currentTime + ttlMs,
    });
    return true;
  });
}

module.exports = {
  acquireLease,
  applySnapshot,
  claimAutoRequest,
  getSession,
  getWatch,
  isConfigured,
  listDueWatches,
  listUserWatches,
  markAutoRequestResult,
  markSessionError,
  markSessionRefreshed,
  markWatchError,
  removeWatch,
  resumeLegacyWaitlistWatches,
  saveSession,
  updateWatch,
  upsertWatch,
};
