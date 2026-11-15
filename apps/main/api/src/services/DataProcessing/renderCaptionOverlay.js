const axios = require("axios");
const sharp = require("sharp");

const CUSTOM_CAPTION_TYPES = new Set([
  "caption_gif",
  "image_gif",
]);

const escapeXml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const getIconUrl = (icon) => {
  if (!icon) return "";
  if (typeof icon === "string") return icon.startsWith("http") ? icon : "";
  if (typeof icon.data === "string" && icon.data.startsWith("http")) {
    return icon.data;
  }
  return "";
};

const getColors = (optionsData = {}) => {
  const colors = Array.isArray(optionsData.background?.colors)
    ? optionsData.background.colors
    : [optionsData.color_top, optionsData.color_bottom];

  const cleanColors = colors.filter((color) => color && typeof color === "string");
  return cleanColors.length >= 2 ? cleanColors : ["#3A3A3C", "#1C1C1E"];
};

const fetchIconDataUri = async (iconUrl) => {
  if (!iconUrl) return "";

  try {
    const response = await axios.get(iconUrl, {
      responseType: "arraybuffer",
      timeout: 8000,
    });

    const pngBuffer = await sharp(Buffer.from(response.data), {
      animated: false,
      limitInputPixels: false,
    })
      .resize(92, 92, { fit: "contain" })
      .png()
      .toBuffer();

    return `data:image/png;base64,${pngBuffer.toString("base64")}`;
  } catch (error) {
    console.warn("⚠️ Không tải được caption icon:", iconUrl, error.message);
    return "";
  }
};

const renderCaptionOverlayOnImage = async ({ imageBuffer, optionsData }) => {
  if (!CUSTOM_CAPTION_TYPES.has(optionsData?.type)) {
    return imageBuffer;
  }

  const caption = String(optionsData.caption || optionsData.text || "").trim();
  const iconUrl = getIconUrl(optionsData.icon);
  if (!caption && !iconUrl) return imageBuffer;

  const image = sharp(imageBuffer);
  const metadata = await image.metadata();
  const width = metadata.width || 1440;
  const height = metadata.height || 1440;
  const [colorTop, colorBottom] = getColors(optionsData);
  const textColor = optionsData.text_color || optionsData.color_text || "#FFFFFF";
  const iconDataUri = await fetchIconDataUri(iconUrl);
  if (!caption && !iconDataUri) return imageBuffer;

  const fontSize = Math.max(42, Math.round(width * 0.042));
  const iconSize = iconDataUri ? Math.round(fontSize * 1.38) : 0;
  const gap = iconDataUri ? Math.round(fontSize * 0.35) : 0;
  const horizontalPadding = Math.round(fontSize * 0.78);
  const verticalPadding = Math.round(fontSize * 0.42);
  const maxTextWidth = Math.round(width * 0.62);
  const estimatedTextWidth = caption
    ? Math.min(
        maxTextWidth,
        Math.max(fontSize * 1.2, caption.length * fontSize * 0.58),
      )
    : 0;
  const pillWidth = Math.min(
    Math.round(width * 0.86),
    Math.round(horizontalPadding * 2 + iconSize + gap + estimatedTextWidth),
  );
  const pillHeight = Math.round(fontSize + verticalPadding * 2);
  const pillX = Math.round((width - pillWidth) / 2);
  const pillY = Math.round(height - pillHeight - height * 0.085);
  const radius = Math.round(pillHeight / 2);
  const contentX = pillX + horizontalPadding;
  const iconY = pillY + Math.round((pillHeight - iconSize) / 2);
  const textX = contentX + iconSize + gap;
  const textY = pillY + Math.round(pillHeight / 2 + fontSize * 0.35);

  const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="captionBg" x1="0" y1="${pillY}" x2="0" y2="${pillY + pillHeight}" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="${escapeXml(colorTop)}"/>
          <stop offset="100%" stop-color="${escapeXml(colorBottom)}"/>
        </linearGradient>
        <filter id="captionShadow" x="-20%" y="-40%" width="140%" height="180%">
          <feDropShadow dx="0" dy="${Math.round(fontSize * 0.14)}" stdDeviation="${Math.round(fontSize * 0.2)}" flood-color="#000000" flood-opacity="0.28"/>
        </filter>
      </defs>
      <rect x="${pillX}" y="${pillY}" width="${pillWidth}" height="${pillHeight}" rx="${radius}" fill="url(#captionBg)" filter="url(#captionShadow)"/>
      ${
        iconDataUri
          ? `<image href="${iconDataUri}" x="${contentX}" y="${iconY}" width="${iconSize}" height="${iconSize}" preserveAspectRatio="xMidYMid meet"/>`
          : ""
      }
      ${
        caption
          ? `<text x="${textX}" y="${textY}" max-width="${maxTextWidth}" fill="${escapeXml(textColor)}" font-size="${fontSize}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif" font-weight="700">${escapeXml(caption)}</text>`
          : ""
      }
    </svg>
  `;

  console.log("🖌️ Burned custom caption into image:", {
    type: optionsData.type,
    caption,
    hasIcon: Boolean(iconDataUri),
    colors: [colorTop, colorBottom],
  });

  return sharp(imageBuffer)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .webp({ quality: 90 })
    .toBuffer();
};

module.exports = {
  CUSTOM_CAPTION_TYPES,
  renderCaptionOverlayOnImage,
};
