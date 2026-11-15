const os = require("os");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { logError } = require("../../utils/logEventUtils");
const { getTodayFolder } = require("../../utils/getTodayFolder");

const MAX_R2_DOWNLOAD_BYTES = 20 * 1024 * 1024;

function createR2DownloadError(message, code, status = 502, data) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  if (data) error.data = data;
  return error;
}

function validateDownloadedMedia({
  buffer,
  expectedSize,
  mediaType,
  contentType,
  maxBytes = MAX_R2_DOWNLOAD_BYTES,
}) {
  const actualSize = buffer?.length || 0;
  const declaredSize = Number(expectedSize || 0);
  const normalizedContentType = String(contentType || "").toLowerCase();

  if (!actualSize || actualSize > maxBytes) {
    throw createR2DownloadError(
      "File R2 trống hoặc vượt quá giới hạn 20 MB",
      "R2_MEDIA_SIZE_INVALID",
      413,
      { actualSize, maxBytes },
    );
  }

  if (declaredSize > 0 && declaredSize !== actualSize) {
    throw createR2DownloadError(
      "Dung lượng file R2 không khớp với dữ liệu upload",
      "R2_MEDIA_SIZE_MISMATCH",
      409,
      { expectedSize: declaredSize, actualSize },
    );
  }

  const isOppositeMedia =
    (mediaType === "image" && normalizedContentType.startsWith("video/")) ||
    (mediaType === "video" && normalizedContentType.startsWith("image/"));
  if (isOppositeMedia) {
    throw createR2DownloadError(
      "Định dạng file R2 không khớp với loại media",
      "R2_MEDIA_TYPE_MISMATCH",
      415,
      { mediaType, contentType: normalizedContentType },
    );
  }

  return { actualSize, contentType: normalizedContentType || null };
}

const downloadMediaOnStorage = async (
  url,
  mediaType = "image",
  filename = "temp",
  { expectedSize, maxBytes = MAX_R2_DOWNLOAD_BYTES } = {},
) => {
  try {
    const tmpBaseDir = path.join(os.tmpdir(), "downloads-media");
    const downloadDir =
      mediaType === "image"
        ? path.join(tmpBaseDir, getTodayFolder(), "images")
        : path.join(tmpBaseDir, getTodayFolder(), "videos");
    fs.mkdirSync(downloadDir, { recursive: true });

    const ext = mediaType === "image" ? ".webp" : ".mp4";
    let safeName = path
      .basename(String(filename || "temp"))
      .replace(/[^A-Za-z0-9._-]/g, "_");
    if (!safeName.endsWith(ext)) safeName += ext;
    const downloadPath = path.join(downloadDir, safeName);

    const response = await axios({
      url,
      method: "GET",
      responseType: "arraybuffer",
      timeout: 30_000,
      maxContentLength: maxBytes,
      maxBodyLength: maxBytes,
    });

    const buffer = Buffer.from(response.data);
    const verification = validateDownloadedMedia({
      buffer,
      expectedSize,
      mediaType,
      contentType: response.headers?.["content-type"],
      maxBytes,
    });
    fs.writeFileSync(downloadPath, buffer);

    return { buffer, path: downloadPath, ...verification };
  } catch (err) {
    logError(
      "downloadMediaOnStorage",
      `R2 download failed: ${err.code || err.message}`,
    );
    if (String(err.code || "").startsWith("R2_")) throw err;
    throw createR2DownloadError(
      "Không thể tải file từ R2",
      err.response?.status === 404 ? "R2_MEDIA_NOT_FOUND" : "R2_DOWNLOAD_FAILED",
      err.response?.status === 404 ? 404 : 502,
      { upstreamStatus: err.response?.status || null },
    );
  }
};

module.exports = {
  downloadMediaOnStorage,
  validateDownloadedMedia,
  MAX_R2_DOWNLOAD_BYTES,
};
