const test = require("node:test");
const assert = require("node:assert/strict");
const { instanceLocketV2 } = require("../src/libs");
const { instanceFirestore } = require("../src/libs/instanceFirestore");
const { getFriendProfiles } = require("../src/services/LocketFriend");

test("friend profiles fall back with the user's session and only return public profile fields", async () => {
  const post = instanceLocketV2.post, get = instanceFirestore.get;
  try {
    instanceLocketV2.post = async () => { throw { response: { status: 503 } }; };
    instanceFirestore.get = async (path, config) => {
      assert.equal(config.meta.idToken, "user-session");
      assert.equal(path, "(default)/documents/users/friend-a");
      return { data: { name: "projects/p/documents/users/friend-a", fields: {
        first_name: { stringValue: "Friend" }, phone_number: { stringValue: "private" },
        username: { stringValue: "friend.a" },
      } } };
    };
    const result = await getFriendProfiles("user-session", ["friend-a"]);
    assert.equal(result.users[0].first_name, "Friend");
    assert.equal(result.users[0].phone_number, undefined);
    assert.deepEqual(result.failedUids, []);
  } finally { instanceLocketV2.post = post; instanceFirestore.get = get; }
});

test("failed profile permissions remain failures instead of empty success or fabricated users", async () => {
  const post = instanceLocketV2.post, get = instanceFirestore.get;
  try {
    instanceLocketV2.post = async () => { throw { response: { status: 403 } }; };
    instanceFirestore.get = async () => { throw { response: { status: 403 } }; };
    const result = await getFriendProfiles("user-session", ["blocked-friend"]);
    assert.equal(result.users.length, 0);
    assert.deepEqual(result.failedUids, ["blocked-friend"]);
    assert.equal(result.failures[0].code, "FRIEND_PROFILE_AUTH_FAILED");
  } finally { instanceLocketV2.post = post; instanceFirestore.get = get; }
});
