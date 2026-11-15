const { instanceAppcheck } = require("../../libs/instanceAppcheck");
const { settingsStore } = require("./settingsStore");

const DEFAULT_LOCKET_IOS_APP_ID =
  "1:641029076083:ios:cc8eb46290d69b234fa606";
const DEFAULT_TOKEN_TTL_SECONDS = 55 * 60;

let generatedTokenCache = null;
let generationPromise = null;
let settingsRevision = -1;

function decodeJwtExpiry(token) {
  try {
    const payload = JSON.parse(
      Buffer.from(String(token).split(".")[1], "base64url").toString("utf8"),
    );
    return Number(payload?.exp || 0) || null;
  } catch {
    return null;
  }
}

function tokenIsUsable(token, expiresAtMs) {
  if (!token) return false;
  const jwtExpiry = decodeJwtExpiry(token);
  const resolvedExpiry = expiresAtMs || (jwtExpiry ? jwtExpiry * 1000 : null);
  return !resolvedExpiry || resolvedExpiry > Date.now() + 60_000;
}

function normalizeDeviceCheckToken(value) {
  if (!value) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        return normalizeDeviceCheckToken(JSON.parse(trimmed));
      } catch {
        return null;
      }
    }
    return { deviceToken: trimmed.replace(/\\+\//g, "/").replace(/\s/g, ""), limitedUse: false };
  }
  if (typeof value === "object") {
    const deviceToken = String(
      value.deviceToken || value.device_token || value.token || "",
    ).trim();
    if (!deviceToken) return null;
    return {
      deviceToken: deviceToken.replace(/\\+\//g, "/").replace(/\s/g, ""),
      limitedUse: Boolean(value.limitedUse ?? value.limited_use ?? false),
    };
  }
  return null;
}

function parseTtlSeconds(ttl) {
  const parsed =
    typeof ttl === "string"
      ? Number.parseFloat(ttl.replace(/s$/i, ""))
      : Number(ttl);
  if (!Number.isFinite(parsed) || parsed <= 60) return DEFAULT_TOKEN_TTL_SECONDS;
  return Math.max(60, Math.min(DEFAULT_TOKEN_TTL_SECONDS, Math.floor(parsed - 60)));
}

function getConfiguredAppCheckToken() {
  const saved = settingsStore.peek();
  const token = String(
    saved ? saved.appCheckToken || "" : process.env.LOCKET_APP_CHECK_TOKEN ||
      process.env.FIREBASE_APPCHECK_TOKEN ||
      "",
  ).trim();
  return tokenIsUsable(token) ? token : null;
}

function getConfiguredDeviceCheckToken() {
  const saved = settingsStore.peek();
  return normalizeDeviceCheckToken(
    saved ? saved.deviceCheckToken : process.env.LOCKET_APP_CHECK_DEVICE_TOKEN ||
      process.env.FIREBASE_DEVICE_CHECK_TOKEN,
  );
}

async function generateAppCheckToken(deviceToken) {
  const revision = settingsStore.revision();
  const normalized = normalizeDeviceCheckToken(deviceToken);
  if (!normalized) {
    const error = new Error("DeviceCheck token unavailable");
    error.code = "DEVICE_CHECK_TOKEN_UNAVAILABLE";
    throw error;
  }

  const appId =
    process.env.LOCKET_APP_CHECK_DEVICE_ID ||
    process.env.APPCHECK_DEVICE_ID ||
    DEFAULT_LOCKET_IOS_APP_ID;
  const response = await instanceAppcheck.post(
    `v1/projects/locket-4252a/apps/${appId}:exchangeDeviceCheckToken`,
    {
      // Firebase App Check exchange uses the REST wire names from the iOS HAR.
      device_token: normalized.deviceToken,
      limited_use: normalized.limitedUse,
    },
  );
  const token = response?.data?.token;
  if (!token) {
    const error = new Error("Firebase App Check returned no token");
    error.code = "APPCHECK_EMPTY_RESPONSE";
    throw error;
  }

  const ttlSeconds = parseTtlSeconds(response.data?.ttl);
  if (revision === settingsStore.revision()) generatedTokenCache = {
    token,
    expiresAt: Date.now() + ttlSeconds * 1000,
  };
  return token;
}

function invalidateGeneratedAppCheckToken() {
  generatedTokenCache = null;
}

async function getOrCreateAppCheckToken({ forceRefresh = false } = {}) {
  await settingsStore.load();
  if (settingsRevision !== settingsStore.revision()) {
    generatedTokenCache = null;
    generationPromise = null;
    settingsRevision = settingsStore.revision();
  }
  // A configured token may still be rejected before its JWT expiry. A forced
  // refresh must bypass it and exchange the DeviceCheck source again.
  if (!forceRefresh) {
    const configuredToken = getConfiguredAppCheckToken();
    if (configuredToken) return configuredToken;
  }

  if (forceRefresh) invalidateGeneratedAppCheckToken();
  if (
    generatedTokenCache &&
    tokenIsUsable(generatedTokenCache.token, generatedTokenCache.expiresAt)
  ) {
    return generatedTokenCache.token;
  }

  const deviceToken = getConfiguredDeviceCheckToken();
  if (!deviceToken) {
    return forceRefresh ? null : getConfiguredAppCheckToken();
  }

  if (!generationPromise) {
    const task = generateAppCheckToken(deviceToken).finally(() => {
      if (generationPromise === task) generationPromise = null;
    });
    generationPromise = task;
  }
  const revision = settingsStore.revision();
  const token = await generationPromise;
  return revision === settingsStore.revision() ? token : getOrCreateAppCheckToken();
}

module.exports = {
  getOrCreateAppCheckToken,
  invalidateGeneratedAppCheckToken,
  normalizeDeviceCheckToken,
  _private: {
    decodeJwtExpiry,
    getConfiguredAppCheckToken,
    getConfiguredDeviceCheckToken,
    parseTtlSeconds,
    tokenIsUsable,
    reset: () => {
      generatedTokenCache = null;
      generationPromise = null;
    },
  },
};
