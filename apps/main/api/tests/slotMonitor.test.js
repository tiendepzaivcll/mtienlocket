const test = require("node:test");
const assert = require("node:assert/strict");
const {
  SLOT_STATUS,
  computeTransition,
  decodeFirebaseUid,
  extractCelebritySnapshot,
  sanitizeWatchInput,
} = require("../src/services/SlotMonitor/core");
const {
  decryptSecret,
  encryptSecret,
  getEncryptionKey,
} = require("../src/services/SlotMonitor/crypto");

test("slot watch input requires both uid and normalized username", () => {
  assert.equal(sanitizeWatchInput({ username: "t97" }), null);
  assert.deepEqual(
    sanitizeWatchInput({
      uid: "celeb-1",
      username: " @T97 ",
      displayName: "T97",
      friendCount: 9,
      maxFriends: 10,
    }),
    {
      uid: "celeb-1",
      username: "t97",
      displayName: "T97",
      avatar: "",
      friendCount: 9,
      maxFriends: 10,
    },
  );
});

test("slot snapshot rejects missing capacity and recognizes relationships", () => {
  assert.throws(() => extractCelebritySnapshot({}), {
    code: "CELEBRITY_SNAPSHOT_UNAVAILABLE",
  });
  assert.deepEqual(
    extractCelebritySnapshot({
      friendship_status: "outgoing-follow-request",
      celebrity_data: { friend_count: 99, max_friends: 100 },
    }),
    {
      friendCount: 99,
      maxFriends: 100,
      availableSlots: 1,
      isFull: false,
      relationship: "outgoing-follow-request",
    },
  );

  assert.deepEqual(
    extractCelebritySnapshot({
      result: {
        data: {
          user: { friendship_status: "follower-waitlist" },
          celebrity_data: { friendCount: 100, maxFriends: 100 },
        },
      },
    }),
    {
      friendCount: 100,
      maxFriends: 100,
      availableSlots: 0,
      isFull: true,
      relationship: "follower-waitlist",
    },
  );
});

test("transition opens only from full/capacity growth and completes an outgoing request", () => {
  const opened = computeTransition(
    { friendCount: 100, maxFriends: 100, lastWasFull: true },
    {
      friendCount: 99,
      maxFriends: 100,
      availableSlots: 1,
      isFull: false,
      relationship: "none",
    },
  );
  assert.equal(opened.opened, true);
  assert.equal(opened.status, SLOT_STATUS.SLOT_OPEN);
  assert.equal(opened.snapshotSource, "username");

  const waitlisted = computeTransition({}, {
    friendCount: 99,
    maxFriends: 100,
    availableSlots: 1,
    isFull: false,
    relationship: "follower-waitlist",
  });
  assert.equal(waitlisted.completed, false);
  assert.equal(waitlisted.status, SLOT_STATUS.WATCHING);

  const requested = computeTransition({}, {
    friendCount: 99,
    maxFriends: 100,
    availableSlots: 1,
    isFull: false,
    relationship: "outgoing-follow-request",
  });
  assert.equal(requested.completed, true);
  assert.equal(requested.status, SLOT_STATUS.REQUESTED);

  const inviteSnapshot = computeTransition(
    { snapshotSource: "username" },
    {
      friendCount: 100,
      maxFriends: 100,
      availableSlots: 0,
      isFull: true,
      relationship: "none",
      snapshotSource: "invite",
    },
  );
  assert.equal(inviteSnapshot.snapshotSource, "invite");
});

test("refresh token encryption derives an authenticated key from Firebase Admin", () => {
  const env = { FIREBASE_PRIVATE_KEY: "a-stable-firebase-private-key-with-32-characters" };
  assert.ok(getEncryptionKey(env));
  const encrypted = encryptSecret("refresh-token-value", env);
  assert.notEqual(encrypted, "refresh-token-value");
  assert.equal(decryptSecret(encrypted, env), "refresh-token-value");
  assert.throws(() => decryptSecret(`${encrypted}x`, env));
  assert.equal(getEncryptionKey({ FIREBASE_PRIVATE_KEY: "short" }), null);
});

test("Firebase uid decoder reads user_id without verifying external JWT", () => {
  const encoded = Buffer.from(JSON.stringify({ user_id: "user-123" })).toString("base64url");
  assert.equal(decodeFirebaseUid(`header.${encoded}.signature`), "user-123");
  assert.equal(decodeFirebaseUid("invalid"), "");
});
