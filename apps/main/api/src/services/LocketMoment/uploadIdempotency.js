const crypto = require("crypto");

const RESULT_TTL_MS = 60 * 60 * 1000;
const results = new Map();
const inFlight = new Map();

function safeKeyPart(value, maxLength = 180) {
  const text = String(value || "").trim();
  if (!text || text.length > maxLength) return null;
  return /^[A-Za-z0-9._:-]+$/.test(text) ? text : null;
}

function makeUploadKey(userId, clientUploadId) {
  const safeUserId = safeKeyPart(userId);
  const safeUploadId = safeKeyPart(clientUploadId);
  if (!safeUserId || !safeUploadId) return null;
  return `${safeUserId}:${safeUploadId}`;
}

function readResult(key, now = Date.now()) {
  const entry = results.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    results.delete(key);
    return null;
  }
  return entry.value;
}

function writeResult(key, value) {
  results.set(key, {
    value,
    expiresAt: Date.now() + RESULT_TTL_MS,
  });
}

function pruneExpiredResults(now = Date.now()) {
  for (const [key, entry] of results.entries()) {
    if (entry.expiresAt <= now) results.delete(key);
  }
}

/**
 * Execute the Locket side effect once per authenticated user and client upload.
 * Railway currently runs this API as one process, so an in-memory lock is enough
 * to protect retries without introducing Redis into the current architecture.
 */
async function runIdempotentUpload({ userId, clientUploadId, work }) {
  if (typeof work !== "function") {
    throw new TypeError("work must be a function");
  }

  const key = makeUploadKey(userId, clientUploadId);
  if (!key) {
    return { result: await work(), replayed: false, protected: false };
  }

  pruneExpiredResults();
  const cached = readResult(key);
  if (cached !== null) {
    return { result: cached, replayed: true, protected: true };
  }

  const existing = inFlight.get(key);
  if (existing) {
    return {
      result: await existing,
      replayed: true,
      protected: true,
    };
  }

  const executionId =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : crypto.randomBytes(18).toString("hex");

  const execution = Promise.resolve()
    .then(work)
    .then((value) => {
      writeResult(key, value);
      return value;
    });

  execution.executionId = executionId;
  inFlight.set(key, execution);

  try {
    return {
      result: await execution,
      replayed: false,
      protected: true,
    };
  } finally {
    if (inFlight.get(key) === execution) inFlight.delete(key);
  }
}

module.exports = {
  runIdempotentUpload,
  _private: {
    makeUploadKey,
    readResult,
    writeResult,
    pruneExpiredResults,
    results,
    inFlight,
  },
};
