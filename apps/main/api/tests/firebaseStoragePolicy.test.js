const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createFirebaseStorageError,
  shouldRefreshAppCheck,
} = require("../src/services/FirestorageService/firebaseStoragePolicy");

test("classifies Firebase permission errors by upload stage", () => {
  const error = createFirebaseStorageError({
    stage: "transfer",
    status: 403,
    message: "Permission denied.",
  });
  assert.equal(error.status, 403);
  assert.equal(error.code, "FIREBASE_STORAGE_TRANSFER_FORBIDDEN");
  assert.equal(error.data.stage, "transfer");
});

test("App Check is refreshed at most once for Firebase permission failures", () => {
  assert.equal(shouldRefreshAppCheck({ status: 403 }, 0), true);
  assert.equal(shouldRefreshAppCheck({ status: 403 }, 1), false);
  assert.equal(shouldRefreshAppCheck({ status: 500 }, 0), false);
});
