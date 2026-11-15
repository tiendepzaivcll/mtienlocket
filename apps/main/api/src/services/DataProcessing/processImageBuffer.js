const sharp = require("sharp");
const heicConvert = require("heic-convert");
const { logSuccess } = require("../../utils/logEventUtils");
const {
  LOCKET_IMAGE_OUTPUT_MAX_MB,
  LOCKET_IMAGE_OUTPUT_MAX_BYTES,
  assertLocketImageOutput,
} = require("../../config/imageUploadPolicy");

const logInfo = (tag, message) => {
  console.log(`[${tag.toUpperCase()}] ${message}`);
};

const prepareImageForProcessing = async (imageBuffer) => {
  try {
    if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length < 32) {
      throw new Error(
        `Input Buffer is empty or too small (${imageBuffer?.length || 0} bytes)`,
      );
    }

    let image = sharp(imageBuffer, { failOn: "truncated" }).rotate();
    const metadata = await image.metadata();
    const { format } = metadata;

    logInfo("prepareImage", `Detected format: ${format}`);
    const unsupportedFormats = ["heif", "heic"];

    if (unsupportedFormats.includes(format?.toLowerCase())) {
      logInfo(
        "prepareImage",
        `Using heic-convert to convert ${format} to JPEG`
      );

      const jpegBuffer = await heicConvert({
        buffer: imageBuffer,
        format: "JPEG",
        quality: 1,
      });

      if (!jpegBuffer?.length) {
        throw new Error("HEIC conversion produced an empty image");
      }

      image = sharp(jpegBuffer, { failOn: "truncated" }).rotate();
      logInfo("prepareImage", "✅ Successfully converted HEIC to JPEG");
    }

    return image;
  } catch (err) {
    logInfo("prepareImage", `Error preparing image: ${err.message}`);
    throw new Error("Cannot prepare image format: " + err.message);
  }
};

const encodeHighQualityWebp = async (basePipeline, side, quality) => {
  let pipeline = basePipeline.clone();
  if (side > 0) {
    pipeline = pipeline.resize(side, side, {
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
      withoutEnlargement: true,
    });
  }

  return pipeline
    .webp({
      quality,
      alphaQuality: 100,
      smartSubsample: false,
      effort: 4,
    })
    .toBuffer();
};

const processImageBuffer = async ({
  imageBuffer,
  maxSizeMB = LOCKET_IMAGE_OUTPUT_MAX_MB,
  resolution = 2048,
}) => {
  try {
    logInfo("processImageBuffer", "Start processing storage-safe image...");

    const image = await prepareImageForProcessing(imageBuffer);
    const metadata = await image.metadata();
    const width = Number(metadata.width || 0);
    const height = Number(metadata.height || 0);

    logInfo("processImageBuffer", `Original size: ${width}x${height}`);
    if (!width || !height) throw new Error("Invalid image dimensions");

    const cropSide = Math.min(width, height);
    const squared = image.extract({
      left: Math.max(0, Math.floor((width - cropSide) / 2)),
      top: Math.max(0, Math.floor((height - cropSide) / 2)),
      width: cropSide,
      height: cropSide,
    });

    const requestedResolution = Number(resolution);
    const targetSide = Number.isFinite(requestedResolution) && requestedResolution > 0
      ? Math.max(720, Math.min(requestedResolution, 4096))
      : 2048;
    const outputSide = Math.min(cropSide, targetSide);
    const requestedMaxBytes =
      Math.max(0.5, Number(maxSizeMB) || LOCKET_IMAGE_OUTPUT_MAX_MB) *
      1024 *
      1024;
    const maxBytes = Math.min(
      requestedMaxBytes,
      LOCKET_IMAGE_OUTPUT_MAX_BYTES,
    );

    logInfo(
      "processImageBuffer",
      cropSide > outputSide
        ? `Downscale ${cropSide}px -> ${outputSide}px`
        : `Keep native square ${outputSide}px (no upscale)`,
    );

    let compressedBuffer;
    for (const quality of [95, 92, 90, 88, 85, 82]) {
      compressedBuffer = await encodeHighQualityWebp(
        squared,
        outputSide,
        quality,
      );
      logInfo(
        "processImageBuffer",
        `${outputSide}px q${quality}: ${(
          compressedBuffer.length /
          1024 /
          1024
        ).toFixed(2)}MB`,
      );
      if (compressedBuffer.length <= maxBytes) {
        logSuccess("processImageBuffer", "End processing image buffer.");
        return assertLocketImageOutput(compressedBuffer);
      }
    }

    const fallbackSides = [1920, 1600, 1440, 1280, 1080, 960, 720].filter(
      (side) => side < outputSide,
    );
    for (const side of fallbackSides) {
      const quality = side >= 1600 ? 90 : side >= 1080 ? 88 : 84;
      compressedBuffer = await encodeHighQualityWebp(squared, side, quality);
      logInfo(
        "processImageBuffer",
        `Fallback ${side}px q${quality}: ${(
          compressedBuffer.length /
          1024 /
          1024
        ).toFixed(2)}MB`,
      );
      if (compressedBuffer.length <= maxBytes) {
        logSuccess("processImageBuffer", "End processing image buffer.");
        return assertLocketImageOutput(compressedBuffer);
      }
    }

    throw new Error(
      `Processed image remains above upload budget (${(
        compressedBuffer.length /
        1024 /
        1024
      ).toFixed(2)} MB)`,
    );
  } catch (err) {
    throw new Error("❌ Lỗi xử lý ảnh: " + err.message);
  }
};

module.exports = {
  processImageBuffer,
};
