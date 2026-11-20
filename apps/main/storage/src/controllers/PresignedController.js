const {
  getS3Client,
  PutObjectCommand,
  getSignedUrl,
} = require("../../config/r2-storage");
const { getStorageConfig, StorageConfigurationError } = require("../../config/storage-env");
const { getTodayFolder } = require("../utils/getDayFolder");
const { logSuccess, logInfo, logWarning } = require("../utils/logEventUtils");

const ALLOWED_MIME_TYPES = [
  // images
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",

  // videos
  "video/mp4",
  "video/webm",
  "video/quicktime", // mov
];
//API chuẩn V3
exports.generatePresignedUrlV3 = async (req, res) => {
  const { filename, contentType, type } = req.body || {};

  const { uid } = req.user;

  if (typeof filename !== "string" || !filename || typeof type !== "string" || !type) {
    return res.status(400).json({
      status: "error",
      message: "Request body must include 'filename' and 'type'",
      errorCode: "MISSING_BODY_FIELDS",
    });
  }

  // 1️⃣ check mime (chuẩn hoá loại bỏ tham số codecs=...)
  const normalizedContentType = String(contentType || "")
    .split(";")[0]
    .trim()
    .toLowerCase();

  if (!ALLOWED_MIME_TYPES.includes(normalizedContentType)) {
    return res.status(400).json({
      status: "error",
      message: "File type not allowed",
      errorCode: "INVALID_FILE_TYPE",
      allowed: ALLOWED_MIME_TYPES,
    });
  }

  // 3️⃣ ép type theo mime (chống fake type)
  const safeType = normalizedContentType.startsWith("video/") ? "video" : "image";

  logInfo("generatePresignedUrlV2", `📩 Yêu cầu tạo URL cho: ${filename}`);

  const folderName = getTodayFolder();
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "");
  if (!safeFilename || safeFilename === "." || safeFilename === "..") {
    return res.status(400).json({ error: "Invalid filename" });
  }
  const filePath = `LocketCloud/${folderName}/${safeType}/${uid}/${safeFilename}`; // => path trên R2

  try {
    const config = getStorageConfig();
    // 2️⃣ nếu chưa tồn tại thì mới generate URL
    const command = new PutObjectCommand({
      Bucket: config.bucket,
      Key: filePath,
      ContentType: normalizedContentType,
    });

    const url = await getSignedUrl(getS3Client(), command, { expiresIn: 300 });

    logSuccess("GeneratedPresignedUrlV2", "✅ URL thành công", filePath);

    return res.status(200).json({
      status: "success",
      data: {
        url,
        expiresIn: 300, // 5 phút
        key: filePath,
        publicURL: `${config.mediaUrl}/${filePath}`,
      },
      message: "Presigned URL generated successfully",
      meta: {
        note: "This upload URL expires in 5 minutes.",
        uk: "null because this is not a user-specific action",
        me: "u not admin",
        u: uid,
      },
    });
  } catch (err) {
    if (err instanceof StorageConfigurationError) {
      return res.status(503).json({ status: "error", errorCode: err.code, message: err.message });
    }
    console.error("❌ Presigned V2 error:", err.name);

    return res.status(500).json({
      status: "error",
      message: "Failed to generate presigned URL",
      errorCode: "INTERNAL_ERROR",
    });
  }
};
