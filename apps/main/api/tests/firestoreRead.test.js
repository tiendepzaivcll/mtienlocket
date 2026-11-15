const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildMomentStructuredQuery,
  decodeFirestoreValue,
  decodeCursor,
  encodeCursor,
  isStructuredMomentCursor,
  normalizeChatMessageDocument,
  normalizeConversationDocument,
  normalizeFriendDocument,
} = require("../src/services/FirestoreRead");

test("decodes REST and gRPC Firestore value casing", () => {
  assert.deepEqual(
    decodeFirestoreValue({
      mapValue: {
        fields: {
          title: { stringValue: "hello" },
          count: { integer_value: "2" },
          enabled: { booleanValue: true },
        },
      },
    }),
    { title: "hello", count: 2, enabled: true },
  );
});

test("normalizes friend relation metadata used by the client store", () => {
  const friend = normalizeFriendDocument({
    name: "projects/p/databases/(default)/documents/users/me/friends/friend-1",
    createTime: "2026-09-09T01:02:03.000Z",
    updateTime: "2026-09-09T02:02:03.000Z",
    fields: {
      user: { stringValue: "friend-1" },
      hidden: { booleanValue: true },
      celebrity: { booleanValue: true },
      shared_history_on: { timestampValue: "2026-09-08T01:02:03.000Z" },
    },
  });

  assert.equal(friend.uid, "friend-1");
  assert.equal(friend.hidden, true);
  assert.equal(friend.isCelebrity, true);
  assert.equal(friend.createdAt, Date.parse("2026-09-09T01:02:03.000Z"));
  assert.equal(
    friend.sharedHistoryOn,
    Date.parse("2026-09-08T01:02:03.000Z"),
  );
});

test("normalizes conversations without losing unread and latest-message data", () => {
  const conversation = normalizeConversationDocument(
    {
      name: "projects/p/databases/(default)/documents/users/me/conversations/c1",
      fields: {
        members: {
          array_value: {
            values: [{ string_value: "me" }, { string_value: "friend-1" }],
          },
        },
        unread_count: { integer_value: "3" },
        is_read: { boolean_value: false },
        latest_message: {
          map_value: {
            fields: {
              body: { string_value: "xin chào" },
              sender: { string_value: "friend-1" },
              created_at: { timestamp_value: { seconds: "100" } },
            },
          },
        },
      },
    },
    "me",
  );

  assert.equal(conversation.uid, "c1");
  assert.equal(conversation.with_user, "friend-1");
  assert.equal(conversation.unreadCount, 3);
  assert.equal(conversation.latestMessage.body, "xin chào");
  assert.equal(conversation.update_time, 100);
});

test("normalizes message identity, client token and reactions", () => {
  const message = normalizeChatMessageDocument({
    name: "projects/p/databases/(default)/documents/conversations/c1/messages/m1",
    fields: {
      body: { stringValue: "ok" },
      sender: { stringValue: "friend-1" },
      client_token: { stringValue: "client-1" },
      created_at: { timestampValue: "1970-01-01T00:01:40.000Z" },
      reactions: {
        arrayValue: {
          values: [
            {
              mapValue: {
                fields: {
                  sender: { stringValue: "me" },
                  emoji: { stringValue: "💛" },
                },
              },
            },
          ],
        },
      },
    },
  });

  assert.equal(message.id, "m1");
  assert.equal(message.uid, "c1");
  assert.equal(message.client_token, "client-1");
  assert.equal(message.create_time, 100);
  assert.deepEqual(message.reactions, [
    { sender: "me", emoji: "💛", created_at: 0 },
  ]);
});

test("structured moment cursor round-trips and produces a stable start cursor", () => {
  const token = encodeCursor({
    date: "2026-09-09T01:02:03.000Z",
    name: "projects/p/databases/locket/documents/history/me/entries/m1",
  });

  assert.equal(isStructuredMomentCursor(token), true);
  assert.deepEqual(decodeCursor(token), {
    date: "2026-09-09T01:02:03.000Z",
    name: "projects/p/databases/locket/documents/history/me/entries/m1",
  });

  const query = buildMomentStructuredQuery({
    friendId: "friend-1",
    limit: 500,
    cursor: token,
  }).structuredQuery;

  assert.equal(query.limit, 100);
  assert.equal(query.where.fieldFilter.value.stringValue, "friend-1");
  assert.equal(query.startAt.before, false);
  assert.equal(query.startAt.values[1].referenceValue.endsWith("/m1"), true);
});
