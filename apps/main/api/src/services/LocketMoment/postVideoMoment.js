const fs = require("fs");
const { instanceLocketV2 } = require("../../libs");
const { logInfo, logError, logBanner } = require("../../utils/logEventUtils");
const { creVideoPayload } = require("../LocketPayload");
const { verifyStreakRestoreResult } = require("./verifyStreakRestore");
const { extractConfirmedMoment } = require("./confirmedMoment");
const {
  preserveSubmittedOverlay,
} = require("./preserveSubmittedOverlay");
const {
  uploadThumbnailFromVideo,
  uploadVideoToFirebaseStorage,
  uploadImageToFirebaseStorage,
} = require("../FirestorageService");

const postVideoToLocket = async ({ userId, idToken, video, optionsData }) => {
  try {
    logInfo("postVideoToLocket", "Start");

    const videoBuffer = video.buffer || fs.readFileSync(video.path);

    const thumbnailUrl = await uploadThumbnailFromVideo(userId, idToken, video);

    if (!thumbnailUrl) {
      throw new Error("Failed to upload thumbnail");
    }

    const videoUrl = await uploadVideoToFirebaseStorage(
      userId,
      idToken,
      videoBuffer,
    );

    if (!videoUrl) {
      throw new Error("Failed to upload video");
    }

    const { type } = optionsData;

    logBanner(`Type đang sử dụng: ${type}`);

    let postData;

    switch (type) {
      case "default":
        postData = creVideoPayload.videoPostPayloadDefault({
          videoUrl,
          thumbnailUrl,
          optionsData,
        });
        break;

      case "decorative":
        postData = creVideoPayload.videoPostPayloadDecorative({
          videoUrl,
          thumbnailUrl,
          optionsData,
        });
        break;

      case "custom":
      case "custome":
      case "template":
      case "image_icon":
      case "image_gif":
      case "caption_icon":
      case "caption_gif":
      case "caption_image":
      case "background":
      case "special":
      case "static_content":
      case "streak":
      case "time":
      case "location":
      case "weather":
      case "music":
      case "star_sign":
      case "locket_count":
      case "review":
      case "standard":
      case "poll":
      case "color_palette":
        postData = creVideoPayload.videoPostPayloadIcon({
          videoUrl,
          thumbnailUrl,
          optionsData,
        });
        break;

      default:
        throw new Error(`Không hỗ trợ type: ${type}. Các type được hỗ trợ: default, decorative, custom, template, image_icon, image_gif, background, special`);
    }

    const response = await instanceLocketV2.post("postMomentV2", postData, {
      meta: { idToken },
    });

    extractConfirmedMoment(response.data);

    logInfo("postVideoToLocket", "End");

    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.error ||
      error.response?.statusText ||
      error.message;

    logError("postVideoToLocket", message);
    if (!error.response) throw error;
    throw new Error(message);
  } finally {
    if (video?.path && fs.existsSync(video.path)) {
      fs.unlinkSync(video.path);
    }
  }
};

const postVideoToLocketV2 = async ({
  userId,
  idToken,
  videoBuffer,
  thumbBuffer,
  optionsData,
}) => {
  try {
    logInfo("postVideoToLocket", "Start");

    const thumbnailUrl = await uploadImageToFirebaseStorage(
      userId,
      idToken,
      thumbBuffer,
    );

    if (!thumbnailUrl) {
      throw new Error("Failed to upload thumbnail");
    }

    console.log("✅ Thumbnail upload confirmed");

    const videoUrl = await uploadVideoToFirebaseStorage(
      userId,
      idToken,
      videoBuffer,
    );

    if (!videoUrl) {
      throw new Error("Failed to upload video");
    }

    console.log("✅ Video upload confirmed");

    const { type } = optionsData;

    logBanner(`Type đang sử dụng: ${type}`);

    let postData;

    switch (type) {
      case "default":
        console.log("📋 Using default payload");
        postData = creVideoPayload.videoPostPayloadDefault({
          videoUrl,
          thumbnailUrl,
          optionsData,
        });
        break;

      case "decorative":
        console.log("📋 Using decorative payload");
        postData = creVideoPayload.videoPostPayloadDecorative({
          videoUrl,
          thumbnailUrl,
          optionsData,
        });
        break;

      case "custom":
      case "custome":
      case "template":
      case "image_icon":
      case "image_gif":
      case "caption_icon":
      case "caption_gif":
      case "caption_image":
      case "background":
      case "special":
      case "static_content":
      case "streak":
      case "time":
      case "location":
      case "weather":
      case "music":
      case "star_sign":
      case "locket_count":
      case "review":
      case "standard":
      case "poll":
      case "color_palette":
        console.log("📋 Using icon payload for type:", type);
        postData = creVideoPayload.videoPostPayloadIcon({
          videoUrl,
          thumbnailUrl,
          optionsData,
        });
        break;

      default:
        throw new Error(`Không hỗ trợ type: ${type}. Các type được hỗ trợ: default, decorative, custom, template, image_icon, image_gif, caption_icon, caption_gif, caption_image, background, special`);
    }

    console.log("✅ Payload created successfully");
    
    console.log("🚀 Posting video to Locket API...");

    const response = await instanceLocketV2.post("postMomentV2", postData, {
      meta: { idToken },
    });

    console.log("✅ Locket API response received");
    const responseMoment = extractConfirmedMoment(response.data);

    const restoreVerification = await verifyStreakRestoreResult({
      responseData: response.data,
      optionsData,
      idToken,
    });
    if (restoreVerification) {
      console.log("✅ Restore streak verified:", restoreVerification);
    }

    const resolvedMoment = preserveSubmittedOverlay(responseMoment, postData);

    logInfo("postVideoToLocket", "End");

    return {
      ...(response.data || {}),
      data: resolvedMoment,
    };
  } catch (error) {
    const message =
      error.response?.data?.error ||
      error.response?.statusText ||
      error.message;

    console.error("❌ postVideoToLocketV2 Error:", {
      message,
      status: error.status || error.response?.status,
      data: error.response?.data,
      stack: error.stack,
    });

    logError("postVideoToLocket", message);
    if (!error.response) throw error;
    throw new Error(message);
  }
};

module.exports = {
  postVideoToLocket,
  postVideoToLocketV2,
};
