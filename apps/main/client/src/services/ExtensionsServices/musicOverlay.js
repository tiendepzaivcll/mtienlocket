const normalizeIsrc = (value = "") => {
  const normalized = String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return /^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/.test(normalized)
    ? normalized
    : null;
};

export const buildMusicOverlay = (music = {}) => {
  const songTitle = music.song_title || music.song_name || music.name || music.title;
  const artist = music.artist || "";
  const imageUrl = music.image_url || music.image || music.thumbnail || null;
  const spotifyUrl = music.spotify_url || null;
  const appleMusicUrl = music.apple_music_url || music.appleMusicUrl || null;
  const isrc = normalizeIsrc(music.isrc);

  if (!songTitle || !artist || !isrc) {
    throw new Error("Metadata nhạc chưa đủ tên bài, nghệ sĩ hoặc ISRC.");
  }
  if (!appleMusicUrl || !/[?&]i=\d{5,}/.test(String(appleMusicUrl))) {
    throw new Error("Thiếu link Apple Music có mã bài hát (?i=trackId).");
  }
  if (!imageUrl) {
    throw new Error("Không lấy được ảnh bìa album.");
  }

  const caption = `${songTitle} · ${artist}`;
  const payload = {
    song_title: songTitle,
    song_name: songTitle,
    name: songTitle,
    artist,
    isrc,
    image_url: imageUrl,
    platform: spotifyUrl ? "spotify" : "apple",
    ...(music.preview_url ? { preview_url: music.preview_url } : {}),
    ...(spotifyUrl ? { spotify_url: spotifyUrl } : {}),
    ...(appleMusicUrl ? { apple_music_url: appleMusicUrl } : {}),
  };

  return {
    preset_id: "music",
    overlay_id: "caption:music",
    caption,
    text: caption,
    type: "music",
    icon: imageUrl
      ? { type: "image", data: imageUrl, source: "url" }
      : null,
    payload,
    music: { ...music, ...payload, image: imageUrl },
    platform: payload.platform,
  };
};
