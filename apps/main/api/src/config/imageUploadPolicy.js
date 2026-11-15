const BYTES_PER_MB = 1024 * 1024;

// Firebase/Locket reliably accepts normalized thumbnail objects up to 1 MB.
// Source files may be larger, but every encoded image must pass this guard
// before a resumable upload session is opened.
const LOCKET_IMAGE_OUTPUT_MAX_MB = 1;
const LOCKET_IMAGE_OUTPUT_MAX_BYTES =
  LOCKET_IMAGE_OUTPUT_MAX_MB * BYTES_PER_MB;

const assertLocketImageOutput = (buffer) => {
  const size = Buffer.isBuffer(buffer) ? buffer.length : 0;
  if (!size || size > LOCKET_IMAGE_OUTPUT_MAX_BYTES) {
    const error = new Error(
      `Ảnh sau xử lý vượt giới hạn Firebase (${(
        size / BYTES_PER_MB
      ).toFixed(2)} MB > ${LOCKET_IMAGE_OUTPUT_MAX_MB} MB)`,
    );
    error.status = 422;
    error.code = "IMAGE_OUTPUT_BUDGET_EXCEEDED";
    error.fileSize = size;
    throw error;
  }
  return buffer;
};

module.exports = {
  LOCKET_IMAGE_OUTPUT_MAX_MB,
  LOCKET_IMAGE_OUTPUT_MAX_BYTES,
  assertLocketImageOutput,
};
