const { createBaseImagePayload, createIntValue } = require("./createBasePayload");
const { normalizeMusicOptions } = require("./normalizeMusicOptions");
const { normalizePollOptions } = require("./normalizePollOptions");
const {
  getWeatherColors,
  getWeatherSymbol,
  getWeatherTemperatureC,
  getWeatherTemperatureF,
  isWeatherDaylight,
} = require("../../utils/weatherCaption");

const DEFAULT_CAPTION_MEDIA_COLORS = ["#3A3A3C", "#1C1C1E"];
const DEFAULT_NATIVE_COUNTER_COLORS = ["#FFD25F", "#EAA900"];
const DEFAULT_NATIVE_COUNTER_TEXT_COLOR = "#00000099";
const LOCKET_ARIES_ICON_URL =
  "https://storage.googleapis.com/locket-public/overlays/star_signs/Aries.png";
const CAPTION_ICON_CUSTOM_TYPES = new Set([
  "caption_image",
  "image_icon",
  "caption_icon",
]);
const STAR_SIGN_COMPAT_TYPES = new Set(["star_sign", ...CAPTION_ICON_CUSTOM_TYPES]);
const STATIC_CONTENT_COMPAT_TYPES = new Set([
  "template",
  "custom",
  "custome",
  "background",
  "special",
  "decorative",
  "holiday",
  "caption_gif",
  "image_gif",
]);
const STATIC_CONTENT_REPLACEMENT_TYPES = new Set([
  "template",
  "custom",
  "custome",
  "background",
  "special",
  "caption_gif",
  "image_gif",
]);
const NATIVE_COUNTER_TYPES = new Set(["streak", "locket_count"]);
const NATIVE_COUNTER_ICONS = {
  streak: "flame.fill",
  locket_count: "suit.heart.fill",
};

const createAriesIcon = () => ({
  type: "image",
  data: LOCKET_ARIES_ICON_URL,
  source: "url",
});

const isLocketStarSignIcon = (data = "") =>
  typeof data === "string" &&
  data.startsWith("https://storage.googleapis.com/locket-public/overlays/star_signs/");

// Helper function to format icon properly
const normalizeExternalUrl = (url = "") => {
  if (typeof url !== "string") return "";
  const trimmed = url.trim();
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return "";
};

const formatIcon = (icon) => {
  if (!icon) return null;

  // Already formatted object with type and data
  if (icon && typeof icon === 'object' && icon.type && icon.data) {
    // If type is "image", ensure source: "url" is present
    if (icon.type === "image") {
      return { type: "image", data: icon.data, source: icon.source || "url" };
    }
    return icon;
  }

  // String - check if URL or emoji
  if (icon && typeof icon === 'string' && icon.trim()) {
    const trimmed = icon.trim();
    // Check if it's a URL (starts with http:// or https://)
    const externalUrl = normalizeExternalUrl(trimmed);
    if (externalUrl) {
      return { type: "image", data: externalUrl, source: "url" };
    }
    // Otherwise treat as emoji
    return { type: "emoji", data: trimmed };
  }

  return null;
};

const normalizeIconForCaptionType = (iconObj, type) => {
  if (!iconObj) {
    return type === "star_sign" ? createAriesIcon() : null;
  }

  if (STAR_SIGN_COMPAT_TYPES.has(type)) {
    // Locket accepts custom caption icons when they keep the native star_sign schema.
    // Only the real star_sign preset needs the Aries fallback.
    if (type === "star_sign" && !isLocketStarSignIcon(iconObj.data)) {
      return createAriesIcon();
    }

    if (iconObj.type === "image" || iconObj.type === "gif") {
      return { type: "image", data: iconObj.data, source: iconObj.source || "url" };
    }

    return iconObj;
  }

  const data = iconObj.data || "";
  if ((type === "caption_gif" || type === "image_gif") && /\.gif($|\?)/i.test(data)) {
    return { ...iconObj, type: "gif", source: iconObj.source || "url" };
  }

  return iconObj;
};

const getBackgroundColors = ({ background, color_top, color_bottom, type }) => {
  const colors = (background?.colors && Array.isArray(background.colors) && background.colors.length > 0)
    ? background.colors.filter(c => c && typeof c === 'string')
    : [color_top, color_bottom].filter(c => c && typeof c === 'string' && c.trim());

  if (
    colors.length < 2 &&
    (STAR_SIGN_COMPAT_TYPES.has(type) || STATIC_CONTENT_REPLACEMENT_TYPES.has(type))
  ) {
    return DEFAULT_CAPTION_MEDIA_COLORS;
  }

  return colors;
};

const getLocketCaptionType = (type) => {
  if (STAR_SIGN_COMPAT_TYPES.has(type)) {
    return "star_sign";
  }

  if (STATIC_CONTENT_COMPAT_TYPES.has(type)) {
    return "static_content";
  }

  return type;
};

const toWeatherCloudCover = (cloudCover) => {
  const value = Number(cloudCover);
  if (!Number.isFinite(value)) return undefined;
  return value > 1 ? Number((value / 100).toFixed(2)) : value;
};

const normalizeWeatherOptions = (optionsData = {}) => {
  if (optionsData.type !== "weather") return optionsData;

  const weather =
    optionsData.caption && typeof optionsData.caption === "object"
      ? optionsData.caption
      : optionsData.weather ||
        optionsData.payload?.weather || {
          ...(optionsData.payload || {}),
          is_day: optionsData.payload?.is_daylight,
        };
  const rawTemp = getWeatherTemperatureC(weather);
  const tempText =
    rawTemp !== null && rawTemp !== undefined && !Number.isNaN(Number(rawTemp))
      ? `${Math.round(Number(rawTemp))}°C`
      : "";
  const text =
    typeof optionsData.caption === "string" && optionsData.caption.trim()
      ? optionsData.caption.trim()
      : tempText || weather.condition || "Thời tiết";
  const colors = getWeatherColors(weather);
  const rawTemperature = getWeatherTemperatureF({
    ...weather,
    temperature:
      weather.temperature ?? optionsData.payload?.temperature,
  });
  const temperature =
    rawTemperature === null || rawTemperature === undefined
      ? Number.NaN
      : Number(rawTemperature);
  const cloudCover = toWeatherCloudCover(
    weather.cloud_cover ?? optionsData.payload?.cloud_cover,
  );
  const isDaylight = isWeatherDaylight(weather);

  return {
    ...optionsData,
    overlay_id: optionsData.overlay_id || "weather",
    caption: text,
    icon: {
      color: optionsData.icon?.color || "#FFFFFF",
      data: getWeatherSymbol(weather),
      type: "sf_symbol",
    },
    text_color: optionsData.text_color || "#FFFFFFE6",
    color_top: colors[0],
    color_bottom: colors[1],
    background: {
      ...(optionsData.background && typeof optionsData.background === "object"
        ? optionsData.background
        : {}),
      colors,
    },
    max_lines: 1,
    payload: {
      ...(optionsData.payload || {}),
      ...(Number.isFinite(temperature) ? { temperature } : {}),
      ...(cloudCover !== undefined ? { cloud_cover: cloudCover } : {}),
      is_daylight: isDaylight,
      symbol_name: getWeatherSymbol(weather),
      ...((weather.wk_condition || optionsData.payload?.wk_condition)
        ? { wk_condition: weather.wk_condition || optionsData.payload.wk_condition }
        : {}),
    },
  };
};

const normalizeNativeCounterOptions = (optionsData = {}) => {
  if (!NATIVE_COUNTER_TYPES.has(optionsData.type)) return optionsData;

  const caption = optionsData.caption ?? optionsData.text ?? "0";
  const colors = Array.isArray(optionsData.background?.colors) && optionsData.background.colors.length >= 2
    ? optionsData.background.colors
    : [optionsData.color_top, optionsData.color_bottom].filter(Boolean);

  return {
    ...optionsData,
    overlay_id: optionsData.overlay_id || optionsData.type,
    caption: String(caption),
    text: String(optionsData.text ?? caption),
    text_color: optionsData.text_color || DEFAULT_NATIVE_COUNTER_TEXT_COLOR,
    icon: optionsData.icon && typeof optionsData.icon === "object"
      ? {
          color: optionsData.icon.color || optionsData.text_color || DEFAULT_NATIVE_COUNTER_TEXT_COLOR,
          data: optionsData.icon.data || NATIVE_COUNTER_ICONS[optionsData.type],
          type: optionsData.icon.type || "sf_symbol",
        }
      : {
          color: optionsData.text_color || DEFAULT_NATIVE_COUNTER_TEXT_COLOR,
          data: NATIVE_COUNTER_ICONS[optionsData.type],
          type: "sf_symbol",
        },
    background: {
      ...(optionsData.background && typeof optionsData.background === "object"
        ? optionsData.background
        : {}),
      colors: colors.length >= 2 ? colors : DEFAULT_NATIVE_COUNTER_COLORS,
    },
    color_top: optionsData.color_top || DEFAULT_NATIVE_COUNTER_COLORS[0],
    color_bottom: optionsData.color_bottom || DEFAULT_NATIVE_COUNTER_COLORS[1],
    max_lines: optionsData.max_lines || 1,
    payload: optionsData.payload || {},
  };
};

// Đăng nền mặc định + caption
exports.imagePostPayloadDefault = ({ imageUrl, optionsData }) => {
  const { caption } = optionsData;
  const data = createBaseImagePayload({ imageUrl, optionsData });

  if (caption?.trim()) {
    data.caption = caption;
    data.overlays.push({
      data: {
        text: caption,
        text_color: "#FFFFFFE6",
        type: "standard",
        max_lines: createIntValue(4),
        background: {
          colors: [],
          material_blur: "ultra_thin",
        },
      },
      alt_text: caption,
      overlay_id: "caption:standard",
      overlay_type: "caption",
    });
  }
  return { data };
};

exports.imagePostPayloadDecorative = ({ imageUrl, optionsData }) => {
  // Lấy tất cả trường cần thiết từ optionsData
  const {
    overlay_id = "standard",
    caption = "",
    text = "",
    text_color = "#FFFFFFE6",
    icon = null,
    background = {},
    color_top = "",
    color_bottom = "",
    max_lines = 1,
    type = "template",
  } = optionsData || {};

  const data = createBaseImagePayload({ imageUrl, optionsData });

  // Chuẩn hóa background.colors
  const colors = getBackgroundColors({ background, color_top, color_bottom, type });

  // Chuẩn hóa icon
  const iconObj = formatIcon(icon);

  const overlayData = {
    text: caption || text,
    text_color,
    type: "static_content",
    max_lines,
    background: { colors },
  };

  if (iconObj) {
    overlayData.icon = iconObj;
  }

  const resolvedOverlayId = overlay_id?.startsWith("caption:")
    ? overlay_id
    : `caption:${overlay_id || "party_time"}`;

  data.overlays.push({
    data: overlayData,
    alt_text: caption || text,
    overlay_id: resolvedOverlayId,
    overlay_type: "caption",
  });

  return { data };
};

exports.imagePostPayloadCustome = ({ imageUrl, optionsData }) => {
  const { caption, text_color, color_top, color_bottom, icon, background } = optionsData;
  const data = createBaseImagePayload({ imageUrl, optionsData });

  // Use background.colors if provided, otherwise construct from color_top/color_bottom
  const colors = getBackgroundColors({ background, color_top, color_bottom, type: "static_content" });

  const overlayData = {
    text: caption,
    text_color,
    type: "static_content",
    max_lines: {
      "@type": "type.googleapis.com/google.protobuf.Int64Value",
      value: "4",
    },
    background: {
      colors: colors,
    },
  };

  // Handle icon - can be object {type, data}, URL string, or emoji string
  const iconObj = formatIcon(icon);
  if (iconObj) {
    overlayData.icon = iconObj;
  }

  data.overlays.push({
    data: overlayData,
    alt_text: caption,
    overlay_id: "caption:miss_you",
    overlay_type: "caption",
  });

  return { data };
};

exports.imagePostPayloadIcon = ({ imageUrl, optionsData }) => {
  optionsData = normalizeWeatherOptions(optionsData);
  optionsData = normalizeNativeCounterOptions(optionsData);
  optionsData = normalizeMusicOptions(optionsData);
  optionsData = normalizePollOptions(optionsData);

  const {
    overlay_id = "standard",
    caption = "",
    text = "",
    text_color = "#FFFFFFE6",
    color_top,
    color_bottom,
    icon,
    background,
    max_lines = 1,
    type = "static_content",
    payload = {},
  } = optionsData;
  const data = createBaseImagePayload({ imageUrl, optionsData });
  const overlayText = caption || text;

  // Use background.colors if provided, otherwise construct from color_top/color_bottom
  const colors = getBackgroundColors({ background, color_top, color_bottom, type });

  const backgroundData = {
    ...(background && typeof background === "object" && !Array.isArray(background)
      ? background
      : {}),
    colors,
  };

  if (STAR_SIGN_COMPAT_TYPES.has(type)) {
    backgroundData.image = backgroundData.image || {
      data: "star_sign_background",
      type: "image",
      source: "local",
    };
  }

  if (
    type !== "weather" &&
    type !== "time" &&
    !NATIVE_COUNTER_TYPES.has(type) &&
    !backgroundData.image &&
    !STATIC_CONTENT_COMPAT_TYPES.has(type)
  ) {
    backgroundData.material_blur = backgroundData.material_blur || "ultra_thin";
  }

  const overlayData = {
    text: overlayText,
    text_color,
    type: getLocketCaptionType(type),
    max_lines: type === "poll" ? 2 : max_lines,
    background: backgroundData,
  };

  if (payload && Object.keys(payload).length > 0) {
    overlayData.payload = payload;
  }

  // Handle icon - can be object {type, data}, URL string, or emoji string
  const iconObj = normalizeIconForCaptionType(formatIcon(icon), type);
  if (iconObj) {
    overlayData.icon = iconObj;
  }

  const resolvedOverlayId =
    STAR_SIGN_COMPAT_TYPES.has(type)
      ? "caption:star_sign"
      : STATIC_CONTENT_REPLACEMENT_TYPES.has(type)
        ? "caption:party_time"
      : overlay_id?.startsWith("caption:")
        ? overlay_id
        : `caption:${overlay_id || "standard"}`;

  data.overlays.push({
    data: overlayData,
    alt_text:
      type === "poll"
        ? `${overlayText} - ${payload?.left_emoji || ""} ${payload?.right_emoji || ""}`.trim()
        : overlayText,
    overlay_id: resolvedOverlayId,
    overlay_type: "caption",
  });

  return { data };
};
