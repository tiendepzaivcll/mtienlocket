import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createR2Uploader, normalizeR2Presign } from "../src/services/LocketDioServices/r2Upload.js";

const ownResponse = {
  url: "https://account.r2.cloudflarestorage.com/bucket/object?signature=test",
  publicURL: "https://media.example.com/object",
  key: "LocketCloud/image/user/object.jpg",
};

test("own storage response maps url/publicURL/key without losing original fields", () => {
  const value = normalizeR2Presign(ownResponse);
  assert.equal(value.uploadUrl, ownResponse.url);
  assert.equal(value.publicUrl, ownResponse.publicURL);
  assert.equal(value.path, ownResponse.key);
  assert.equal(value.key, ownResponse.key);
  assert.deepEqual(normalizeR2Presign(value), value);
  assert.throws(() => normalizeR2Presign({ url: "url", key: "key" }), /missing/);
});

for (const type of ["image/jpeg", "video/mp4"]) {
  test(`uploads ${type} with one presign and one PUT, without Dio membership`, async () => {
    const calls = [];
    const file = { name: "test.jpg", type, size: 123 };
    const upload = createR2Uploader({
      storageUrl: "http://localhost:5173/storage-api/",
      clientVersion: "test",
      api: { post: async (...args) => {
        calls.push(args);
        return { data: { data: ownResponse } };
      } },
      fetchUpload: async (...args) => { calls.push(args); return { ok: true }; },
    });
    const result = await upload(file, type.split("/")[0], "user");
    assert.equal(calls.length, 2);
    assert.equal(calls[0][0], "http://localhost:5173/storage-api/api/presignedV3");
    assert.equal(calls[0][1].contentType, type);
    assert.deepEqual(calls[0][2], { skipMemberToken: true, withCredentials: false });
    assert.equal(calls[1][0], `/storage-upload-proxy?url=${encodeURIComponent(ownResponse.url)}`);
    assert.equal(calls[1][1].method, "PUT");
    assert.equal(calls[1][1].body, file);
    assert.equal(result.publicUrl, ownResponse.publicURL);
    assert.equal(result.path, ownResponse.key);
    assert.equal(result.size, file.size);
  });
}

test("production uses configured storage and direct signed PUT, surfaces upload failures", async () => {
  const upload = createR2Uploader({
    storageUrl: "https://storage.example.com/",
    api: { post: async (url) => {
      assert.equal(url, "https://storage.example.com/api/presignedV3");
      return { data: { data: ownResponse } };
    } },
    fetchUpload: async (url) => {
      assert.equal(url, ownResponse.url);
      return { ok: false, status: 403 };
    },
  });
  await assert.rejects(upload({ name: "x.jpg", type: "image/jpeg" }),
    (error) => error.status === 403 && error.code === "R2_UPLOAD_FAILED");
});

test("missing own storage fails before sending any requests", async () => {
  const upload = createR2Uploader({ storageUrl: "" });
  await assert.rejects(upload({ name: "x.jpg" }), /VITE_STORAGE_API_URL/);
});

test("local proxy and upload entry point do not hardcode Dio endpoints", async () => {
  const vite = await readFile(new URL("../vite.config.js", import.meta.url), "utf8");
  const entry = await readFile(new URL("../src/services/LocketDioServices/StorageServices.js", import.meta.url), "utf8");
  assert.doesNotMatch(vite + entry, /locket-dio\.com|\/member-api|ensureR2MemberSession/);
  assert.match(vite, /target: storageTarget/);
});
