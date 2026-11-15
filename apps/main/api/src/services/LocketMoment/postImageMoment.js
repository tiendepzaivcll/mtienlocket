const { instanceLocketV2 } = require("../../libs");
const { logInfo, logError, logBanner } = require("../../utils/logEventUtils");
const { uploadImageToFirebaseStorage } = require("../FirestorageService");
const { creImagePayload } = require("../LocketPayload");
const { verifyStreakRestoreResult } = require("./verifyStreakRestore");
const { extractConfirmedMoment } = require("./confirmedMoment");
const {
  preserveSubmittedOverlay,
} = require("./preserveSubmittedOverlay");

const postImageToLocket = async ({ userId, idToken, image, optionsData }) => {
  try {
    logInfo("postImage", "Start");

    if (!optionsData || !optionsData.type) {
      throw new Error("Missing optionsData.type");
    }

    const imageUrl = await uploadImageToFirebaseStorage(userId, idToken, image);

    const { type } = optionsData;

    logBanner(`Type đang sử dụng: ${type}`);
    console.log("📦 optionsData received:", {
      type: optionsData.type,
      caption: optionsData.caption,
      background: optionsData.background,
    });

    let postData;

    switch (type) {
      // caption mặc định
      case "default":
        postData = creImagePayload.imagePostPayloadDefault({
          imageUrl,
          optionsData,
        });
        break;

      // decorative của Locket
      case "decorative":
        postData = creImagePayload.imagePostPayloadDecorative({
          imageUrl,
          optionsData,
        });
        break;

      // custom của T97
      case "image_icon":
      case "image_gif":
      case "caption_icon":
      case "caption_gif":
      case "caption_image":
      case "custome":
      case "background":
      case "special":
      // Locket native caption types
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
      case "custom":
      case "template":
        postData = creImagePayload.imagePostPayloadIcon({
          imageUrl,
          optionsData,
        });
        break;

      default:
        throw new Error(`Không hỗ trợ type: ${type}`);
    }

    const postResponse = await instanceLocketV2.post("postMomentV2", postData, {
      meta: { idToken },
    });

    extractConfirmedMoment(postResponse.data);

    const restoreVerification = await verifyStreakRestoreResult({
      responseData: postResponse.data,
      optionsData,
      idToken,
    });
    if (restoreVerification) {
      console.log("✅ Restore streak verified:", restoreVerification);
    }

    logInfo("postImage", "End");

    return postResponse.data;
  } catch (error) {
    const message =
      error.response?.data?.error ||
      error.response?.statusText ||
      error.message;

    logError("postImage", message);

    if (!error.response) throw error;
    throw new Error(message);
  }
};

const postImageToLocketV2 = async ({
  userId,
  idToken,
  imageBuffer,
  optionsData,
}) => {
  try {
    logInfo("postImage", "Start");

    if (!optionsData || !optionsData.type) {
      throw new Error("Missing optionsData.type");
    }

    const imageUrl = await uploadImageToFirebaseStorage(
      userId,
      idToken,
      imageBuffer,
    );

    console.log("✅ Image upload confirmed");

    const { type } = optionsData;

    logBanner(`Type đang sử dụng: ${type}`);

    let postData;

    switch (type) {
      // caption mặc định
      case "default":
        console.log("📋 Using default payload");
        postData = creImagePayload.imagePostPayloadDefault({
          imageUrl,
          optionsData,
        });
        break;

      // decorative của Locket
      case "decorative":
        console.log("📋 Using decorative payload");
        postData = creImagePayload.imagePostPayloadDecorative({
          imageUrl,
          optionsData,
        });
        break;

      // Custom captions - từ API hoặc user data
      case "custom":
      case "template":
      case "image_icon":
      case "image_gif":
      case "caption_icon":
      case "caption_gif":
      case "caption_image":
      case "custome":
      case "background":
      case "special":
      // Locket native caption types
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
        postData = creImagePayload.imagePostPayloadIcon({
          imageUrl,
          optionsData,
        });
        break;

      default:
        throw new Error(`Không hỗ trợ type: ${type}`);
    }

    console.log("✅ Payload created successfully");

    console.log("🚀 Posting to Locket API...");
    const postResponse = await instanceLocketV2.post("postMomentV2", postData, {
      meta: { idToken },
    });

    const responseMoment = extractConfirmedMoment(postResponse.data);

    console.log("✅ Locket API response received");
    const restoreVerification = await verifyStreakRestoreResult({
      responseData: postResponse.data,
      optionsData,
      idToken,
    });
    if (restoreVerification) {
      console.log("✅ Restore streak verified:", restoreVerification);
    }

    logInfo("postImage", "End");

    return {
      ...(postResponse.data || {}),
      data: preserveSubmittedOverlay(responseMoment, postData),
    };
  } catch (error) {
    const message =
      error.response?.data?.error ||
      error.response?.statusText ||
      error.message;

    console.error("❌ postImageToLocketV2 Error:", {
      message,
      status: error.status || error.response?.status,
      data: error.response?.data,
      stack: error.stack,
    });

    logError("postImage", message);

    if (!error.response) throw error;
    throw new Error(message);
  }
};

module.exports = {
  postImageToLocket,
  postImageToLocketV2,
};
