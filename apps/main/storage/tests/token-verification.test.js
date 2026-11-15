const { test } = require("node:test");
const assert = require("node:assert/strict");
const { generateKeyPairSync } = require("node:crypto");
const jwt = require("jsonwebtoken");
const { createVerifyIdToken, createCertificateProvider } = require("../src/middlewares/verifyIdToken");

const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const attacker = generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicKey = keys.publicKey.export({ type: "spki", format: "pem" });
const projectId = "test-token-project";
const now = 1_800_000_000;
const claims = { sub: "verified-user", user_id: "do-not-trust-this-over-sub", iat: now - 5, exp: now + 60,
  aud: projectId, iss: `https://securetoken.google.com/${projectId}` };
const sign = (changes = {}, privateKey = keys.privateKey) => jwt.sign(Object.fromEntries(
  Object.entries({ ...claims, ...changes }).filter(([, value]) => value !== undefined)), privateKey,
  { algorithm: "RS256", keyid: "test-key" });

async function authenticate(token, options = {}) {
  const req = { headers: { authorization: `Bearer ${token}` } };
  const result = {};
  const res = { status(code) { result.status = code; return this; }, json(body) { result.body = body; return this; } };
  const middleware = createVerifyIdToken({ getProjectId: () => projectId, now: () => now * 1000,
    certificates: async () => ({ "test-key": publicKey }), ...options });
  await middleware(req, res, () => { result.next = true; });
  return { ...result, user: req.user };
}

test("verified Firebase token uses signed subject as UID", async () => {
  const result = await authenticate(sign());
  assert.equal(result.next, true);
  assert.equal(result.user.uid, claims.sub);
});

test("forged, expired, wrong-project and unsigned tokens are rejected", async (t) => {
  const cases = {
    forged: sign({}, attacker.privateKey),
    expired: sign({ exp: now - 1 }),
    wrongAudience: sign({ aud: "different-project" }),
    wrongIssuer: sign({ iss: "https://securetoken.google.com/different-project" }),
    missingExpiry: sign({ exp: undefined }),
    futureIssued: sign({ iat: now + 60 }),
    missingSubject: sign({ sub: undefined }),
    unsigned: jwt.sign(claims, null, { algorithm: "none", keyid: "test-key" }),
  };
  for (const [name, token] of Object.entries(cases)) {
    await t.test(name, async () => {
      const result = await authenticate(token);
      assert.equal(result.status, 401);
      assert.equal(result.next, undefined);
    });
  }
});

test("missing issuer configuration and unavailable certificates fail closed", async () => {
  assert.equal((await authenticate(sign(), { getProjectId: () => "" })).status, 503);
  assert.equal((await authenticate(sign(), { certificates: async () => { throw new Error("offline"); } })).status, 503);
  assert.equal((await authenticate(sign(), { certificates: async () => ({}) })).status, 401);
});

test("certificate cache shares concurrent loads and refreshes after expiry", async () => {
  let calls = 0;
  let clock = 1000;
  const provider = createCertificateProvider(async () => {
    calls++;
    return { certificates: { "test-key": publicKey }, maxAge: 60 };
  }, () => clock);
  const [first, second] = await Promise.all([provider("test-key"), provider("test-key")]);
  assert.equal(calls, 1);
  assert.equal(first, second);
  await provider("untrusted-kid");
  assert.equal(calls, 1, "unknown kids do not force an immediate refetch");
  clock += 61_000;
  await provider("test-key");
  assert.equal(calls, 2);
});
