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
const MAX_COMPRESSION_ATTEMPTS = 10; // Giới hạn 10 lần thử
const COMPRESSION_TIMEOUT = 60000; // 60s
const EMERGENCY_TIMEOUT = 30000; // Timeout cho emergency mode
const MAX_VIDEO_DURATION_SECONDS = 30;
const AUDIO_OUTPUT_OPTIONS = [
  "-map 0:v:0",
  "-map 0:a:0?",
  "-c:a aac",
  "-b:a 96k",
  "-ac 1",
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

const calculateCenterCrop = (width, height) => {
  const side = Math.min(width, height);
  const cropX = Math.floor((width - side) / 2);
  const cropY = Math.floor((height - side) / 2);
  
  const safeCropX = Math.max(0, Math.min(cropX, width - side));
  const safeCropY = Math.max(0, Math.min(cropY, height - side));
  
  logInfo("calculateCenterCrop", 
    `${width}x${height} → ${side}x${side} at (${safeCropX}, ${safeCropY})`
  );
  
  return { width: side, height: side, x: safeCropX, y: safeCropY };
};

// ============================================================================
// STEP 1: GET VIDEO METADATA
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

      // ✅ Normalize numbers
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
// STEP 2: CHECK IF PROCESSING NEEDED
// ============================================================================

const needsProcessing = (metadata, maxSizeMB) => {
  const { isSquare, isMp4, sizeMB, duration } = metadata;

  if (duration > MAX_VIDEO_DURATION_SECONDS) {
    logInfo("needsProcessing", "Trim needed - video is longer than 15s");
    return { needed: true, reason: "needs_trim" };
  }

  if (isMp4 && isSquare && sizeMB <= maxSizeMB) {
    logInfo("needsProcessing", "No processing needed - already optimized");
    return { needed: false, reason: "already_optimized" };
  }

  if (isMp4 && isSquare && sizeMB > maxSizeMB) {
    logInfo("needsProcessing", "Compression needed - file too large");
    return { needed: true, reason: "needs_compression" };
  }

  if (isMp4 && !isSquare) {
    logInfo("needsProcessing", "Crop needed - not square");
    return { needed: true, reason: "needs_crop" };
  }

  if (!isMp4) {
    logInfo("needsProcessing", "Format conversion needed");
    return { needed: true, reason: "needs_conversion" };
  }

  return { needed: true, reason: "needs_processing" };
};

const trimVideo = (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    logInfo("trimVideo", `Trimming to ${MAX_VIDEO_DURATION_SECONDS}s`);

    let timeout;
    const command = ffmpeg(inputPath)
      .inputOptions(["-threads 1"])
      .duration(MAX_VIDEO_DURATION_SECONDS)
      .videoCodec("libx264")
      .outputOptions([
        "-preset medium",
        "-movflags +faststart",
        "-pix_fmt yuv420p",
        "-r 30",
        ...AUDIO_OUTPUT_OPTIONS,
        "-profile:v baseline",
        "-level 3.0",
      ])
      .format("mp4")
      .on("start", () => {
        timeout = setTimeout(() => {
          command.kill("SIGKILL");
          reject(new Error("Trim timeout"));
        }, COMPRESSION_TIMEOUT);
      })
      .on("end", () => {
        clearTimeout(timeout);
        const stats = fs.statSync(outputPath);
        const sizeMB = stats.size / (1024 * 1024);
        logInfo("trimVideo", `Completed: ${sizeMB.toFixed(2)}MB`);
        resolve(outputPath);
      })
      .on("error", (err) => {
        clearTimeout(timeout);
        cleanup(outputPath);
        reject(err);
      });

    command.save(outputPath);
  });
};

// ============================================================================
// STEP 3: CROP TO SQUARE
// ============================================================================

const cropToSquare = (inputPath, outputPath, metadata) => {
  return new Promise((resolve, reject) => {
    const { width, height } = metadata;
    const cropParams = calculateCenterCrop(width, height);

    logInfo("cropToSquare", `Cropping to ${cropParams.width}x${cropParams.height}`);

    const videoFilters = [
      `crop=${cropParams.width}:${cropParams.height}:${cropParams.x}:${cropParams.y}`,
      "scale=1080:1080",
    ];

    let timeout;
    const command = ffmpeg(inputPath)
      .inputOptions(["-threads 1"])
      .videoFilters(videoFilters.join(","))
      .videoCodec("libx264")
      .outputOptions([
        "-preset medium",
        "-movflags +faststart",
        "-pix_fmt yuv420p",
        "-r 30",
        ...AUDIO_OUTPUT_OPTIONS,
        "-profile:v baseline",
        "-level 3.0",
      ])
      .format("mp4")
      .on("start", () => {
        logInfo("cropToSquare", "Started");
        timeout = setTimeout(() => {
          command.kill("SIGKILL");
          reject(new Error("Crop timeout"));
        }, COMPRESSION_TIMEOUT);
      })
      .on("end", () => {
        clearTimeout(timeout);
        const stats = fs.statSync(outputPath);
        const sizeMB = stats.size / (1024 * 1024);
        logInfo("cropToSquare", `Completed: ${sizeMB.toFixed(2)}MB`);
        resolve(outputPath);
      })
      .on("error", (err) => {
        clearTimeout(timeout);
        cleanup(outputPath);
        reject(err);
      });

    command.save(outputPath);
  });
};

// ============================================================================
// STEP 4: COMPRESS VIDEO (WITH LIMITED RECURSIVE COMPRESSION)
// ============================================================================

const getEffectiveDuration = (metadata) =>
  Math.min(metadata.duration || MAX_VIDEO_DURATION_SECONDS, MAX_VIDEO_DURATION_SECONDS);

const performSingleCompression = (inputPath, outputPath, metadata, finalBitrate) => {
  return new Promise((resolve, reject) => {
    const shouldTrim = metadata.duration > MAX_VIDEO_DURATION_SECONDS;
    const shouldDownscale = metadata.width > 1080 || metadata.height > 1080;
    const videoFilters = shouldDownscale ? ["scale=1080:1080"] : [];
    const outputOptions = [
      `-b:v ${finalBitrate}`,
      `-maxrate ${Math.floor(finalBitrate * 1.2)}`,
      `-bufsize ${Math.floor(finalBitrate * 2)}`,
      "-preset veryfast",
      "-movflags +faststart",
      "-pix_fmt yuv420p",
      "-r 30",
      ...AUDIO_OUTPUT_OPTIONS,
      "-profile:v baseline",
      "-level 3.0",
    ];

    let timeout;
    let command = ffmpeg(inputPath)
      .inputOptions(["-threads 1"])
      .videoCodec("libx264");

    if (videoFilters.length) {
      command = command.videoFilters(videoFilters.join(","));
    }

    if (shouldTrim) {
      command = command.duration(MAX_VIDEO_DURATION_SECONDS);
    }

    command
      .outputOptions(outputOptions)
      .format("mp4")
      .on("start", () => {
        logInfo(
          "compressVideo",
          `Started ffmpeg${shouldDownscale ? " with 1080x1080 downscale" : ""}`,
        );
        timeout = setTimeout(() => {
          command.kill("SIGKILL");
          reject(new Error("Compression timeout"));
        }, COMPRESSION_TIMEOUT);
      })
      .on("end", () => {
        clearTimeout(timeout);
        resolve(outputPath);
      })
      .on("error", (err) => {
        clearTimeout(timeout);
        cleanup(outputPath);
        reject(err);
      });

    command.save(outputPath);
  });
};

const compressVideoRecursive = async (
  inputPath, 
  tmpDir, 
  timestamp, 
  filename, 
  metadata, 
  maxSizeMB, 
  attempt = 1, 
  bitrateMultiplier = 0.8,
  previousAttempts = []
) => {
  const duration = getEffectiveDuration(metadata);
  
  // GIỚI HẠN: Chỉ cho phép 5 lần thử
  if (attempt > MAX_COMPRESSION_ATTEMPTS) {
    logWarning("compressVideo", 
      `Đã đạt giới hạn ${MAX_COMPRESSION_ATTEMPTS} lần nén. Dừng lại.`
    );
    
    // Cleanup tất cả các attempts trước
    cleanup(...previousAttempts);
    
    // Tìm file nhỏ nhất trong các attempts
    const lastPath = previousAttempts[previousAttempts.length - 1];
    if (lastPath && fs.existsSync(lastPath)) {
      const stats = fs.statSync(lastPath);
      const sizeMB = stats.size / (1024 * 1024);
      logWarning("compressVideo", 
        `Trả về kết quả tốt nhất: ${sizeMB.toFixed(2)}MB (có thể > ${maxSizeMB}MB)`
      );
      return { path: lastPath, sizeMB };
    }
    
    throw new Error(`Không thể nén video xuống dưới ${maxSizeMB}MB sau ${MAX_COMPRESSION_ATTEMPTS} lần thử`);
  }
  
  const baseBitrate = Math.floor((maxSizeMB * 8 * 1024 * 1024) / duration);
  const targetBitrate = Math.floor(baseBitrate * bitrateMultiplier);
  const finalBitrate = Math.max(targetBitrate, 100000);

  logInfo("compressVideo", 
    `Lần thử ${attempt}/${MAX_COMPRESSION_ATTEMPTS}, Bitrate: ${Math.round(finalBitrate/1000)}kbps, Multiplier: ${bitrateMultiplier.toFixed(2)}`
  );

  const outputPath = path.join(tmpDir, `${timestamp}_${filename}_compress_${attempt}.mp4`);

  try {
    await performSingleCompression(inputPath, outputPath, metadata, finalBitrate);
    
    const stats = fs.statSync(outputPath);
    const sizeMB = stats.size / (1024 * 1024);
    logInfo("compressVideo", `Lần thử ${attempt} kết quả: ${sizeMB.toFixed(2)}MB`);

    // Thành công: file <= maxSizeMB
    if (sizeMB <= maxSizeMB) {
      cleanup(...previousAttempts); // Cleanup các attempts trước
      logSuccess("compressVideo", 
        `Thành công ở lần thử ${attempt}/${MAX_COMPRESSION_ATTEMPTS}: ${sizeMB.toFixed(2)}MB`
      );
      return { path: outputPath, sizeMB };
    }

    // Còn quá lớn, thử lại với bitrate thấp hơn
    const newMultiplier = bitrateMultiplier * 0.7;
    return await compressVideoRecursive(
      inputPath, 
      tmpDir, 
      timestamp, 
      filename, 
      metadata, 
      maxSizeMB, 
      attempt + 1, 
      newMultiplier,
      [...previousAttempts, outputPath] // Track để cleanup sau
    );

  } catch (error) {
    cleanup(outputPath);
    logWarning("compressVideo", `Lần thử ${attempt} thất bại: ${error.message}`);
    
    // Nếu đã hết số lần thử, throw error
    if (attempt >= MAX_COMPRESSION_ATTEMPTS) {
      cleanup(...previousAttempts);
      throw new Error(
        `Không thể nén video sau ${MAX_COMPRESSION_ATTEMPTS} lần thử. Lỗi cuối: ${error.message}`
      );
    }
    
    // Còn lượt thử, giảm bitrate mạnh hơn và thử lại
    const newMultiplier = bitrateMultiplier * 0.6;
    return await compressVideoRecursive(
      inputPath, 
      tmpDir, 
      timestamp, 
      filename, 
      metadata, 
      maxSizeMB, 
      attempt + 1, 
      newMultiplier,
      previousAttempts
    );
  }
};

const compressVideo = async (inputPath, tmpDir, timestamp, filename, metadata, maxSizeMB) => {
  try {
    return await compressVideoRecursive(
      inputPath, 
      tmpDir, 
      timestamp, 
      filename, 
      metadata, 
      maxSizeMB
    );
  } catch (error) {
    // Nếu tất cả đều thất bại, log rõ ràng
    logWarning("compressVideo", 
      `Tất cả ${MAX_COMPRESSION_ATTEMPTS} lần nén đều thất bại hoặc không đạt ${maxSizeMB}MB`
    );
    throw error;
  }
};

// ============================================================================
// STEP 5: CONVERT FORMAT
// ============================================================================

const convertFormat = (inputPath, outputPath, metadata) => {
  return new Promise((resolve, reject) => {
    logInfo("convertFormat", "Converting to MP4");

    let timeout;
    const command = ffmpeg(inputPath)
      .inputOptions(["-threads 1"])
      .videoCodec("libx264")
      .outputOptions([
        "-preset medium",
        "-movflags +faststart",
        "-pix_fmt yuv420p",
        "-r 30",
        ...AUDIO_OUTPUT_OPTIONS,
        "-profile:v baseline",
        "-level 3.0",
      ])
      .format("mp4")
      .on("start", () => {
        timeout = setTimeout(() => {
          command.kill("SIGKILL");
          reject(new Error("Conversion timeout"));
        }, COMPRESSION_TIMEOUT);
      })
      .on("end", () => {
        clearTimeout(timeout);
        const stats = fs.statSync(outputPath);
        const sizeMB = stats.size / (1024 * 1024);
        logInfo("convertFormat", `Completed: ${sizeMB.toFixed(2)}MB`);
        resolve(outputPath);
      })
      .on("error", (err) => {
        clearTimeout(timeout);
        cleanup(outputPath);
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

    // Write buffer to temp file
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
      // STEP 1: Get metadata
      const metadata = await getVideoMetadata(inputPath);
      
      // STEP 2: Check if processing needed
      const processingCheck = needsProcessing(metadata, maxSizeMB);
      
      if (!processingCheck.needed) {
        const resultBuffer = fs.readFileSync(inputPath);
        cleanup(...needsCleanup);
        logSuccess("processVideoBuffer", 
          `Already optimized: ${metadata.sizeMB.toFixed(2)}MB - No processing needed`
        );
        return resolve(resultBuffer);
      }

      let currentPath = inputPath;

      // STEP 3: Convert format if needed
      if (!metadata.isMp4) {
        const convertedPath = path.join(tmpDir, `${timestamp}_${filename}_converted.mp4`);
        await convertFormat(currentPath, convertedPath, metadata);
        needsCleanup.push(convertedPath);
        currentPath = convertedPath;
        
        const newMetadata = await getVideoMetadata(currentPath);
        Object.assign(metadata, newMetadata);
      }

      // STEP 4: Crop to square if needed
      if (!metadata.isSquare) {
        const croppedPath = path.join(tmpDir, `${timestamp}_${filename}_cropped.mp4`);
        await cropToSquare(currentPath, croppedPath, metadata);
        needsCleanup.push(croppedPath);
        currentPath = croppedPath;
        
        const newMetadata = await getVideoMetadata(currentPath);
        Object.assign(metadata, newMetadata);
      }

      // STEP 5: Compress or trim if needed (GIỚ HẠN 5 LẦN)
      if (metadata.sizeMB > maxSizeMB || metadata.duration > MAX_VIDEO_DURATION_SECONDS) {
        try {
          const result = await compressVideo(
            currentPath, 
            tmpDir, 
            timestamp, 
            filename, 
            metadata, 
            maxSizeMB
          );
          needsCleanup.push(result.path);
          currentPath = result.path;
          
          // Cảnh báo nếu vẫn > maxSizeMB
          if (result.sizeMB > maxSizeMB) {
            logWarning("processVideoBuffer", 
              `Không thể nén xuống ${maxSizeMB}MB sau ${MAX_COMPRESSION_ATTEMPTS} lần. ` +
              `Kết quả: ${result.sizeMB.toFixed(2)}MB`
            );
          }
        } catch (compressionError) {
          logWarning("processVideoBuffer", 
            `Compression failed: ${compressionError.message}.`
          );
        }
      }

      // Final result
      const resultBuffer = fs.readFileSync(currentPath);
      const finalSize = resultBuffer.length / (1024 * 1024);

      if (finalSize > maxSizeMB) {
        const limitError = new Error(
          `Video vượt quá dung lượng. Tối đa ${maxSizeMB}MB sau khi nén.`,
        );
        limitError.status = 413;
        limitError.code = "VIDEO_SIZE_LIMIT_EXCEEDED";
        limitError.data = {
          maxSizeMB,
          finalSizeMB: Number(finalSize.toFixed(2)),
        };
        throw limitError;
      }
      
      cleanup(...needsCleanup);
      
      logSuccess("processVideoBuffer", 
        `Final output: ${finalSize.toFixed(2)}MB (.mp4) - Completed`
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
    const inputPath = typeof videoInput === "string" 
      ? videoInput 
      : path.join(tmpDir, `input_${timestamp}_${localId}.mp4`);
    const outputPath = path.join(tmpDir, thumbnailFileName);

    // Write buffer if needed
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

    // Get video duration to adjust seek time
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      let finalSeekTime = 0;
      
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
        .inputOptions(["-threads 1"])
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
          }, 30000);
        })
        .on("end", () => {
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
