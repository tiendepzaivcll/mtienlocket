import test from "node:test";
import assert from "node:assert/strict";
import { getChatMenuPlacement } from "../src/utils/chatMenuPlacement.js";

test("reaction menu flips below messages near the top edge", () => {
  assert.equal(
    getChatMenuPlacement({
      anchorTop: 70,
      anchorBottom: 110,
      boundaryTop: 56,
      boundaryBottom: 700,
      menuHeight: 190,
    }),
    "below",
  );
});

test("reaction menu stays above messages when there is enough room", () => {
  assert.equal(
    getChatMenuPlacement({
      anchorTop: 500,
      anchorBottom: 540,
      boundaryTop: 56,
      boundaryBottom: 700,
      menuHeight: 190,
    }),
    "above",
  );
});
