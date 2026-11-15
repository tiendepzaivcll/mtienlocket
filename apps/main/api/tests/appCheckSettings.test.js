const test = require("node:test");
const assert = require("node:assert/strict");
const { createSettingsStore } = require("../src/services/AppCheck/settingsStore");
const { _private: { validateInput } } = require("../src/controllers/appCheckAdmin.controller");

test("App Check survives restart as encrypted data and never replaces good settings on failed save", async () => {
  let document;
  let fail = false;
  const ref = {
    get: async () => ({ exists: Boolean(document), data: () => document }),
    set: async (value) => { if (fail) throw new Error("offline"); document = value; },
  };
  const options = { getDocument: () => ref, getSecret: () => "test-server-secret" };
  const first = createSettingsStore(options);
  await first.save({ mode: "device-check", deviceCheckToken: "private-token" });
  assert.equal(JSON.stringify(document).includes("private-token"), false);
  const restarted = createSettingsStore(options);
  await restarted.load();
  assert.equal(restarted.peek().deviceCheckToken, "private-token");
  fail = true;
  await assert.rejects(() => restarted.save({ deviceCheckToken: "bad-new-value" }));
  assert.equal(restarted.peek().deviceCheckToken, "private-token");
  const wrongKey = createSettingsStore({ ...options, getSecret: () => "other-key" });
  await wrongKey.load();
  assert.equal(wrongKey.peek(), null);
  assert.equal(wrongKey.loadFailed(), true);
});

test("in-flight settings read cannot overwrite an Admin save", async () => {
  let release;
  const store = createSettingsStore({
    getDocument: () => ({ get: () => new Promise((resolve) => { release = resolve; }), set: async () => {} }),
    getSecret: () => "key",
  });
  const read = store.load();
  await store.save({ mode: "static", appCheckToken: "fresh" });
  release({ exists: false });
  await read;
  assert.equal(store.peek().appCheckToken, "fresh");
});

test("Admin input rejects expired or malformed JWT and normalizes escaped DeviceCheck JSON", () => {
  const jwt = (exp) => `eyJhbGciOiJSUzI1NiJ9.${Buffer.from(JSON.stringify({ exp })).toString("base64url")}.signature`;
  assert.throws(() => validateInput({ mode: "static", token: jwt(1) }), /hết hạn/);
  assert.throws(() => validateInput({ mode: "static", token: "not-a-jwt" }), /JWT/);
  const fresh = jwt(Math.floor(Date.now()/1000) + 3600);
  assert.equal(validateInput({ mode: "static", token: `firebase-appcheck: ${fresh}` }).appCheckToken, fresh);
  const device = "Ag" + "a".repeat(80) + "\\/";
  assert.equal(validateInput({ mode: "device-check", token: JSON.stringify({ device_token: device }) }).deviceCheckToken.deviceToken.endsWith("/"), true);
});
