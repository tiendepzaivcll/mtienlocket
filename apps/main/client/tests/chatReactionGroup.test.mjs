import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeGroupMessage,
  removeMessageById,
  updateMessageReaction,
} from "../src/stores/MessageStores/messageMutations.js";

test("reaction update replaces the current user's previous emoji", () => {
  const messages = [
    {
      id: "m1",
      reactions: [
        { sender: "me", emoji: "💛" },
        { user_id: "friend", emoji: "😂" },
      ],
    },
  ];

  const updated = updateMessageReaction(messages, "m1", "me", "🔥");
  assert.deepEqual(
    updated[0].reactions.map((reaction) => [reaction.user_id, reaction.emoji]),
    [["friend", "😂"], ["me", "🔥"]],
  );
  assert.equal(messages[0].reactions[0].emoji, "💛");
});

test("reaction update removes only the selected user's reaction", () => {
  const updated = updateMessageReaction(
    [
      {
        id: "m1",
        reactions: [
          { sender: "me", emoji: "💛" },
          { sender: "friend", emoji: "👍" },
        ],
      },
    ],
    "m1",
    "me",
    null,
  );

  assert.deepEqual(updated[0].reactions, [{ sender: "friend", emoji: "👍" }]);
});

test("message deletion is scoped to the selected message", () => {
  assert.deepEqual(
    removeMessageById([{ id: "m1" }, { id: "m2" }], "m1"),
    [{ id: "m2" }],
  );
});

test("group messages normalize into the shared chat shape", () => {
  const message = normalizeGroupMessage(
    {
      id: "gm1",
      user_id: "friend",
      created_at: 1_780_000_000_000,
      content: { type: "text", content: "xin chào nhóm" },
      reactions: [{ user_id: "me", emoji: "🔥" }],
    },
    "group-1",
  );

  assert.equal(message.uid, "group-1");
  assert.equal(message.sender, "friend");
  assert.equal(message.text, "xin chào nhóm");
  assert.equal(message.create_time, 1_780_000_000);
  assert.equal(message.reactions[0].sender, "me");
});
