import test from "node:test";
import assert from "node:assert/strict";

import { normalizeMoment } from "../src/utils/standardize/normalizeMoments.js";
import {
  createMomentCaptionSnapshot,
  restoreMomentCaption,
} from "../src/utils/moment/preserveMomentCaption.js";
import { mergeStableMomentOrder } from "../src/utils/moment/stableMomentOrder.js";
import { formatFirestoreTime } from "../src/utils/Formats/formatFirestoreTime.js";
import {
  formatTimeAgo,
  normalizeTimestampMillis,
} from "../src/utils/Formats/formatTimeAgo.js";
import {
  classifyPhoneMedia,
  detectPhoneImageFormat,
  normalizePhoneImage,
  parseJpegExifOrientation,
} from "../src/utils/imageUtils/normalizePhoneImage.js";

const namedBlob = (parts, name, type = "") => {
  const blob = new Blob(
    parts.map((part) => (Array.isArray(part) ? new Uint8Array(part) : part)),
    { type },
  );
  Object.defineProperty(blob, "name", { value: name });
  return blob;
};

const jpegWithOrientation = (orientation) => {
  const tiff = [
    0x49, 0x49, 0x2a, 0x00,
    0x08, 0x00, 0x00, 0x00,
    0x01, 0x00,
    0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00,
    orientation, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
  ];
  const payload = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff];
  const size = payload.length + 2;
  return new Uint8Array([
    0xff, 0xd8, 0xff, 0xe1,
    (size >> 8) & 0xff,
    size & 0xff,
    ...payload,
    0xff, 0xd9,
  ]);
};

test("moment normalizer preserves media aliases and native overlay payload", () => {
  const moment = normalizeMoment({
    canonical_uid: "moment-1",
    imageUrl: "https://cdn.test/thumb.jpg",
    videoUrl: "https://cdn.test/video.mp4",
    createTime: "2026-09-09T10:00:00.000Z",
    overlays: {
      id: "caption:music",
      type: "caption",
      captionType: "music",
      text: "Bài hát",
      payload: { isrc: "VNA123" },
    },
  });

  assert.equal(moment.id, "moment-1");
  assert.equal(moment.video_url, "https://cdn.test/video.mp4");
  assert.equal(moment.thumbnail_url, "https://cdn.test/thumb.jpg");
  assert.equal(moment.overlays.captionType, "music");
  assert.equal(moment.overlays.payload.isrc, "VNA123");
  assert.ok(moment.createTime > 0);
  assert.equal(moment.date, Date.parse("2026-09-09T10:00:00.000Z"));
  assert.ok(formatTimeAgo(moment.date));
});

test("moment normalizer keeps posting time from Firestore timestamp aliases", () => {
  const expected = 1_788_976_800_250;
  const aliases = [
    { date: "2026-09-09T18:00:00.250Z" },
    { createdAt: expected },
    {
      created_at: {
        _seconds: { value: "1788976800" },
        _nanoseconds: { value: "250000000" },
      },
    },
  ];

  aliases.forEach((timestampFields, index) => {
    const moment = normalizeMoment({
      canonical_uid: `moment-time-${index}`,
      ...timestampFields,
    });
    assert.equal(moment.date, expected);
    assert.equal(moment.createdAt, expected);
    assert.ok(formatTimeAgo(moment.date));
  });
});

test("moment refresh keeps order and restores a temporarily missing caption", () => {
  const current = [
    { id: "a", caption: "Caption A", overlays: { text: "Caption A" } },
    { id: "b", caption: "Caption B", overlays: { text: "Caption B" } },
  ];
  const merge = (oldMoment, freshMoment) => {
    if (!oldMoment) return freshMoment;
    return restoreMomentCaption(
      { ...oldMoment, ...freshMoment },
      createMomentCaptionSnapshot(oldMoment),
    );
  };
  const merged = mergeStableMomentOrder(
    current,
    [{ id: "b", caption: "", overlays: null }, { id: "c" }, { id: "a" }],
    merge,
  );

  assert.deepEqual(merged.map((item) => item.id), ["c", "a", "b"]);
  assert.equal(merged.find((item) => item.id === "b").caption, "Caption B");
});

test("moment activity timestamps never render an invalid NaN date", () => {
  const wrappedTimestamp = {
    _seconds: { value: "1788976800" },
    _nanoseconds: { value: "250000000" },
  };

  assert.equal(normalizeTimestampMillis(wrappedTimestamp), 1788976800250);
  assert.equal(formatTimeAgo({ unexpected: true }), "");
  assert.equal(formatFirestoreTime({ unexpected: true }), "");
  assert.ok(!formatTimeAgo(wrappedTimestamp).includes("NaN"));
  assert.ok(!formatFirestoreTime(wrappedTimestamp).includes("NaN"));
});

test("phone media classification handles missing mobile MIME values", () => {
  assert.equal(classifyPhoneMedia({ name: "IMG_1234.HEIC", type: "" }), "image");
  assert.equal(classifyPhoneMedia({ name: "clip.MOV", type: "" }), "video");
  assert.equal(classifyPhoneMedia({ name: "unsafe.svg", type: "image/svg+xml" }), null);
});

test("phone image detection uses magic bytes and reads EXIF orientation", async () => {
  assert.equal(
    await detectPhoneImageFormat(namedBlob([[0xff, 0xd8, 0xff, 0xd9]], "x.bin")),
    "jpeg",
  );
  assert.equal(
    await detectPhoneImageFormat(
      namedBlob([new TextEncoder().encode("0000ftypheic0000")], "x.bin"),
    ),
    "heic",
  );
  assert.equal(parseJpegExifOrientation(jpegWithOrientation(6)), 6);
});

test("oversized phone image is rejected before browser decoding", async () => {
  const oversized = namedBlob(
    [new Uint8Array(10 * 1024 * 1024 + 1)],
    "large.jpg",
    "image/jpeg",
  );
  await assert.rejects(
    normalizePhoneImage(oversized),
    (error) => error?.code === "IMAGE_TOO_LARGE",
  );
});
