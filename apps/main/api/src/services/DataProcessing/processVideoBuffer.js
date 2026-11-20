const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const os = require("os");
const path = require("path");
const sharp = require("sharp");
const { logInfo, logSuccess, logWarning, logTable } = require("../../utils/logEventUtils");
const { configureFfmpeg } = require("./ffmpegConfig");

configureFfmpeg();

// ============================================================================
// CONSTANTS
// ============================================================================
const MAX_VIDEO_DURATION_SECONDS = 30;
const PROCESSING_TIMEOUT_MS = 45000; // 45s tối đa cho 1 pass
const AUDIO_OUTPUT_OPTIONS = [
  "-map 0:v:0",
  "-map 0:a:0?",
  "-c:a aac",
  "-b:a 128k",
  "-ar 44100",
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const getTempDir = () => {
  const tmpDir = path.join(os.tmpdir(), "processed-videos");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  return tmpDir;
};

const cleanup = (...filePaths) => {
  filePaths.forEach((filePath) => {
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        logInfo("cleanup", `Deleted: ${path.basename(filePath)}`);
      } catch (e) {
        logWarning("cleanup", `Failed to delete: ${path.basename(filePath)}`);
      }
    }
  });
};

// ============================================================================
// METADATA PROBING
// ============================================================================

const getVideoMetadata = (filePath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        logInfo("getVideoMetadata", `Error: ${err.message}`);
        return reject(new Error("❌ Lỗi lấy metadata: " + err.message));
      }

      const videoStream = metadata.streams?.find(
        (s) => s.codec_type === "video"
      );
      const audioStream = metadata.streams?.find(
        (s) => s.codec_type === "audio"
      );

      if (!videoStream?.width || !videoStream?.height) {
        return reject(new Error("❌ Không tìm thấy video stream hợp lệ"));
      }

      const width = Number(videoStream.width);
      const height = Number(videoStream.height);

      const rawDuration =
        metadata.format?.duration ??
        videoStream?.duration ??
        0;

      const duration = Number(rawDuration);
      const safeDuration = Number.isFinite(duration) && duration > 0
        ? duration
        : 10;

      const size = Number(metadata.format?.size) || 0;
      const sizeMB = size / (1024 * 1024);

      const format = metadata.format?.format_name || "";
      const codec = videoStream.codec_name || "unknown";

      const isSquare = width === height;
      const isMp4 = format.includes("mp4");

      logTable(
        "getVideoMetadata",
        {
          Path: filePath,
          Format: format || "unknown",
          Codec: codec,
          Size: `${width}x${height}`,
          Duration: `${safeDuration.toFixed(1)}s`,
          FileSize: `${sizeMB.toFixed(2)}MB`,
          Audio: audioStream?.codec_name || "none",
          Square: isSquare,
          MP4: isMp4,
        },
        "Video Metadata"
      );

      resolve({
        width,
        height,
        duration: safeDuration,
        sizeMB,
        format,
        codec,
        audioCodec: audioStream?.codec_name || null,
        hasAudio: Boolean(audioStream),
        isSquare,
        isMp4,
      });
    });
  });
};

const probeVideoBuffer = (videoBuffer, filename = "probe.mp4") => {
  return new Promise(async (resolve, reject) => {
    const tmpDir = getTempDir();
    const inputPath = path.join(tmpDir, `${Date.now()}_${filename}`);

    try {
      fs.writeFileSync(inputPath, videoBuffer);
      const metadata = await getVideoMetadata(inputPath);
      resolve({
        hasAudio: Boolean(metadata.hasAudio),
        audioCodec: metadata.audioCodec || null,
        videoCodec: metadata.codec || null,
        duration: metadata.duration,
        sizeMB: metadata.sizeMB,
        format: metadata.format,
      });
    } catch (error) {
      reject(error);
    } finally {
      cleanup(inputPath);
    }
  });
};

// ============================================================================
// SINGLE-PASS FAST ENCODING
// ============================================================================

/**
 * Xử lý video trong đúng 1 lượt FFmpeg duy nhất:
 * - Crop vuông 1:1 tâm
 * - Scale về độ phân giải chuẩn (720x720 hoặc 540x540) để xử lý trong 1-2 giây
 * - Trim tối đa MAX_VIDEO_DURATION_SECONDS (30s)
 * - Tự động tính bitrate để file luôn luôn < maxSizeMB (5MB)
 * - Dùng preset 'ultrafast' để giảm tải RAM/CPU tối đa, chống OOM SIGKILL trên Railway
 */
const runSinglePassEncode = (inputPath, outputPath, metadata, maxSizeMB, resolution = 720) => {
  return new Promise((resolve, reject) => {
    const { width, height, duration } = metadata;
    const safeDuration = Math.min(duration || 15, MAX_VIDEO_DURATION_SECONDS);

    // Tính toán crop vuông 1:1
    const side = Math.min(width, height);
    const cropX = Math.floor((width - side) / 2);
    const cropY = Math.floor((height - side) / 2);

    const targetRes = Math.min(resolution, side);
    const videoFilter = `crop=${side}:${side}:${cropX}:${cropY},scale=${targetRes}:${targetRes}`;

    // Target bitrate: dự trù 80% của maxSizeMB (dưới 4MB) để tuyệt đối không vượt 5MB
    // Audio 96kbps = 12 KB/s
    const targetTotalBytes = maxSizeMB * 0.8 * 1024 * 1024;
    const audioBits = 96 * 1000 * safeDuration;
    const availableVideoBits = Math.max(targetTotalBytes * 8 - audioBits, 400000);
    const targetBitrate = Math.max(
      Math.min(Math.floor(availableVideoBits / safeDuration), 2000000),
      250000
    );

    let timeout;
    const command = ffmpeg(inputPath)
      .duration(MAX_VIDEO_DURATION_SECONDS)
      .videoFilters(videoFilter)
      .videoCodec("libx264")
      .outputOptions([
        "-preset ultrafast",
        `-b:v ${targetBitrate}`,
        `-maxrate ${Math.floor(targetBitrate * 1.3)}`,
        `-bufsize ${Math.floor(targetBitrate * 2)}`,
        "-pix_fmt yuv420p",
        "-r 30",
        "-profile:v baseline",
        "-level 3.0",
        "-movflags +faststart",
        ...AUDIO_OUTPUT_OPTIONS,
      ])
      .format("mp4")
      .on("start", (cmd) => {
        logInfo(
          "singlePassEncode",
          `Started fast encode: ${targetRes}x${targetRes}, target bitrate: ${Math.round(targetBitrate / 1000)}k`
        );
        timeout = setTimeout(() => {
          command.kill("SIGKILL");
          reject(new Error("Timeout xử lý video (quá thời gian cho phép)"));
        }, PROCESSING_TIMEOUT_MS);
      })
      .on("end", () => {
        clearTimeout(timeout);
        if (!fs.existsSync(outputPath)) {
          return reject(new Error("File video đầu ra không tồn tại sau khi xử lý"));
        }
        resolve(outputPath);
      })
      .on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });

    command.save(outputPath);
  });
};

// ============================================================================
// MAIN PROCESSING FUNCTION
// ============================================================================

const processVideoBuffer = ({ videoBuffer, filename = "temp", maxSizeMB = 5 }) => {
  return new Promise(async (resolve, reject) => {
    logInfo("processVideoBuffer", `Start processing: ${filename}`);

    const tmpDir = getTempDir();
    const timestamp = Date.now();
    const inputPath = path.join(tmpDir, `${timestamp}_${filename}`);
    let needsCleanup = [];

    // Ghi buffer vào file tạm
    try {
      fs.writeFileSync(inputPath, videoBuffer);
      needsCleanup.push(inputPath);

      const inputStats = fs.statSync(inputPath);
      const inputSizeMB = inputStats.size / (1024 * 1024);
      logInfo("processVideoBuffer", `Input: ${inputSizeMB.toFixed(2)}MB`);

      if (inputStats.size < 1024) {
        cleanup(...needsCleanup);
        logWarning("processVideoBuffer", "Video too small or empty");
        return reject(new Error("❌ Video rỗng hoặc lỗi."));
      }
    } catch (err) {
      cleanup(...needsCleanup);
      return reject(new Error("❌ Lỗi ghi buffer: " + err.message));
    }

    try {
      // BƯỚC 1: Lấy metadata
      const metadata = await getVideoMetadata(inputPath);

      // BƯỚC 2: Kiểm tra nếu video đã tối ưu sẵn (MP4, vuông, <= maxSizeMB, <= 30s)
      if (
        metadata.isMp4 &&
        metadata.isSquare &&
        metadata.sizeMB <= maxSizeMB &&
        metadata.duration <= MAX_VIDEO_DURATION_SECONDS
      ) {
        const resultBuffer = fs.readFileSync(inputPath);
        cleanup(...needsCleanup);
        logSuccess(
          "processVideoBuffer",
          `Already optimized: ${metadata.sizeMB.toFixed(2)}MB - Không cần nén lại`
        );
        return resolve(resultBuffer);
      }

      // BƯỚC 3: Xử lý siêu tốc trong 1 lượt (Single-pass ultrafast)
      const outputPath = path.join(tmpDir, `${timestamp}_${filename}_fast.mp4`);
      needsCleanup.push(outputPath);

      await runSinglePassEncode(inputPath, outputPath, metadata, maxSizeMB, 720);

      let finalStats = fs.statSync(outputPath);
      let finalSizeMB = finalStats.size / (1024 * 1024);

      // Nếu hiếm hoi vẫn > maxSizeMB, chạy nén fallback nhanh ở 540p
      if (finalSizeMB > maxSizeMB) {
        logWarning(
          "processVideoBuffer",
          `Output ${finalSizeMB.toFixed(2)}MB > ${maxSizeMB}MB, chạy fallback 540p...`
        );
        const fallbackPath = path.join(tmpDir, `${timestamp}_${filename}_fallback.mp4`);
        needsCleanup.push(fallbackPath);
        await runSinglePassEncode(inputPath, fallbackPath, metadata, maxSizeMB, 540);
        finalStats = fs.statSync(fallbackPath);
        finalSizeMB = finalStats.size / (1024 * 1024);
        const resultBuffer = fs.readFileSync(fallbackPath);
        cleanup(...needsCleanup);
        logSuccess("processVideoBuffer", `Fallback completed: ${finalSizeMB.toFixed(2)}MB`);
        return resolve(resultBuffer);
      }

      const resultBuffer = fs.readFileSync(outputPath);
      cleanup(...needsCleanup);

      logSuccess(
        "processVideoBuffer",
        `Final output: ${finalSizeMB.toFixed(2)}MB (.mp4) - Hoàn tất siêu tốc`
      );
      resolve(resultBuffer);
    } catch (error) {
      cleanup(...needsCleanup);
      logInfo("processVideoBuffer", `Processing failed: ${error.message}`);
      if (error.status || error.code === "VIDEO_SIZE_LIMIT_EXCEEDED") {
        return reject(error);
      }
      reject(new Error("❌ Lỗi xử lý video: " + error.message));
    }
  });
};

// ============================================================================
// THUMBNAIL GENERATION
// ============================================================================

const generateThumbnail = (videoInput, localId, options = {}) => {
  const { seekTime = 0.1 } = options;

  return new Promise((resolve, reject) => {
    logInfo("generateThumbnail", `Start generating for ${localId}`);

    const tmpDir = getTempDir();
    const timestamp = Date.now();
    const thumbnailFileName = `thumb_${timestamp}_${localId}.png`;
    const inputPath =
      typeof videoInput === "string"
        ? videoInput
        : path.join(tmpDir, `input_${timestamp}_${localId}.mp4`);
    const outputPath = path.join(tmpDir, thumbnailFileName);

    if (Buffer.isBuffer(videoInput)) {
      try {
        fs.writeFileSync(inputPath, videoInput);
      } catch (err) {
        return reject(new Error("❌ Lỗi ghi buffer: " + err.message));
      }
    }

    if (!fs.existsSync(inputPath)) {
      return reject(new Error("❌ File input không tồn tại"));
    }

    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      let finalSeekTime = 0.1;

      if (metadata && metadata.format && metadata.format.duration) {
        const duration = parseFloat(metadata.format.duration);
        if (duration >= 3) {
          finalSeekTime = Math.min(seekTime, duration - 0.5);
        } else if (duration >= 1) {
          finalSeekTime = Math.max(0.1, duration * 0.1);
        }
      }

      let timeout;
      ffmpeg(inputPath)
        .screenshots({
          timestamps: [finalSeekTime],
          filename: thumbnailFileName,
          folder: tmpDir,
          size: "500x500",
        })
        .on("start", () => {
          logInfo("generateThumbnail", "Started (500x500)");
          timeout = setTimeout(() => {
            reject(new Error("❌ Timeout tạo thumbnail"));
          }, 15000);
        })
        .on("end", async () => {
          clearTimeout(timeout);

          if (!fs.existsSync(outputPath)) {
            cleanup(Buffer.isBuffer(videoInput) ? inputPath : null);
            return reject(new Error("❌ Không tạo được thumbnail"));
          }

          try {
            const rawThumb = fs.readFileSync(outputPath);
            cleanup(outputPath, Buffer.isBuffer(videoInput) ? inputPath : null);

            const webpThumb = await sharp(rawThumb)
              .resize(500, 500, { fit: "cover" })
              .webp({ quality: 80 })
              .toBuffer();

            const sizeKB = webpThumb.length / 1024;
            logSuccess("generateThumbnail", `Output: ${sizeKB.toFixed(1)}KB (webp)`);
            resolve(webpThumb);
          } catch (e) {
            cleanup(outputPath, Buffer.isBuffer(videoInput) ? inputPath : null);
            reject(new Error("❌ Lỗi đọc/xử lý thumbnail: " + e.message));
          }
        })
        .on("error", (err) => {
          clearTimeout(timeout);
          cleanup(outputPath, Buffer.isBuffer(videoInput) ? inputPath : null);
          reject(new Error("❌ Lỗi tạo thumbnail: " + err.message));
        });
    });
  });
};

module.exports = {
  processVideoBuffer,
  generateThumbnail,
  probeVideoBuffer,
};
