const test = require("node:test");
const assert = require("node:assert/strict");
const { buildHealthReport } = require("../src/services/System/healthService");

test("health report distinguishes reachable API from missing configuration", () => {
  const keys = [
    "FIREBASE_API_KEY",
    "FIREBASE_AUTH_API_BASE",
    "FIREBASE_SECURETOKEN_API_BASE",
    "LOCKET_API_BASE",
  ];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

  try {
    for (const key of keys) delete process.env[key];
    const degraded = buildHealthReport();
    assert.equal(degraded.status, "degraded");
    assert.equal(degraded.checks.api.healthy, true);
    assert.equal(degraded.checks.auth.configured, false);
    assert.equal(degraded.checks.storage.mode, "client-managed-r2");
    assert.equal(degraded.checks.storage.requiredOnApi, false);

    for (const key of keys) process.env[key] = "configured";
    const healthy = buildHealthReport();
    assert.equal(healthy.status, "ok");
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
