import test from "node:test";
import assert from "node:assert/strict";
import {
  getQuickReactions,
  isSingleEmoji,
} from "../src/utils/chatEmoji.js";

test("custom reactions accept one emoji, including flags, skin tones and joined sequences", () => {
  for (const emoji of ["🫶", "👍🏽", "🇻🇳", "❤️‍🔥", "👨‍👩‍👧‍👦", "1️⃣", " 🐱 "]) {
    assert.equal(isSingleEmoji(emoji), true, emoji);
  }
});
test("custom reactions reject text or multiple emoji", () => {
  for (const value of ["", "hi", "a", "12", "❤️ 💛", "😂😂", "a😂", "1"]) {
    assert.equal(isSingleEmoji(value), false, value);
  }
});

test("the last custom emoji is placed first without duplicating defaults", () => {
  const defaults = ["💛", "😂", "😍"];
  assert.deepEqual(getQuickReactions(defaults, "🫶"), ["🫶", "💛", "😂"]);
  assert.deepEqual(getQuickReactions(defaults, "😂"), ["😂", "💛", "😍"]);
});
