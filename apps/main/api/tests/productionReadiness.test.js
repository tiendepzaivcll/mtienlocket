const test = require("node:test");
const assert = require("node:assert/strict");
const {
  assertProductionReadiness,
  getProductionReadiness,
} = require("../src/services/System/productionReadiness");

test("production readiness reports missing keys without exposing values", () => {
  const result = getProductionReadiness({ FIREBASE_API_KEY: "secret" });
  assert.equal(result.ready, false);
  assert.equal(result.missingKeys.includes("LOCKET_API_BASE"), true);
  assert.equal(JSON.stringify(result).includes("secret"), false);
});

test("production startup fails fast with key names only", () => {
  assert.throws(
    () => assertProductionReadiness({ FIREBASE_API_KEY: "secret" }),
    (error) =>
      error.code === "PRODUCTION_ENV_INCOMPLETE" &&
      !error.message.includes("secret") &&
      error.missingKeys.includes("LOCKET_API_BASE"),
  );
});

test("production readiness accepts either static or DeviceCheck App Check source", () => {
  const base = {
    FIREBASE_API_KEY: "x",
    FIREBASE_AUTH_API_BASE: "x",
    FIREBASE_SECURETOKEN_API_BASE: "x",
    LOCKET_API_BASE: "x",
  };
  assert.equal(
    getProductionReadiness({ ...base, LOCKET_APP_CHECK_DEVICE_TOKEN: "x" }).ready,
    true,
  );
  assert.equal(
    getProductionReadiness({ ...base, LOCKET_APP_CHECK_TOKEN: "x" }).ready,
    true,
  );
});
