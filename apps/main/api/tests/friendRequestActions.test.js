const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createFriendRequestActions,
  normalizeRequestUids,
} = require("../src/services/LocketFriend/friendRequestActions");

test("request cleanup validates, deduplicates and never targets the current user", () => {
  assert.deepEqual(normalizeRequestUids(["peer", "peer", "other"], "me"), [
    "peer",
    "other",
  ]);
  for (const uids of [[], ["me"], ["users/peer"], ["a b"]]) {
    assert.throws(() => normalizeRequestUids(uids, "me"), { status: 400 });
  }
});

test("request cleanup uses the server session and reports only confirmed targets", async () => {
  const calls = [];
  const cleanup = createFriendRequestActions({
    post: async (endpoint, body, config) => {
      calls.push({ endpoint, body, config });
      if (body.data.user_uid === "failed") {
        return { data: { result: { status: 403 } } };
      }
      return {
        data: {
          result: {
            status: 200,
            data: { user_uid: body.data.user_uid },
          },
        },
      };
    },
  });

  const result = await cleanup({
    idToken: "session-token",
    userUid: "me",
    uids: ["first", "failed", "second"],
    direction: "incoming",
  });

  assert.equal(result.total, 3);
  assert.equal(result.successCount, 2);
  assert.deepEqual(new Set(result.successUidList), new Set(["first", "second"]));
  assert.deepEqual(result.failures.map((failure) => failure.uid), ["failed"]);
  assert.equal(calls.every((call) => call.endpoint === "deleteFriendRequest"), true);
  assert.equal(calls.every((call) => call.config.meta.idToken === "session-token"), true);
  assert.equal(calls.every((call) => call.body.data.direction === "incoming"), true);
});

test("request cleanup rejects an invalid direction before issuing mutations", async () => {
  const cleanup = createFriendRequestActions({
    post: () => assert.fail("unexpected mutation"),
  });
  await assert.rejects(
    cleanup({ idToken: "token", userUid: "me", uids: ["peer"], direction: "all" }),
    { status: 400 },
  );
});
