import test from "node:test";
import assert from "node:assert/strict";
import { buildMusicOverlay } from "../src/services/ExtensionsServices/musicOverlay.js";
import {
  isCacheNearLocation,
  readWeatherCache,
  WEATHER_CACHE_KEY,
  writeWeatherCache,
} from "../src/utils/enviroment/weatherCache.js";
import {
  getWeatherColors,
  getWeatherGradientKey,
} from "../src/utils/enviroment/weatherCaption.js";

const createStorage = () => {
  const entries = new Map();
  return {
    getItem: (key) => entries.get(key) || null,
    setItem: (key, value) => entries.set(key, value),
  };
};

test("builds a complete native music overlay for the uploader", () => {
  const overlay = buildMusicOverlay({
    title: "Bài test",
    artist: "Ca sĩ",
    isrc: "vn-a12-34-56789",
    image_url: "https://image.test/cover.jpg",
    spotify_url: "https://open.spotify.com/track/1234567890ABC",
    apple_music_url: "https://music.apple.com/vn/album/test/1?i=456789",
  });
  assert.equal(overlay.overlay_id, "caption:music");
  assert.equal(overlay.payload.isrc, "VNA123456789");
  assert.equal(overlay.payload.song_title, "Bài test");
  assert.equal(overlay.music.image, "https://image.test/cover.jpg");
});

test("rejects music metadata that Locket cannot render", () => {
  assert.throws(
    () => buildMusicOverlay({ title: "Thiếu", artist: "ISRC" }),
    /ISRC/,
  );
});

test("weather cache is fresh, location-aware and safe to parse", () => {
  const storage = createStorage();
  writeWeatherCache(
    storage,
    {
      location: { lat: 10.7769, lon: 106.7009 },
      weather: { temp_c: 30, temp_c_rounded: 30, wk_condition: "clear" },
    },
    1_000,
  );
  const cached = readWeatherCache(storage, 2_000);
  assert.ok(storage.getItem(WEATHER_CACHE_KEY));
  assert.equal(cached.weather.temp_c, 30);
  assert.equal(
    isCacheNearLocation(cached, { latitude: 10.78, longitude: 106.705 }),
    true,
  );
  assert.equal(
    isCacheNearLocation(cached, { latitude: 11.1, longitude: 106.705 }),
    false,
  );
});

test("client preview uses the same sample gradients as the API", () => {
  const now = Date.UTC(2026, 8, 9, 11, 0, 0);
  assert.equal(
    getWeatherGradientKey({ is_day: 1, wk_condition: "clear" }, now),
    "clearDay",
  );
  assert.deepEqual(
    getWeatherColors({ is_day: 0, wk_condition: "clear" }, now),
    ["#370C6F", "#575CD4"],
  );
  assert.deepEqual(
    getWeatherColors({ is_day: 1, wk_condition: "rain" }, now),
    ["#7790A6", "#AAAAAA"],
  );
  assert.deepEqual(
    getWeatherColors(
      { is_day: 1, wk_condition: "clear", sunrise_timestamp_ms: now },
      now,
    ),
    ["#AE88FF", "#FFC1AD"],
  );
});
