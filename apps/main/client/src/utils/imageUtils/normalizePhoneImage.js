import { MAX_IMAGE_UPLOAD_MB } from "../../config/uploadLimits.js";

const MB = 1024 * 1024;
const HEADER_BYTES = 128 * 1024;
const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "jpe",
  "png",
  "webp",
  "gif",
  "heic",
  "heif",
  "avif",
  "bmp",
  "tif",
  "tiff",
]);
const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "m4v", "webm", "3gp", "3g2"]);
const MIME_FORMATS = {
  "image/jpeg": "jpeg",
  "image/jpg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/avif": "avif",
  "image/bmp": "bmp",
  "image/tiff": "tiff",
};

export class PhoneImageError extends Error {
  constructor(code, message, cause) {
    super(message, cause ? { cause } : undefined);
    this.name = "PhoneImageError";
    this.code = code;
  }
}

const fileExtension = (file) =>
  String(file?.name || "")
    .toLowerCase()
    .match(/\.([a-z0-9]+)$/)?.[1] || "";
const ascii = (bytes, start, length) =>
  String.fromCharCode(...bytes.subarray(start, start + length));
const hasBytes = (bytes, expected, offset = 0) =>
  expected.every((value, index) => bytes[offset + index] === value);

export const classifyPhoneMedia = (file) => {
  const mime = String(file?.type || "").toLowerCase();
  const extension = fileExtension(file);
  if (MIME_FORMATS[mime] || IMAGE_EXTENSIONS.has(extension)) return "image";
  if (mime.startsWith("video/") || VIDEO_EXTENSIONS.has(extension)) return "video";
  return null;
};

export const detectPhoneImageFormat = async (file) => {
  if (!file?.slice || !file?.arrayBuffer) return null;
  let bytes = new Uint8Array();
  try {
    bytes = new Uint8Array(
      await file
        .slice(0, Math.min(Number(file.size) || HEADER_BYTES, HEADER_BYTES))
        .arrayBuffer(),
    );
  } catch {
    // MIME/name fallback below still produces a useful validation result.
  }

  if (bytes.length >= 3 && hasBytes(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (
    bytes.length >= 8 &&
    hasBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  ) return "png";
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return "webp";
  }
  if (bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(ascii(bytes, 0, 6))) {
    return "gif";
  }
  if (bytes.length >= 16 && ascii(bytes, 4, 4) === "ftyp") {
    const brands = ascii(bytes, 8, Math.min(bytes.length - 8, 64)).toLowerCase();
    if (/avif|avis/.test(brands)) return "avif";
    if (/heic|heix|hevc|hevx|heim|heis/.test(brands)) return "heic";
    if (/mif1|msf1/.test(brands)) return "heif";
  }

  return MIME_FORMATS[String(file.type || "").toLowerCase()] || {
    jpg: "jpeg",
    jpeg: "jpeg",
    jpe: "jpeg",
    png: "png",
    webp: "webp",
    gif: "gif",
    heic: "heic",
    heif: "heif",
    avif: "avif",
    bmp: "bmp",
    tif: "tiff",
    tiff: "tiff",
  }[fileExtension(file)] || null;
};

const read16 = (view, offset, littleEndian) =>
  offset >= 0 && offset + 2 <= view.byteLength
    ? view.getUint16(offset, littleEndian)
    : null;
const read32 = (view, offset, littleEndian) =>
  offset >= 0 && offset + 4 <= view.byteLength
    ? view.getUint32(offset, littleEndian)
    : null;

export const parseJpegExifOrientation = (input) => {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input || 0);
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return 1;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) break;
    const marker = bytes[offset + 1];
    offset += 2;
    if (marker === 0xd9 || marker === 0xda) break;
    const segmentLength = view.getUint16(offset, false);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) break;
    const payload = offset + 2;
    if (marker === 0xe1 && ascii(bytes, payload, 6) === "Exif\0\0") {
      const tiff = payload + 6;
      const byteOrder = ascii(bytes, tiff, 2);
      const littleEndian = byteOrder === "II";
      if (!littleEndian && byteOrder !== "MM") return 1;
      if (read16(view, tiff + 2, littleEndian) !== 42) return 1;
      const ifdOffset = read32(view, tiff + 4, littleEndian);
      const ifd = ifdOffset === null ? -1 : tiff + ifdOffset;
      const count = read16(view, ifd, littleEndian);
      if (count === null) return 1;
      for (let index = 0; index < count; index += 1) {
        const entry = ifd + 2 + index * 12;
        if (entry + 12 > bytes.length) break;
        if (read16(view, entry, littleEndian) !== 0x0112) continue;
        const value = read16(view, entry + 8, littleEndian);
        return value >= 1 && value <= 8 ? value : 1;
      }
      return 1;
    }
    offset += segmentLength;
  }
  return 1;
};

const decodeNativeImage = async (blob) => {
  if (typeof createImageBitmap === "function") {
    try {
      return {
        source: await createImageBitmap(blob, { imageOrientation: "from-image" }),
        objectUrl: null,
      };
    } catch {
      // Older WebKit falls through to HTMLImageElement.
    }
  }
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.style.imageOrientation = "from-image";
    image.onload = () => resolve({ source: image, objectUrl });
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("image decode failed"));
    };
    image.src = objectUrl;
  });
};

const decodeHeicImage = async (file) => {
  try {
    return await decodeNativeImage(file);
  } catch (nativeError) {
    try {
      const { heicTo } = await import("heic-to/csp");
      const converted = await heicTo({
        blob: file,
        type: "image/jpeg",
        quality: 0.95,
      });
      const blob = Array.isArray(converted) ? converted[0] : converted;
      if (!blob) throw new Error("HEIC conversion returned no pixels");
      return decodeNativeImage(blob);
    } catch (cause) {
      throw new PhoneImageError(
        "HEIC_DECODE_FAILED",
        "Không đọc được ảnh HEIC/HEIF này. Hãy thử xuất ảnh tương thích từ iPhone.",
        cause || nativeError,
      );
    }
  }
};

const canvasToBlob = (canvas, type, quality) =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new PhoneImageError("IMAGE_ENCODE_FAILED", "Không mã hóa được ảnh.")),
      type,
      quality,
    );
  });

export const normalizePhoneImage = async (file, options = {}) => {
  if (!file) throw new PhoneImageError("IMAGE_MISSING", "Thiếu file ảnh.");
  const maxInputBytes =
    Number(options.maxInputBytes) || MAX_IMAGE_UPLOAD_MB * MB;
  if (Number(file.size) > maxInputBytes) {
    throw new PhoneImageError(
      "IMAGE_TOO_LARGE",
      `Ảnh vượt quá giới hạn ${Math.round(maxInputBytes / MB)} MB.`,
    );
  }
  const format = await detectPhoneImageFormat(file);
  if (!format) {
    throw new PhoneImageError(
      "IMAGE_FORMAT_UNSUPPORTED",
      "Định dạng ảnh này chưa được hỗ trợ.",
    );
  }

  let decoded;
  try {
    decoded = ["heic", "heif"].includes(format)
      ? await decodeHeicImage(file)
      : await decodeNativeImage(file);
    const source = decoded.source;
    const sourceWidth = Number(source.naturalWidth || source.width || 0);
    const sourceHeight = Number(source.naturalHeight || source.height || 0);
    if (sourceWidth < 2 || sourceHeight < 2) {
      throw new PhoneImageError("IMAGE_DIMENSIONS_INVALID", "Ảnh không có kích thước hợp lệ.");
    }
    const maxEdge = Math.max(256, Number(options.maxEdge) || 2048);
    const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new PhoneImageError("CANVAS_UNAVAILABLE", "Không tạo được canvas ảnh.");
    context.fillStyle = "#000000";
    context.fillRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(source, 0, 0, width, height);
    const quality = Math.min(1, Math.max(0.65, Number(options.quality) || 0.94));
    let blob = await canvasToBlob(canvas, "image/jpeg", quality);
    if (blob.size > maxInputBytes) {
      blob = await canvasToBlob(canvas, "image/jpeg", 0.8);
    }
    if (blob.size > maxInputBytes) {
      throw new PhoneImageError(
        "NORMALIZED_IMAGE_TOO_LARGE",
        `Ảnh sau xử lý vẫn vượt ${Math.round(maxInputBytes / MB)} MB.`,
      );
    }
    const stem = String(file.name || `t97-${Date.now()}`)
      .replace(/\.[^.]+$/i, "")
      .trim();
    return new File([blob], `${stem || `t97-${Date.now()}`}.jpg`, {
      type: "image/jpeg",
      lastModified: Number(file.lastModified) || Date.now(),
    });
  } catch (error) {
    if (error instanceof PhoneImageError) throw error;
    throw new PhoneImageError(
      "IMAGE_DECODE_FAILED",
      "Không đọc được ảnh này trên thiết bị.",
      error,
    );
  } finally {
    decoded?.source?.close?.();
    if (decoded?.objectUrl) URL.revokeObjectURL(decoded.objectUrl);
  }
};
