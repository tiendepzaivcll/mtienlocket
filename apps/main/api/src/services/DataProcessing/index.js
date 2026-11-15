const { deleteTempFile } = require("./cleanTempMedia");
const { deleteFileFromStorageR2 } = require("./deleteFileFromStorage");
const { downloadMediaOnStorage } = require("./downloadMedia");
const { thumbnailData } = require("./generateThumbnail");
const { processImageBuffer } = require("./processImageBuffer");
const {
  processVideoBuffer,
  generateThumbnail,
  probeVideoBuffer,
} = require("./processVideoBuffer");
const {
  CUSTOM_CAPTION_TYPES,
  renderCaptionOverlayOnImage,
} = require("./renderCaptionOverlay");

module.exports = {
  downloadMediaOnStorage,
  thumbnailData,
  deleteTempFile,
  deleteFileFromStorageR2,
  processImageBuffer,
  processVideoBuffer,
  generateThumbnail,
  probeVideoBuffer,
  CUSTOM_CAPTION_TYPES,
  renderCaptionOverlayOnImage,
};
