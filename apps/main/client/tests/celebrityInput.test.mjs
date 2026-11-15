import test from "node:test";
import assert from "node:assert/strict";

import {
  celebrityProfileUrl,
  hasCelebritySlotData,
  normalizeCelebrityInput,
} from "../src/pages/Auth/LocketDioTools/tools/CelebrityTool/celebrityInput.js";

test("normalizes Celebrity usernames and Locket profile links", () => {
  assert.equal(normalizeCelebrityInput("SaweetieTest"), "saweetietest");
  assert.equal(normalizeCelebrityInput(" @saweetietest "), "saweetietest");
  assert.equal(
    normalizeCelebrityInput("https://www.locket.cam/SaweetieTest/?source=test"),
    "saweetietest",
  );
  assert.equal(normalizeCelebrityInput("locket.cam/saweetietest"), "saweetietest");
});

test("rejects non-Locket links and malformed usernames", () => {
  assert.equal(normalizeCelebrityInput("https://example.com/saweetietest"), "");
  assert.equal(normalizeCelebrityInput("not a username"), "");
  assert.equal(normalizeCelebrityInput("locket.cam/"), "");
});

test("only accepts live profiles with valid Celebrity slot data", () => {
  assert.equal(
    hasCelebritySlotData({
      uid: "celebrity-1",
      celebrity_data: { friend_count: 9, max_friends: 10 },
    }),
    true,
  );
  assert.equal(
    hasCelebritySlotData({ uid: "ordinary-user", celebrity_data: null }),
    false,
  );
  assert.equal(celebrityProfileUrl("saweetietest"), "https://locket.cam/saweetietest");
});
