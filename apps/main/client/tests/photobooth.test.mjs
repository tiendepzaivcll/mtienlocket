import test from "node:test";
import assert from "node:assert/strict";
import {
  capturePhotoboothFrame,
  composePhotoboothGrid,
  getCenteredSquareCrop,
  getPhotoboothGrid,
} from "../src/utils/photobooth.js";

function canvasHarness({ blob = new Blob(["jpeg"], { type: "image/jpeg" }) } = {}) {
  const calls = [];
  const context = Object.fromEntries(["save", "restore", "translate", "scale", "drawImage", "fillRect"].map(
    (method) => [method, (...args) => calls.push([method, ...args])],
  ));
  const canvas = {
    getContext: () => context,
    toBlob(callback, type, quality) {
      calls.push(["toBlob", type, quality]);
      callback(blob);
    },
  };
  return {
    calls, canvas, context,
    createCanvas: () => canvas,
    createFile: (parts, name, options) => ({ parts, name, ...options }),
  };
}

test("square crop preserves center for portrait and landscape input", () => {
  assert.deepEqual(getCenteredSquareCrop(1920, 1080), { sx: 420, sy: 0, side: 1080 });
  assert.deepEqual(getCenteredSquareCrop(720, 1280), { sx: 0, sy: 280, side: 720 });
  assert.throws(() => getCenteredSquareCrop(0, 1080));
});

test("front camera capture mirrors one time and uses the centered video area", async () => {
  const h = canvasHarness();
  const video = { readyState: 2, videoWidth: 1920, videoHeight: 1080 };
  const file = await capturePhotoboothFrame(video, { mirror: true, filename: "shot.jpg", ...h });
  assert.deepEqual(h.calls.filter(([method]) => ["translate", "scale", "drawImage"].includes(method)), [
    ["translate", 1920, 0], ["scale", -1, 1],
    ["drawImage", video, 420, 0, 1080, 1080, 0, 0, 1920, 1920],
  ]);
  assert.equal(h.calls.filter(([method]) => method === "save").length, 1);
  assert.equal(h.calls.filter(([method]) => method === "restore").length, 1);
  assert.equal(file.name, "shot.jpg");
  assert.equal(file.type, "image/jpeg");
});

test("back camera capture does not mirror and handles portrait dimensions", async () => {
  const h = canvasHarness();
  const video = { readyState: 4, videoWidth: 720, videoHeight: 1280 };
  await capturePhotoboothFrame(video, h);
  assert.equal(h.calls.some(([method]) => method === "scale" || method === "translate"), false);
  assert.deepEqual(h.calls.find(([method]) => method === "drawImage"),
    ["drawImage", video, 0, 280, 720, 720, 0, 0, 1920, 1920]);
});

test("camera loading or zero-sized frame fails without exporting a black photo", async () => {
  const h = canvasHarness();
  await assert.rejects(capturePhotoboothFrame({ readyState: 1, videoWidth: 640, videoHeight: 480 }, h), /chưa sẵn sàng/);
  await assert.rejects(capturePhotoboothFrame({ readyState: 4, videoWidth: 0, videoHeight: 0 }, h), /kích thước/);
  assert.equal(h.calls.length, 0);
});

test("four distinct photos export in shot order with white outer border and gutter", async () => {
  const h = canvasHarness();
  const sources = ["blob:one", "blob:two", "blob:three", "blob:four"];
  const images = sources.map((src, index) => ({ src, width: index % 2 ? 600 : 1200, height: index % 2 ? 1000 : 800 }));
  const file = await composePhotoboothGrid(sources, {
    ...h, loadImage: async (src) => images[sources.indexOf(src)],
  });
  assert.equal(h.canvas.width, 1920);
  assert.equal(h.canvas.height, 1920);
  assert.equal(h.context.fillStyle, "#ffffff");
  assert.deepEqual(h.calls.find(([method]) => method === "fillRect"), ["fillRect", 0, 0, 1920, 1920]);
  const draws = h.calls.filter(([method]) => method === "drawImage");
  assert.deepEqual(draws.map(([, image, ...args]) => [image.src, ...args]), [
    ["blob:one", 200, 0, 800, 800, 8, 8, 948, 948],
    ["blob:two", 0, 200, 600, 600, 964, 8, 948, 948],
    ["blob:three", 200, 0, 800, 800, 8, 964, 948, 948],
    ["blob:four", 0, 200, 600, 600, 964, 964, 948, 948],
  ]);
  assert.equal(h.calls.some(([method]) => method === "scale"), false, "captured images must not be mirrored twice");
  assert.equal(file.type, "image/jpeg");
});

test("partial, duplicate, unreadable or remote frames never export a placeholder grid", async () => {
  const h = canvasHarness();
  const good = ["blob:a", "blob:b", "blob:c", "blob:d"];
  const loadImage = async () => ({ width: 100, height: 100 });
  await assert.rejects(composePhotoboothGrid(good.slice(0, 3), { ...h, loadImage }), /đủ 4 ảnh/);
  await assert.rejects(composePhotoboothGrid([good[0], good[1], good[2], good[2]], { ...h, loadImage }), /đủ 4 ảnh/);
  await assert.rejects(composePhotoboothGrid([...good.slice(0, 3), "https://example.com/image.jpg"], { ...h, loadImage }), /trên thiết bị/);
  await assert.rejects(composePhotoboothGrid(good, { ...h, loadImage: async (src) => ({ width: src === "blob:d" ? 0 : 100, height: 100 }) }), /kích thước/);
  await assert.rejects(composePhotoboothGrid(good, { ...h, loadImage: async () => { throw new Error("decode failed"); } }), /decode failed/);
  assert.equal(h.calls.length, 0);
});

test("canvas encoding failure rejects instead of returning an empty upload file", async () => {
  const h = canvasHarness({ blob: null });
  await assert.rejects(capturePhotoboothFrame({ readyState: 2, videoWidth: 100, videoHeight: 100 }, h), /Không thể tạo ảnh/);
});

test("odd output size keeps all four tiles in bounds with the exact requested gaps", () => {
  const grid = getPhotoboothGrid({ size: 101, gap: 3, border: 4 });
  const [a, b, c, d] = grid.tiles;
  assert.equal(b.x - a.x - a.width, 3);
  assert.equal(c.y - a.y - a.height, 3);
  assert.equal(d.x + d.width, 97);
  assert.equal(d.y + d.height, 97);
  assert.equal(a.x, 4);
  assert.throws(() => getPhotoboothGrid({ size: 20, gap: 8, border: 8 }));
});

const framedSources = ["blob:frame-one", "blob:frame-two", "blob:frame-three", "blob:frame-four"];
const sampleFrame = () => ({
  id: "dark-sparkle",
  src: "/images/photobooth/frames/dark-sparkle.png",
  photoRegions: [
    { x: 0.05, y: 0.05, width: 0.4, height: 0.3 },
    { x: 0.55, y: 0.05, width: 0.4, height: 0.3 },
    { x: 0.05, y: 0.55, width: 0.4, height: 0.3 },
    { x: 0.55, y: 0.55, width: 0.4, height: 0.3 },
  ],
});

test("selected frame uses its exact rectangular openings and draws decoration above all four photos", async () => {
  const h = canvasHarness();
  const images = framedSources.map((src) => ({ src, width: 1000, height: 1000 }));
  const overlay = { width: 1536, height: 1536, src: sampleFrame().src };
  const file = await composePhotoboothGrid(framedSources, {
    ...h, frame: sampleFrame(),
    loadImage: async (src) => images[framedSources.indexOf(src)],
    loadFrameImage: async (src) => { assert.equal(src, overlay.src); return overlay; },
  });
  const draws = h.calls.filter(([method]) => method === "drawImage");
  assert.deepEqual(draws.slice(0, 4), [
    ["drawImage", images[0], 0, 125, 1000, 750, 96, 96, 768, 576],
    ["drawImage", images[1], 0, 125, 1000, 750, 1056, 96, 768, 576],
    ["drawImage", images[2], 0, 125, 1000, 750, 96, 1056, 768, 576],
    ["drawImage", images[3], 0, 125, 1000, 750, 1056, 1056, 768, 576],
  ]);
  assert.deepEqual(draws[4], ["drawImage", overlay, 0, 0, 1920, 1920]);
  assert.equal(h.calls.some(([method]) => method === "scale"), false, "overlay must not cause photos to mirror again");
  assert.equal(file.type, "image/jpeg");
});

test("composition waits for the selected overlay and never silently exports without it", async () => {
  const h = canvasHarness();
  let finishOverlay;
  const overlayPromise = new Promise((resolve) => { finishOverlay = resolve; });
  const composition = composePhotoboothGrid(framedSources, {
    ...h, frame: sampleFrame(),
    loadImage: async () => ({ width: 1000, height: 1000 }),
    loadFrameImage: () => overlayPromise,
  });
  await Promise.resolve();
  assert.equal(h.calls.length, 0, "no drawing or JPEG export before overlay finishes loading");
  finishOverlay({ width: 1536, height: 1536 });
  await composition;
  assert.equal(h.calls.filter(([method]) => method === "drawImage").length, 5);
});

test("missing or failed overlay rejects before exporting any unframed result", async () => {
  for (const loadFrameImage of [
    async () => { throw new Error("frame download failed"); },
    async () => ({ naturalWidth: 0, naturalHeight: 0 }),
    async () => null,
  ]) {
    const h = canvasHarness();
    await assert.rejects(composePhotoboothGrid(framedSources, {
      ...h, frame: sampleFrame(), loadFrameImage,
      loadImage: async () => ({ width: 1000, height: 1000 }),
    }));
    assert.equal(h.calls.length, 0);
  }
});

test("frame metadata rejects unapproved assets and missing, overlapping or out-of-bounds openings", async () => {
  const original = sampleFrame();
  const invalidFrames = [
    { ...original, src: "https://example.com/frame.png" },
    { ...original, id: "unknown" },
    { ...original, id: "blue-sky" },
    { ...original, photoRegions: original.photoRegions.slice(0, 3) },
    { ...original, photoRegions: original.photoRegions.map((region, i) => i ? region : { ...region, x: -0.01 }) },
    { ...original, photoRegions: original.photoRegions.map((region, i) => i ? region : { ...region, width: 1 }) },
    { ...original, photoRegions: original.photoRegions.map((region, i) => i ? region : { ...region, height: 0 }) },
    { ...original, photoRegions: original.photoRegions.map((region, i) => i ? region : { ...region, x: NaN }) },
    { ...original, photoRegions: original.photoRegions.map((region, i) => i ? region : original.photoRegions[1]) },
  ];
  for (const frame of invalidFrames) {
    const h = canvasHarness();
    await assert.rejects(composePhotoboothGrid(framedSources, {
      ...h, frame,
      loadImage: async () => ({ width: 1000, height: 1000 }),
      loadFrameImage: async () => ({ width: 1536, height: 1536 }),
    }));
    assert.equal(h.calls.length, 0);
  }
});
