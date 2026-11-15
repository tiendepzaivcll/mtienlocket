const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeRollcallMediaUrl,
} = require("../src/services/LocketMessage/rollcallMedia");
const {
  sniffRollcallMediaType,
} = require("../src/utils/rollcallMediaType");

test("allows only known HTTPS Rollcall media hosts", () => {
  assert.equal(
    normalizeRollcallMediaUrl("https://cdn.locketcamera.com/a.heic?token=x"),
    "https://cdn.locketcamera.com/a.heic?token=x",
  );
  assert.throws(
    () => normalizeRollcallMediaUrl("http://127.0.0.1/private"),
    (error) => error?.code === "ROLLCALL_MEDIA_HOST_BLOCKED",
  );
  assert.throws(
    () => normalizeRollcallMediaUrl("https://example.com/image.jpg"),
    (error) => error?.code === "ROLLCALL_MEDIA_HOST_BLOCKED",
  );
});

test("sniffs HEIC, JPEG, MP4 and rejects HTML", () => {
  const heic = Buffer.concat([
    Buffer.from([0x00, 0x00, 0x00, 0x18]),
    Buffer.from("ftypheic", "ascii"),
  ]);
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
  const mp4 = Buffer.concat([
    Buffer.from([0x00, 0x00, 0x00, 0x18]),
    Buffer.from("ftypmp42", "ascii"),
  ]);

  assert.equal(sniffRollcallMediaType(heic), "image/heic");
  assert.equal(sniffRollcallMediaType(jpeg), "image/jpeg");
  assert.equal(sniffRollcallMediaType(mp4), "video/mp4");
  assert.equal(sniffRollcallMediaType(Buffer.from("<html>no</html>"), "text/html"), "");
});
