const axios = require("axios");

const MUSIC_CACHE_TTL_MS = 10 * 60 * 1000;
const musicCache = new Map();

const normalizeIsrc = (value = "") => {
  const normalized = String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return /^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/.test(normalized)
    ? normalized
    : null;
};

const getSpotifyTrackId = (value = "") => {
  const match = String(value || "").match(
    /(?:open\.spotify\.com\/(?:intl-[a-z]{2}\/)?(?:embed\/)?track\/|spotify:track:)([a-zA-Z0-9]{10,})/i,
  );
  return match?.[1] || null;
};

const normalizeSpotifyUrl = (value = "") => {
  const id = getSpotifyTrackId(value);
  return id ? `https://open.spotify.com/track/${id}` : null;
};

const getAppleTrackId = (value = "") => {
  const source = String(value || "");
  return (
    source.match(/[?&]i=(\d+)/)?.[1] ||
    source.match(/\/song\/[^/]+\/(\d+)/i)?.[1] ||
    null
  );
};

const normalizeAppleMusicUrl = (value = "") => {
  const source = String(value || "").trim();
  if (!source) return null;

  try {
    const parsed = new URL(source);
    const hostname = parsed.hostname.replace(/^geo\./i, "").toLowerCase();
    if (!/^(music|itunes)\.apple\.com$/.test(hostname)) return null;
    const trackId = parsed.searchParams.get("i");
    return `https://music.apple.com${parsed.pathname}${trackId ? `?i=${trackId}` : ""}`;
  } catch {
    return null;
  }
};

const isPlayableAppleMusicUrl = (value = "") =>
  Boolean(normalizeAppleMusicUrl(value)?.match(/[?&]i=\d{5,}/));

const parseSpotifyOembed = (data = {}) => {
  let title = String(data.title || "").trim();
  let artist = String(data.author_name || "").trim();

  if (!artist) {
    const parts = title.split(/\s+[·-]\s+/).map((part) => part.trim());
    if (parts.length >= 2) {
      title = parts[0];
      artist = parts.slice(1).join(" · ");
    }
  }

  return {
    song_title: title,
    artist,
    image_url: data.thumbnail_url || null,
  };
};

const normalizeItunesTrack = (track = {}) => {
  const artwork = String(track.artworkUrl100 || "").replace(
    /\/\d+x\d+bb\./,
    "/600x600bb.",
  );
  return {
    song_title: track.trackName || null,
    artist: track.artistName || null,
    image_url: artwork || null,
    preview_url: track.previewUrl || null,
    apple_music_url: normalizeAppleMusicUrl(track.trackViewUrl),
    isrc: normalizeIsrc(track.isrc),
  };
};

const scoreTrackMatch = (track, songTitle, artist) => {
  const targetTitle = String(songTitle || "").trim().toLowerCase();
  const targetArtist = String(artist || "").trim().toLowerCase();
  const candidateTitle = String(track.trackName || "").trim().toLowerCase();
  const candidateArtist = String(track.artistName || "").trim().toLowerCase();
  let score = 0;
  if (candidateTitle === targetTitle) score += 6;
  else if (candidateTitle.includes(targetTitle) || targetTitle.includes(candidateTitle)) score += 3;
  if (targetArtist && candidateArtist === targetArtist) score += 4;
  else if (targetArtist && (candidateArtist.includes(targetArtist) || targetArtist.includes(candidateArtist))) score += 2;
  return score;
};

const lookupItunes = async ({ songTitle, artist, appleTrackId, httpClient }) => {
  let results = [];
  if (appleTrackId) {
    const response = await httpClient.get("https://itunes.apple.com/lookup", {
      params: { id: appleTrackId, entity: "song", country: "vn" },
      timeout: 10000,
    });
    results = response.data?.results || [];
  }

  if (!results.some((item) => item.wrapperType === "track") && songTitle) {
    for (const country of ["vn", "us"]) {
      const response = await httpClient.get("https://itunes.apple.com/search", {
        params: {
          term: [songTitle, artist].filter(Boolean).join(" "),
          entity: "song",
          country,
          limit: 10,
        },
        timeout: 10000,
      });
      results = response.data?.results || [];
      if (results.some((item) => item.wrapperType === "track")) break;
    }
  }

  const tracks = results.filter((item) => item.wrapperType === "track");
  tracks.sort(
    (left, right) =>
      scoreTrackMatch(right, songTitle, artist) -
      scoreTrackMatch(left, songTitle, artist),
  );
  return tracks[0] ? normalizeItunesTrack(tracks[0]) : null;
};

const lookupDeezer = async ({ songTitle, artist, httpClient }) => {
  if (!songTitle) return null;
  const search = await httpClient.get("https://api.deezer.com/search", {
    params: { q: [songTitle, artist].filter(Boolean).join(" "), limit: 8 },
    timeout: 10000,
  });
  const hits = search.data?.data || [];
  const normalizedTitle = songTitle.toLowerCase();
  const normalizedArtist = String(artist || "").toLowerCase();
  const hit =
    hits.find(
      (item) =>
        String(item.title || "").toLowerCase() === normalizedTitle &&
        (!normalizedArtist ||
          String(item.artist?.name || "").toLowerCase().includes(normalizedArtist)),
    ) || hits[0];
  if (!hit?.id) return null;

  const response = await httpClient.get(`https://api.deezer.com/track/${hit.id}`, {
    timeout: 10000,
  });
  const track = response.data || {};
  if (!track.id) return null;
  return {
    song_title: track.title || null,
    artist: track.artist?.name || null,
    image_url: track.album?.cover_xl || track.album?.cover_big || null,
    preview_url: track.preview || null,
    isrc: normalizeIsrc(track.isrc),
  };
};

const mergeMissing = (target, source) => {
  if (!source) return target;
  const result = { ...target };
  for (const [key, value] of Object.entries(source)) {
    if ((result[key] === null || result[key] === undefined || result[key] === "") && value) {
      result[key] = value;
    }
  }
  return result;
};

const resolveMusicMetadata = async ({ url, platform, httpClient = axios }) => {
  const sourceUrl = String(url || "").trim();
  const spotifyUrl = normalizeSpotifyUrl(sourceUrl);
  const appleUrl = normalizeAppleMusicUrl(sourceUrl);
  const resolvedPlatform = spotifyUrl ? "spotify" : appleUrl ? "apple" : null;

  if (!sourceUrl || !resolvedPlatform) {
    const error = new Error("Link nhạc không hợp lệ. Chỉ hỗ trợ Spotify hoặc Apple Music.");
    error.status = 400;
    error.code = "INVALID_MUSIC_URL";
    throw error;
  }

  const cacheKey = `${resolvedPlatform}:${spotifyUrl || appleUrl || sourceUrl}`;
  const cached = musicCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < MUSIC_CACHE_TTL_MS) {
    return { ...cached.data, cache: "hit" };
  }

  let metadata = {
    platform: resolvedPlatform,
    spotify_url: spotifyUrl,
    apple_music_url: appleUrl,
  };

  if (spotifyUrl) {
    const response = await httpClient.get("https://open.spotify.com/oembed", {
      params: { url: spotifyUrl },
      timeout: 8000,
    });
    metadata = mergeMissing(metadata, parseSpotifyOembed(response.data));
  }

  try {
    metadata = mergeMissing(
      metadata,
      await lookupItunes({
        songTitle: metadata.song_title,
        artist: metadata.artist,
        appleTrackId: getAppleTrackId(appleUrl),
        httpClient,
      }),
    );
  } catch (error) {
    console.warn("[music] iTunes enrichment failed:", error.message);
  }

  try {
    metadata = mergeMissing(
      metadata,
      await lookupDeezer({
        songTitle: metadata.song_title,
        artist: metadata.artist,
        httpClient,
      }),
    );
  } catch (error) {
    console.warn("[music] Deezer enrichment failed:", error.message);
  }

  const title = metadata.song_title;
  if (!title) {
    const error = new Error("Không tìm thấy thông tin bài hát.");
    error.status = 404;
    error.code = "MUSIC_NOT_FOUND";
    throw error;
  }

  const data = {
    title,
    song_title: title,
    song_name: title,
    name: title,
    artist: metadata.artist || "Unknown Artist",
    image: metadata.image_url || null,
    image_url: metadata.image_url || null,
    preview_url: metadata.preview_url || null,
    isrc: normalizeIsrc(metadata.isrc),
    spotify_url: normalizeSpotifyUrl(metadata.spotify_url),
    apple_music_url: normalizeAppleMusicUrl(metadata.apple_music_url),
    platform: metadata.spotify_url ? "spotify" : "apple",
    url: sourceUrl,
    cache: "miss",
  };

  if (!data.isrc || !data.image_url || !isPlayableAppleMusicUrl(data.apple_music_url)) {
    const error = new Error(
      "Bài hát chưa đủ ISRC, ảnh bìa hoặc link Apple Music để hiển thị trên Locket.",
    );
    error.status = 422;
    error.code = "INCOMPLETE_MUSIC_METADATA";
    throw error;
  }

  musicCache.set(cacheKey, { timestamp: Date.now(), data });
  return data;
};

module.exports = {
  getAppleTrackId,
  getSpotifyTrackId,
  isPlayableAppleMusicUrl,
  normalizeAppleMusicUrl,
  normalizeIsrc,
  normalizeSpotifyUrl,
  parseSpotifyOembed,
  resolveMusicMetadata,
};
