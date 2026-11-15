const {
  isPlayableAppleMusicUrl,
  normalizeAppleMusicUrl,
  normalizeIsrc,
  normalizeSpotifyUrl,
} = require("../Extensions/musicMetadata");

const normalizeMusicOptions = (optionsData = {}) => {
  if (optionsData.type !== "music") return optionsData;

  const source = {
    ...(optionsData.music || {}),
    ...(optionsData.payload || {}),
  };
  const songTitle =
    source.song_title || source.song_name || source.name || source.title || "";
  const artist = source.artist || "";
  const imageUrl =
    source.image_url || source.image || source.thumbnail || optionsData.icon?.data || null;
  const spotifyUrl = normalizeSpotifyUrl(
    source.spotify_url || (source.platform === "spotify" ? source.url : ""),
  );
  const appleMusicUrl = normalizeAppleMusicUrl(
    source.apple_music_url ||
      source.appleMusicUrl ||
      (source.platform === "apple" ? source.url : ""),
  );
  const isrc = normalizeIsrc(source.isrc);

  if (!songTitle || !artist || !isrc) {
    const error = new Error("Metadata nhạc chưa đủ tên bài, nghệ sĩ hoặc ISRC.");
    error.code = "INVALID_MUSIC_METADATA";
    error.status = 400;
    throw error;
  }
  if (!isPlayableAppleMusicUrl(appleMusicUrl)) {
    const error = new Error("Thiếu link Apple Music có mã bài hát (?i=trackId).");
    error.code = "INVALID_APPLE_MUSIC_URL";
    error.status = 400;
    throw error;
  }
  if (!imageUrl) {
    const error = new Error("Thiếu ảnh bìa album cho caption nhạc.");
    error.code = "MISSING_MUSIC_COVER";
    error.status = 400;
    throw error;
  }

  const payload = {
    song_title: songTitle,
    song_name: songTitle,
    name: songTitle,
    artist,
    isrc,
    image_url: imageUrl,
    platform: spotifyUrl ? "spotify" : "apple",
    ...(spotifyUrl ? { spotify_url: spotifyUrl } : {}),
    ...(appleMusicUrl ? { apple_music_url: appleMusicUrl } : {}),
  };
  const previewUrl = source.preview_url || source.previewUrl || source.audio;
  if (previewUrl && !/dzcdn\.net|hdnea=|p\.scdn\.co/i.test(previewUrl)) {
    payload.preview_url = previewUrl;
  }

  const caption =
    (typeof optionsData.caption === "string" && optionsData.caption.trim()) ||
    `${songTitle} · ${artist}`;

  return {
    ...optionsData,
    overlay_id: "caption:music",
    caption,
    text: caption,
    type: "music",
    payload,
    music: { ...source, ...payload, image: imageUrl },
    platform: payload.platform,
    icon: imageUrl
      ? { type: "image", data: imageUrl, source: "url" }
      : optionsData.icon,
  };
};

module.exports = { normalizeMusicOptions };
