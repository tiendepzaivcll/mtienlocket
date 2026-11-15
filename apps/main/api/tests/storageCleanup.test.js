const test = require("node:test");
const assert = require("node:assert/strict");
const axios = require("axios");
const config = require("../src/config/app.config");
const {
  deleteFileFromStorageR2,
} = require("../src/services/DataProcessing/deleteFileFromStorage");

function configureStorage(t, token) {
  const previousUrl = config.services.storageUrl;
  const previousToken = process.env.STORAGE_INTERNAL_TOKEN;
  config.services.storageUrl = "https://storage.example.com";
  if (token === undefined) delete process.env.STORAGE_INTERNAL_TOKEN;
  else process.env.STORAGE_INTERNAL_TOKEN = token;
  t.after(() => {
    config.services.storageUrl = previousUrl;
    if (previousToken === undefined) delete process.env.STORAGE_INTERNAL_TOKEN;
    else process.env.STORAGE_INTERNAL_TOKEN = previousToken;
  });
}

test("cleanup sends the server credential required by protected storage", async (t) => {
  configureStorage(t, "test-server-credential");
  const post = t.mock.method(axios, "post", async (url, body, options) => {
    assert.equal(url, "https://storage.example.com/api/delete");
    assert.deepEqual(body, { key: "LocketCloud/test/image/user/file.jpg" });
    assert.equal(options.headers["x-storage-token"], "test-server-credential");
    return { data: { success: true, message: "Deleted" } };
  });
  const result = await deleteFileFromStorageR2("LocketCloud/test/image/user/file.jpg");
  assert.equal(result.success, true);
  assert.equal(post.mock.callCount(), 1);
});

test("cleanup does not send a destructive request without a server credential", async (t) => {
  configureStorage(t, undefined);
  const post = t.mock.method(axios, "post", async () => {
    throw new Error("An unauthenticated deletion must not be attempted");
  });
  const result = await deleteFileFromStorageR2("LocketCloud/test/image/user/file.jpg");
  assert.equal(result.success, false);
  assert.equal(post.mock.callCount(), 0);
});
