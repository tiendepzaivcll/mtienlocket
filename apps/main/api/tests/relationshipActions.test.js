const test = require("node:test");
const assert = require("node:assert/strict");
const { createRelationshipActions } = require("../src/services/LocketFriend/relationshipActions");

for (const [action, endpoint] of [["remove", "removeFriend"], ["block", "blockUser"]]) {
  test(`${action} targets the peer with current session, only once`, async () => {
    const calls = [];
    const perform = createRelationshipActions({ post: async (...args) => {
      calls.push(args);
      return { data: { result: { status: 200, data: { user_uid: "peer" } } } };
    } });
    assert.deepEqual(await perform({ action, userUid: "me", targetUid: "peer", idToken: "test-session" }),
      { uid: "peer", action, confirmed: true });
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], endpoint);
    assert.deepEqual(calls[0][1], { data: { user_uid: "peer" } });
    assert.equal(calls[0][2].meta.idToken, "test-session");
  });
}

test("invalid/self targets and unknown actions never issue mutations", async () => {
  const perform = createRelationshipActions({ post: () => assert.fail("unexpected call") });
  for (const targetUid of [null, "", "me", "users/peer", "a b"]) {
    await assert.rejects(perform({ action: "block", userUid: "me", targetUid }), { status: 400 });
  }
  await assert.rejects(perform({ action: "deleteAll", userUid: "me", targetUid: "peer" }), { status: 400 });
});

test("HTTP 200 is not enough: reject empty, rejected, or wrong-target acknowledgements", async () => {
  for (const body of [{}, { result: { status: 403 } },
    { result: { status: 200, success: false } },
    { result: { status: 200, errors: ["denied"] } },
    { result: { status: 200, data: { user_uid: "other" } } }]) {
    const perform = createRelationshipActions({ post: async () => ({ data: body }) });
    await assert.rejects(perform({ action: "block", userUid: "me", targetUid: "peer" }),
      { code: "FRIEND_ACTION_UNCONFIRMED" });
  }
});

test("missing block endpoints follow the sample compatibility names with a finite limit", async () => {
  const endpoints = [];
  const perform = createRelationshipActions({ post: async (endpoint) => {
    endpoints.push(endpoint);
    if (endpoint !== "blockFriend") throw Object.assign(new Error("missing"), { response: { status: 404 } });
    return { data: { result: { status: 200, data: { user_uid: "peer" } } } };
  } });
  await perform({ action: "block", userUid: "me", targetUid: "peer" });
  assert.deepEqual(endpoints, ["blockUser", "blockFriend"]);
});

test("auth, permission, throttling and ambiguous failures never try another mutation endpoint", async () => {
  for (const status of [401, 403, 429, 500, undefined]) {
  let count = 0;
  const perform = createRelationshipActions({ post: async () => {
    count++;
    throw Object.assign(new Error("unavailable"), { response: { status } });
  } });
  await assert.rejects(perform({ action: "block", userUid: "me", targetUid: "peer" }));
  assert.equal(count, 1);
  }
});
