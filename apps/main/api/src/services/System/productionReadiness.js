const REQUIRED_ENV_KEYS = [
  "FIREBASE_API_KEY",
  "FIREBASE_AUTH_API_BASE",
  "FIREBASE_SECURETOKEN_API_BASE",
  "LOCKET_API_BASE",
];

function isConfigured(value) {
  return Boolean(String(value || "").trim());
}

function getProductionReadiness(env = process.env) {
  const missingKeys = REQUIRED_ENV_KEYS.filter((key) => !isConfigured(env[key]));
  const saved = env === process.env
    ? require("../AppCheck/settingsStore").settingsStore.peek() : null;
  const hasAppCheckSource = isConfigured(
    saved ? saved.appCheckToken || saved.deviceCheckToken : env.LOCKET_APP_CHECK_TOKEN ||
      env.FIREBASE_APPCHECK_TOKEN ||
      env.LOCKET_APP_CHECK_DEVICE_TOKEN ||
      env.FIREBASE_DEVICE_CHECK_TOKEN,
  );
  if (!hasAppCheckSource) missingKeys.push("LOCKET_APP_CHECK_SOURCE");

  return {
    ready: missingKeys.length === 0,
    missingKeys,
    storageMode: "client-managed-r2",
  };
}

function assertProductionReadiness(env = process.env) {
  const readiness = getProductionReadiness(env);
  // Admin must remain reachable to supply/renew App Check after startup.
  if (readiness.missingKeys.every((key) => key === "LOCKET_APP_CHECK_SOURCE")) return readiness;

  const error = new Error(
    `Missing production environment keys: ${readiness.missingKeys.join(", ")}`,
  );
  error.code = "PRODUCTION_ENV_INCOMPLETE";
  error.missingKeys = readiness.missingKeys;
  throw error;
}

module.exports = {
  assertProductionReadiness,
  getProductionReadiness,
  REQUIRED_ENV_KEYS,
};
