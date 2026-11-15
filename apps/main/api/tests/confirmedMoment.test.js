const test = require("node:test");
const assert = require("node:assert/strict");
const {
  extractConfirmedMoment,
  getConfirmedMomentId,
} = require("../src/services/LocketMoment/confirmedMoment");

test("accepts supported Locket moment id shapes", () => {
  assert.equal(getConfirmedMomentId({ canonical_uid: "canonical-1" }), "canonical-1");
  assert.equal(getConfirmedMomentId({ id: "moment-1" }), "moment-1");
  assert.equal(
    getConfirmedMomentId({ momentId: { stringValue: "moment-2" } }),
    "moment-2",
  );
});

test("extracts confirmed moments from current response shapes", () => {
  assert.equal(
    extractConfirmedMoment({ result: { data: { id: "a" } } }).id,
    "a",
  );
  assert.equal(extractConfirmedMoment({ data: { id: "b" } }).id, "b");
  assert.equal(extractConfirmedMoment({ moment: { id: "c" } }).id, "c");
});

test("rejects an HTTP success without a real moment id", () => {
  assert.throws(
    () => extractConfirmedMoment({ data: { overlays: [] } }),
    (error) =>
      error.code === "LOCKET_POST_NOT_CONFIRMED" && error.status === 502,
  );
});
