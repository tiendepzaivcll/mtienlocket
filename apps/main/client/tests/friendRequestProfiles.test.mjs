import test from "node:test";
import assert from "node:assert/strict";
import { mergeRequestProfiles } from "../src/utils/friendRequestProfiles.js";

test("requests survive partial or failed profile lookups and missing UIDs are ignored", () => {
  const requests = [{ uid: "a" }, { uid: "b" }, { uid: "a" }, {}];
  const result = mergeRequestProfiles(requests, [{ uid: "a", firstName: "Alice" }]);
  assert.equal(result.length, 2);
  assert.equal(result[0].firstName, "Alice");
  assert.equal(result[1].uid, "b");
  assert.match(result[1].firstName, /Người dùng/);
});
test("profile completion cannot resurrect an accepted or cancelled request", () => {
  const result = mergeRequestProfiles([{ uid: "b" }], [{ uid: "a", firstName: "Alice" }]);
  assert.deepEqual(result.map((item) => item.uid), ["b"]);
});
