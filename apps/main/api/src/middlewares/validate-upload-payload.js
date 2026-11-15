const ALLOWED_MEDIA_TYPES = new Set(["image", "video"]);
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

function isPrivateHostname(hostname) {
  const value = String(hostname || "").toLowerCase();
  if (["localhost", "0.0.0.0", "::1"].includes(value)) return true;
  if (/^127\./.test(value) || /^10\./.test(value) || /^192\.168\./.test(value)) {
    return true;
  }
  const match = value.match(/^172\.(\d+)\./);
  if (match && Number(match[1]) >= 16 && Number(match[1]) <= 31) return true;
  return value === "169.254.169.254" || value.endsWith(".local");
}

function validateUploadPayload(req, res, next) {
  const mediaInfo = req.body?.mediaInfo;
  const metadata = mediaInfo?.metadata || {};
  const publicUrl =
    mediaInfo?.publicUrl ||
    mediaInfo?.publicURL ||
    mediaInfo?.url ||
    mediaInfo?.downloadURL;
  const path = mediaInfo?.path || metadata.path;
  const type = String(mediaInfo?.type || metadata.type || "").toLowerCase();
  const size = Number(mediaInfo?.size || metadata.size);

  if (!mediaInfo || !publicUrl || !path) {
    return res.status(400).json({
      success: false,
      code: "R2_MEDIA_INFO_MISSING",
      message: "Thiếu thông tin file R2 (publicUrl hoặc path)",
    });
  }

  if (!ALLOWED_MEDIA_TYPES.has(type)) {
    return res.status(400).json({
      success: false,
      code: "INVALID_MEDIA_TYPE",
      message: "Loại media không hợp lệ",
    });
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(publicUrl);
  } catch {
    parsedUrl = null;
  }
  if (
    !parsedUrl ||
    !["http:", "https:"].includes(parsedUrl.protocol) ||
    (process.env.NODE_ENV === "production" && isPrivateHostname(parsedUrl.hostname))
  ) {
    return res.status(400).json({
      success: false,
      code: "INVALID_R2_PUBLIC_URL",
      message: "publicUrl R2 không hợp lệ",
    });
  }

  if (!Number.isFinite(size) || size <= 0 || size > MAX_UPLOAD_BYTES) {
    return res.status(413).json({
      success: false,
      code: "INVALID_MEDIA_SIZE",
      message: "Dung lượng media không hợp lệ hoặc vượt quá 20 MB",
    });
  }

  if (String(path).length > 1024 || String(publicUrl).length > 2048) {
    return res.status(400).json({
      success: false,
      code: "R2_MEDIA_INFO_TOO_LONG",
      message: "Thông tin file R2 quá dài",
    });
  }

  return next();
}

module.exports = { validateUploadPayload, isPrivateHostname };
