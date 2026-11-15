import test from "node:test";
import assert from "node:assert/strict";
import { isCelebrityProfile } from "../src/utils/celebrityProfile.js";

test("recognizes every Celebrity marker returned by Locket", () => {
  assert.equal(isCelebrityProfile({ celebrity: true }), true);
  assert.equal(isCelebrityProfile({ celebrity: "1" }), true);
  assert.equal(isCelebrityProfile({ accountTypes: ["celebrity"] }), true);
  assert.equal(isCelebrityProfile({ account_types: ["CELEBRITY"] }), true);
  assert.equal(isCelebrityProfile({ celebrity_data: { max_friends: 1000 } }), true);
  assert.equal(
    isCelebrityProfile({ friendship_status: "outgoing-follow-request" }),
    true,
  );
});

test("does not route an ordinary profile through the Celebrity flow", () => {
  assert.equal(
    isCelebrityProfile({ accountTypes: ["normal"], friendship_status: "none" }),
    false,
  );
  assert.equal(isCelebrityProfile(null), false);
});
