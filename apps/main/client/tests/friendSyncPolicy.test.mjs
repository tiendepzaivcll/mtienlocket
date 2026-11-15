import test from "node:test";
import assert from "node:assert/strict";

import {
  getMissingFriendDetails,
  mergeUniqueFriendDetails,
  reconcileFriendDetails,
} from "../src/stores/FriendStores/friendSyncPolicy.js";

test("removes orphan details that are absent from the authoritative server list", () => {
  const localDetails = Array.from({ length: 63 }, (_, index) => ({
    uid: `friend-${index + 1}`,
  }));
  const apiFriends = Array.from({ length: 59 }, (_, index) => ({
    uid: `friend-${index + 1}`,
  }));

  const reconciled = reconcileFriendDetails(localDetails, apiFriends);

  assert.equal(reconciled.length, 59);
  assert.equal(reconciled.at(-1).uid, "friend-59");
});

test("finds missing details even when their IDs were cached previously", () => {
  const details = [{ uid: "friend-1" }];
  const apiFriends = [{ uid: "friend-1" }, { uid: "friend-2" }];

  assert.deepEqual(getMissingFriendDetails(details, apiFriends), [
    { uid: "friend-2" },
  ]);
});

test("merges refreshed details by uid without duplicates", () => {
  assert.deepEqual(
    mergeUniqueFriendDetails(
      [{ uid: "friend-1", username: "old" }],
      [{ uid: "friend-1", username: "new" }, { uid: "friend-2" }],
    ),
    [
      { uid: "friend-1", username: "new" },
      { uid: "friend-2" },
    ],
  );
});
