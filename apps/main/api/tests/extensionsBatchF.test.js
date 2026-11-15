const test = require("node:test");
const assert = require("node:assert/strict");
const {
  isPlayableAppleMusicUrl,
  normalizeAppleMusicUrl,
  normalizeIsrc,
  normalizeSpotifyUrl,
  parseSpotifyOembed,
  resolveMusicMetadata,
} = require("../src/services/Extensions/musicMetadata");
const {
  createWeatherCache,
  parseCoordinates,
} = require("../src/services/Extensions/weatherCache");
const {
  normalizeMusicOptions,
} = require("../src/services/LocketPayload/normalizeMusicOptions");
const {
  normalizePollOptions,
} = require("../src/services/LocketPayload/normalizePollOptions");
const {
  getWeatherColors,
  getWeatherGradientKey,
} = require("../src/utils/weatherCaption");

test("normalizes Spotify, Apple Music and ISRC identifiers", () => {
  assert.equal(
    normalizeSpotifyUrl("https://open.spotify.com/intl-vn/track/1234567890ABC?si=x"),
    "https://open.spotify.com/track/1234567890ABC",
  );
  assert.equal(
    normalizeAppleMusicUrl(
      "https://music.apple.com/vn/album/example/123?i=456789&uo=4&at=test",
    ),
    "https://music.apple.com/vn/album/example/123?i=456789",
  );
  assert.equal(normalizeIsrc("vn-a12-34-56789"), "VNA123456789");
  assert.equal(normalizeIsrc("bad"), null);
});

test("uses the Spotify oEmbed author instead of reversing title and artist", () => {
  assert.deepEqual(
    parseSpotifyOembed({
      title: "Tên bài hát",
      author_name: "Tên nghệ sĩ",
      thumbnail_url: "https://image.test/cover.jpg",
    }),
    {
      song_title: "Tên bài hát",
      artist: "Tên nghệ sĩ",
      image_url: "https://image.test/cover.jpg",
    },
  );
});

test("enriches Spotify metadata with Apple and Deezer fields", async () => {
  const calls = [];
  const httpClient = {
    async get(url) {
      calls.push(url);
      if (url.includes("spotify.com/oembed")) {
        return { data: { title: "Bài test", author_name: "Ca sĩ", thumbnail_url: "cover" } };
      }
      if (url.includes("itunes.apple.com/search")) {
        return {
          data: {
            results: [{
              wrapperType: "track",
              trackName: "Bài test",
              artistName: "Ca sĩ",
              artworkUrl100: "https://is1.mzstatic.com/image/100x100bb.jpg",
              previewUrl: "https://audio-ssl.itunes.apple.com/preview.m4a",
              trackViewUrl: "https://music.apple.com/vn/album/bai-test/123?i=456789",
            }],
          },
        };
      }
      if (url.includes("api.deezer.com/search")) {
        return { data: { data: [{ id: 99, title: "Bài test", artist: { name: "Ca sĩ" } }] } };
      }
      if (url.includes("api.deezer.com/track/99")) {
        return {
          data: {
            id: 99,
            title: "Bài test",
            artist: { name: "Ca sĩ" },
            album: { cover_xl: "deezer-cover" },
            isrc: "VNA123456789",
          },
        };
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  };

  const result = await resolveMusicMetadata({
    url: "https://open.spotify.com/track/1234567890ABC",
    platform: "spotify",
    httpClient,
  });

  assert.equal(result.song_title, "Bài test");
  assert.equal(result.artist, "Ca sĩ");
  assert.equal(result.isrc, "VNA123456789");
  assert.ok(isPlayableAppleMusicUrl(result.apple_music_url));
  assert.equal(result.spotify_url, "https://open.spotify.com/track/1234567890ABC");
  assert.ok(calls.some((url) => url.includes("itunes.apple.com/search")));
  assert.ok(calls.some((url) => url.includes("api.deezer.com/track/99")));
});

test("builds the native Locket music payload from the legacy music field", () => {
  const normalized = normalizeMusicOptions({
    type: "music",
    caption: "",
    music: {
      title: "Bài test",
      artist: "Ca sĩ",
      isrc: "vn-a12-34-56789",
      image: "https://image.test/cover.jpg",
      spotify_url: "https://open.spotify.com/track/1234567890ABC?si=x",
      apple_music_url: "https://music.apple.com/vn/album/test/1?i=456789&uo=4",
      preview_url: "https://audio-ssl.itunes.apple.com/preview.m4a",
    },
  });

  assert.equal(normalized.overlay_id, "caption:music");
  assert.equal(normalized.payload.song_title, "Bài test");
  assert.equal(normalized.payload.isrc, "VNA123456789");
  assert.equal(normalized.payload.apple_music_url.endsWith("?i=456789"), true);
  assert.deepEqual(normalized.icon, {
    type: "image",
    data: "https://image.test/cover.jpg",
    source: "url",
  });
});

test("validates world coordinates and keeps a stale weather fallback", () => {
  assert.deepEqual(parseCoordinates(0, 0), { lat: 0, lon: 0 });
  assert.throws(() => parseCoordinates(91, 0), /Tọa độ không hợp lệ/);
  assert.throws(() => parseCoordinates("x", 0), /Tọa độ không hợp lệ/);

  const cache = createWeatherCache({ ttlMs: -1, staleMs: 60_000 });
  const coordinates = { lat: 10.7769, lon: 106.7009 };
  cache.set(coordinates, { current: { temp_c: 30 } });
  assert.equal(cache.get(coordinates), null);
  assert.equal(cache.get(coordinates, { allowStale: true }).stale, true);
});

test("keeps native poll question, text and payload in sync", () => {
  const normalized = normalizePollOptions({
    type: "poll",
    caption: "Đi chơi không?",
    payload: { left_emoji: "✅", right_emoji: "❌" },
  });
  assert.equal(normalized.overlay_id, "caption:poll");
  assert.equal(normalized.text, "Đi chơi không?");
  assert.equal(normalized.payload.question, "Đi chơi không?");
  assert.equal(normalized.payload.left_emoji, "✅");
});

test("matches the sample weather gradients including twilight", () => {
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
    getWeatherColors({ is_day: 1, wk_condition: "thunderstorms" }, now),
    ["#7790A6", "#AAAAAA"],
  );
  assert.deepEqual(
    getWeatherColors(
      { is_day: 1, wk_condition: "clear", sunrise_timestamp_ms: now },
      now,
    ),
    ["#AE88FF", "#FFC1AD"],
  );
  assert.deepEqual(
    getWeatherColors(
      { is_day: 1, wk_condition: "clear", sunset_timestamp_ms: now },
      now,
    ),
    ["#6C77DA", "#FFC896"],
  );
});
