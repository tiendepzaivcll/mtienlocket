const test = require("node:test");
const assert = require("node:assert/strict");
const { createRequestReader, normalizeRequest } = require("../src/services/LocketFriend/requestReader");
const document = (from, to) => ({ name: "users/me/incoming_friend_requests/request-not-user-id",
  fields: { requesting_user: { stringValue: from }, requested_user: { stringValue: to },
    created_at: { timestampValue: "2026-09-12T00:00:00Z" } } });

test("requests select sender for incoming and receiver for outgoing, never document ID", () => {
  assert.equal(normalizeRequest(document("sender", "me"), "incoming").uid, "sender");
  assert.equal(normalizeRequest(document("me", "receiver"), "outgoing").uid, "receiver");
  assert.equal(normalizeRequest({ name: "request-id" }, "incoming"), null);
});
for (const direction of ["incoming", "outgoing"]) {
  test(`${direction} reads the correct collection and every page using the user's token`, async () => {
    let calls = 0;
    const read = createRequestReader({ get: async (path, config) => {
      calls++;
      assert.equal(path, `(default)/documents/users/me/${direction}_friend_requests`);
      assert.equal(config.meta.idToken, "test-session");
      assert.equal(config.params.pageToken, calls === 1 ? undefined : "next");
      return { data: { documents: [direction === "incoming" ? document("peer", "me") : document("me", "peer")],
        ...(calls === 1 ? { nextPageToken: "next" } : {}) } };
    } });
    const result = await read("test-session", "me", direction);
    assert.equal(calls, 2);
    assert.equal(result.length, 1);
    assert.equal(result[0].uid, "peer");
  });
}
test("upstream failure is not disguised as an empty request list", async () => {
  const read = createRequestReader({ get: async () => { throw { response: { status: 403 } }; } });
  await assert.rejects(read("token", "me", "incoming"), { code: "FRIEND_REQUESTS_UNAVAILABLE", status: 502 });
});
test("empty successful collections work; malformed responses fail", async () => {
  assert.deepEqual(await createRequestReader({ get: async () => ({ data: {} }) })("t", "me", "incoming"), []);
  await assert.rejects(createRequestReader({ get: async () => ({ data: "<html>" }) })("t", "me", "incoming"));
});
