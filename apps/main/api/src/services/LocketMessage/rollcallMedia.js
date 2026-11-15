const axios = require("axios");
const heicConvert = require("heic-convert");
const { sniffRollcallMediaType } = require("../../utils/rollcallMediaType");

const MAX_ROLLCALL_MEDIA_BYTES = 25 * 1024 * 1024;
const ALLOWED_MEDIA_HOSTS = new Set([
  "firebasestorage.googleapis.com",
  "storage.googleapis.com",
  "cdn.locketcamera.com",
]);

function createRollcallMediaError(message, code, status = 502) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function normalizeRollcallMediaUrl(value) {
  let url;
  try {
    url = new URL(String(value || ""));
  } catch {
    throw createRollcallMediaError(
      "Đường dẫn media Rollcall không hợp lệ.",
      "ROLLCALL_MEDIA_URL_INVALID",
      400,
    );
  }

  if (url.protocol !== "https:" || !ALLOWED_MEDIA_HOSTS.has(url.hostname)) {
    throw createRollcallMediaError(
      "Nguồn media Rollcall không được hỗ trợ.",
      "ROLLCALL_MEDIA_HOST_BLOCKED",
      400,
    );
  }

  return url.toString();
}

async function getRollcallMedia(url) {
  const safeUrl = normalizeRollcallMediaUrl(url);
  let response;

  try {
    response = await axios.get(safeUrl, {
      responseType: "arraybuffer",
      timeout: 30_000,
      maxContentLength: MAX_ROLLCALL_MEDIA_BYTES,
      maxBodyLength: MAX_ROLLCALL_MEDIA_BYTES,
      maxRedirects: 0,
      headers: {
        Accept: "image/*,video/*;q=0.9,*/*;q=0.1",
        "User-Agent": "Locket/1746 CFNetwork/3860.200.71 Darwin/25.1.0",
      },
    });
  } catch (error) {
    const upstreamStatus = Number(error?.response?.status || 0);
    throw createRollcallMediaError(
      upstreamStatus === 404
        ? "Media Rollcall không còn tồn tại."
        : "Không tải được media Rollcall từ Locket.",
      upstreamStatus === 404
        ? "ROLLCALL_MEDIA_NOT_FOUND"
        : "ROLLCALL_MEDIA_FETCH_FAILED",
      upstreamStatus === 404 ? 404 : 502,
    );
  }

  let buffer = Buffer.from(response.data || []);
  if (!buffer.length || buffer.length > MAX_ROLLCALL_MEDIA_BYTES) {
    throw createRollcallMediaError(
      "Media Rollcall trống hoặc quá lớn.",
      "ROLLCALL_MEDIA_SIZE_INVALID",
      413,
    );
  }

  let contentType = sniffRollcallMediaType(
    buffer,
    response.headers?.["content-type"],
  );
  if (!contentType) {
    throw createRollcallMediaError(
      "Locket trả về dữ liệu không phải media.",
      "ROLLCALL_MEDIA_TYPE_INVALID",
      415,
    );
  }

  if (contentType === "image/heic") {
    try {
      buffer = Buffer.from(
        await heicConvert({ buffer, format: "JPEG", quality: 0.9 }),
      );
      contentType = "image/jpeg";
    } catch {
      throw createRollcallMediaError(
        "Không chuyển đổi được ảnh HEIC của Rollcall.",
        "ROLLCALL_HEIC_CONVERSION_FAILED",
        422,
      );
    }
  }

  return { buffer, contentType };
}

module.exports = {
  ALLOWED_MEDIA_HOSTS,
  MAX_ROLLCALL_MEDIA_BYTES,
  getRollcallMedia,
  normalizeRollcallMediaUrl,
};
