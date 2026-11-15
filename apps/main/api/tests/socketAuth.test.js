const test = require("node:test");
const assert = require("node:assert/strict");
const {
  authenticateSocketToken,
  normalizeSocketLimit,
  socketErrorPayload,
} = require("../src/services/System/socketAuth");

function tokenWith(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "none" })).toString(
    "base64url",
  );
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${encoded}.signature`;
}

test("socket auth rejects expired tokens during handshake", async () => {
  await assert.rejects(
    authenticateSocketToken(
      tokenWith({ user_id: "u", exp: Math.floor(Date.now() / 1000) - 1 }),
      { verifyToken: async () => ({ user_id: "u" }) },
    ),
    (error) => error.data.code === "SOCKET_AUTH_EXPIRED",
  );
});

test("socket request page sizes are bounded", () => {
  assert.equal(normalizeSocketLimit(10), 10);
  assert.equal(normalizeSocketLimit(1000), 100);
  assert.equal(normalizeSocketLimit(-5), 1);
  assert.equal(normalizeSocketLimit(undefined), 50);
});

test("socket auth accepts a current Firebase session", async () => {
  const session = await authenticateSocketToken(
    tokenWith({ user_id: "u", exp: Math.floor(Date.now() / 1000) + 3600 }),
    { verifyToken: async () => ({ user_id: "u" }) },
  );
  assert.equal(session.localId, "u");
});

test("socket request errors have stable client-safe fields", () => {
  assert.deepEqual(
    socketErrorPayload(
      Object.assign(new Error("expired"), {
        data: { code: "SOCKET_AUTH_EXPIRED" },
      }),
      "request-1",
    ),
    {
      ok: false,
      requestId: "request-1",
      code: "SOCKET_AUTH_EXPIRED",
      message: "expired",
    },
  );
});
