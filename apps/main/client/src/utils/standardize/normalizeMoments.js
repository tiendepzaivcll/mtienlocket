const NON_TEXT_OVERLAY_TYPES = new Set([
  "music",
  "poll",
  "review",
  "color_palette",
  "streak",
  "locket_count",
  "weather",
  "location",
  "battery",
  "time",
  "heart",
  "special",
  "decorative",
  "template",
  "image_icon",
  "image_gif",
  "caption_gif",
  "caption_image",
  "star_sign",
]);

const asText = (value) =>
  typeof value === "string" && value.trim() ? value.trim() : "";

const finiteNumber = (value) => {
  const resolved = value && typeof value === "object" ? value.value : value;
  const number = Number(resolved);
  return Number.isFinite(number) ? number : null;
};

const timestampToMs = (value) => {
  if (!value) return 0;
  if (typeof value === "number") {
    return value > 0 && value < 1e12 ? value * 1000 : value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
      const numeric = Number(trimmed);
      return numeric > 0 && numeric < 1e12 ? numeric * 1000 : numeric;
    }
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value?.toMillis === "function") {
    try {
      return finiteNumber(value.toMillis()) || 0;
    } catch {
      return 0;
    }
  }
  const seconds = finiteNumber(value._seconds ?? value.seconds);
  const nanoseconds = finiteNumber(value._nanoseconds ?? value.nanoseconds) || 0;
  return seconds === null ? 0 : seconds * 1000 + Math.floor(nanoseconds / 1e6);
};

const overlayHasContent = (overlay) => {
  if (!overlay || typeof overlay !== "object") return false;
  const type = String(
    overlay.captionType || overlay.type || overlay.overlay_type || "",
  ).toLowerCase();
  if (asText(overlay.text) || asText(overlay.caption)) return true;
  if (!type || type === "caption" || type === "standard" || type === "default") {
    return false;
  }
  return (
    NON_TEXT_OVERLAY_TYPES.has(type) ||
    Object.keys(overlay.payload || {}).length > 0 ||
    Object.keys(overlay.icon || {}).length > 0
  );
};

const resolveOverlayType = (overlay) => {
  const id = String(overlay.id || overlay.overlay_id || "").toLowerCase();
  const type = overlay.captionType || overlay.type;
  if (type && type !== "caption" && type !== "standard") return type;
  if (id.includes("music") || overlay.payload?.isrc) return "music";
  if (id.includes("poll")) return "poll";
  if (id.includes("review")) return "review";
  return type || "caption";
};

const normalizeOverlay = (overlays, legacyCaption) => {
  let source = null;
  if (Array.isArray(overlays)) {
    const item =
      overlays.find((entry) => entry?.data || entry?.overlay_type) || overlays[0];
    if (item) source = { ...item, ...(item.data || {}) };
  } else if (overlays && typeof overlays === "object") {
    source = { ...overlays, ...(overlays.data || {}) };
  }
  if (!source) return null;

  const text =
    asText(source.text) ||
    asText(source.caption) ||
    asText(source.alt_text) ||
    legacyCaption;
  const type = resolveOverlayType(source);
  const normalized = {
    ...source,
    id: source.id || source.overlay_id || null,
    overlay_id: source.overlay_id || source.id || null,
    type: source.overlay_type || source.type || "caption",
    captionType: type,
    text,
    caption: text,
    textColor: source.textColor || source.text_color || "#FFFFFFE6",
    text_color: source.text_color || source.textColor || "#FFFFFFE6",
    maxLines: source.maxLines ?? source.max_lines ?? null,
    max_lines: source.max_lines ?? source.maxLines ?? null,
    background: source.background || {},
    icon: source.icon || {},
    music: source.music || {},
    payload: source.payload || {},
  };
  return overlayHasContent(normalized) ? normalized : null;
};

export function normalizeMoment(data) {
  if (!data || typeof data !== "object") return null;

  const id = data.canonical_uid || data.canonicalUid || data.id || null;
  if (!id) return null;
  const legacyCaption = asText(data.caption);
  const overlay = normalizeOverlay(data.overlays, legacyCaption);
  const caption = asText(overlay?.text) || legacyCaption;
  const dateSource =
    data.date ||
    data.createdAt ||
    data.created_at ||
    data.createTime ||
    data.create_time ||
    data.updateTime ||
    data.update_time ||
    data.timestamp;
  const createTime = timestampToMs(
    data.createTime ||
      data.create_time ||
      data.createdAt ||
      data.created_at ||
      dateSource,
  );
  const postedAt = timestampToMs(dateSource) || createTime || null;

  const imageUrl = data.image_url || data.imageUrl || null;
  const videoUrl = data.video_url || data.videoUrl || null;
  const thumbnailUrl =
    data.thumbnail_url || data.thumbnailUrl || imageUrl || null;

  return {
    ...data,
    id,
    user: data.user || data.userUid || data.owner || null,
    userUid: data.userUid || data.user || data.owner || null,
    senderId:
      data.senderId ||
      data.sender_id ||
      data.user ||
      data.userUid ||
      data.owner ||
      null,
    seenBy: Array.isArray(data.seenBy)
      ? data.seenBy
      : Array.isArray(data.seen_by)
      ? data.seen_by
      : Array.isArray(data.views)
      ? data.views
      : [],
    seen_by: Array.isArray(data.seen_by)
      ? data.seen_by
      : Array.isArray(data.seenBy)
      ? data.seenBy
      : Array.isArray(data.views)
      ? data.views
      : [],
    image_url: imageUrl,
    imageUrl,
    video_url: videoUrl,
    videoUrl,
    thumbnail_url: thumbnailUrl,
    thumbnailUrl,
    thumbnailCdnUrl: data.thumbnailCdnUrl || data.imageCdnUrl || null,
    imageCdnUrl: data.imageCdnUrl || data.thumbnailCdnUrl || null,
    videoCdnUrl: data.videoCdnUrl || null,
    // Keep timestamps numeric. Locale-formatted date strings are not reliably
    // parseable by Safari and previously made the Moment View time disappear.
    date: postedAt,
    createdAt: postedAt,
    createTime: createTime || postedAt,
    caption,
    overlays: overlay,
    captions: caption
      ? [
          {
            text: caption,
            caption,
            text_color: overlay?.text_color || "#FFFFFFE6",
            background: overlay?.background || {},
            icon: overlay?.icon || null,
            payload: overlay?.payload || {},
            type: overlay?.captionType || "caption",
          },
        ]
      : [],
    sent_to_all: Boolean(data.sent_to_all),
    show_personally: Boolean(data.show_personally),
    group_id: data.group_id || data.groupId || null,
  };
}
