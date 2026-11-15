const packageJson = require("../../../package.json");
const {
  getTelemetrySnapshot,
} = require("../../middlewares/request-telemetry.js");
const {
  getProductionReadiness,
} = require("./productionReadiness.js");

function configured(value) {
  return Boolean(String(value || "").trim());
}

function buildHealthReport() {
  const authConfigured =
    configured(process.env.FIREBASE_API_KEY) &&
    configured(process.env.FIREBASE_AUTH_API_BASE) &&
    configured(process.env.FIREBASE_SECURETOKEN_API_BASE);
  const locketConfigured = configured(process.env.LOCKET_API_BASE);
  const savedAppCheck = require("../AppCheck/settingsStore").settingsStore.peek();
  const appCheckMode = configured(
    process.env.LOCKET_APP_CHECK_TOKEN || process.env.FIREBASE_APPCHECK_TOKEN,
  )
    ? "static"
    : configured(
          process.env.LOCKET_APP_CHECK_DEVICE_TOKEN ||
            process.env.FIREBASE_DEVICE_CHECK_TOKEN,
        )
      ? "device-check"
      : "optional-disabled";
  const telemetry = getTelemetrySnapshot();
  const errorRate = telemetry.requests
    ? telemetry.errors5xx / telemetry.requests
    : 0;
  const alerts = [];
  if (telemetry.requests >= 20 && errorRate >= 0.2) {
    alerts.push({
      code: "HIGH_5XX_RATE",
      level: "warning",
      message: "Tỷ lệ lỗi máy chủ đang cao.",
    });
  }

  return {
    status: authConfigured && locketConfigured ? "ok" : "degraded",
    service: "t97-api",
    version: packageJson.version,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    checks: {
      api: { healthy: true },
      auth: { configured: authConfigured },
      locket: { configured: locketConfigured },
      appCheck: { mode: savedAppCheck?.mode || appCheckMode, source: savedAppCheck ? "admin" : "env" },
      storage: {
        mode: "client-managed-r2",
        requiredOnApi: false,
      },
      deployment: getProductionReadiness(),
    },
    telemetry: {
      ...telemetry,
      errorRate: Number(errorRate.toFixed(4)),
    },
    alerts,
  };
}

module.exports = { buildHealthReport };
