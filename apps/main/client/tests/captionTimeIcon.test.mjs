import test from "node:test";
import assert from "node:assert/strict";
import { resolveTimeIcon } from "../src/utils/captionIcon.js";

test("time caption renders clock identifiers as SF Symbols, not broken images", () => {
  assert.deepEqual(resolveTimeIcon("clock.fill"), {
    data: "clock.fill",
    type: "sf_symbol",
    color: "#FFFFFF",
  });
  assert.equal(
    resolveTimeIcon({ data: "clock.fill", type: "sf_symbol" }).type,
    "sf_symbol",
  );
});

test("time caption still accepts image and emoji icons", () => {
  assert.equal(resolveTimeIcon("/icons/clock.png").type, "image");
  assert.equal(resolveTimeIcon("🕘").type, "emoji");
});
