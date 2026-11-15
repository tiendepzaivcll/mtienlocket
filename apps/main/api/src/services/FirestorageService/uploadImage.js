const fs = require("fs");
const crypto = require("crypto");
const { logInfo, logError } = require("../../utils/logEventUtils");
const { instanceFirestoreUpload } = require("../../libs");
const {
  getOrCreateAppCheckToken,
  invalidateGeneratedAppCheckToken,
} = require("../AppCheck/appCheckService");
const {
  createFirebaseStorageError,
  shouldRefreshAppCheck,
} = require("./firebaseStoragePolicy");
const {
  assertLocketImageOutput,
} = require("../../config/imageUploadPolicy");

const FIREBASE_OBJECT_ID_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

const createFirebaseObjectId = () =>
  Array.from(
    crypto.randomBytes(20),
    (byte) => FIREBASE_OBJECT_ID_ALPHABET[byte % FIREBASE_OBJECT_ID_ALPHABET.length],
  ).join("");

//#region Image handlers

/**
 * Uploads an image to Firebase Storage.
 *
 * @param {string} userId
 * @param {string} idToken
 * @param {File|Buffer} image - The image to be uploaded. Can be a `File` object or a `Buffer`.
 * @returns
 */
const uploadImageToFirebaseStorage = async (
  userId,
  idToken,
  image,
  { appCheckToken: providedAppCheckToken, retryAttempt = 0 } = {},
) => {
  try {
    logInfo("uploadImageToFirebaseStorage", "Start");
    const imageBuffer = Buffer.isBuffer(image)
      ? image
      : fs.readFileSync(image.path);
    assertLocketImageOutput(imageBuffer);
    const imageName = `${createFirebaseObjectId()}.webp`;

    // Bước 1: Khởi tạo quá trình upload
    const objectPath = `users/${userId}/moments/thumbnails/${imageName}`;
    const encodedPath = encodeURIComponent(objectPath);
    const url = `https://firebasestorage.googleapis.com/v0/b/locket-img/o/${encodedPath}?uploadType=resumable&name=${encodedPath}`;
    const appCheckToken =
      providedAppCheckToken ??
      (await getOrCreateAppCheckToken().catch(() => null));
    const initHeaders = {
      "content-type": "application/json; charset=UTF-8",
      authorization: `Firebase ${idToken}`,
      "x-goog-upload-protocol": "resumable",
      accept: "*/*",
      "x-goog-upload-command": "start",
      "x-goog-upload-content-length": `${imageBuffer.length}`,
      "accept-language": "vi-VN,vi;q=0.9",
      "x-firebase-storage-version": "ios/12.12.0",
      "user-agent":
        "com.locket.Locket/2.60.0 iPhone/26.1 hw/iPhone16_2 (GTMSUF/1)",
      "x-goog-upload-content-type": "image/webp",
      "x-firebase-gmpid": "1:641029076083:ios:cc8eb46290d69b234fa606",
      ...(appCheckToken ? { "X-Firebase-AppCheck": appCheckToken } : {}),
    };

    const data = JSON.stringify({
      name: objectPath,
      contentType: "image/webp",
      bucket: "",
      cacheControl: "public, max-age=604800",
      metadata: { creator: userId, visibility: "private" },
    });

    const response = await fetch(url, {
      method: "POST",
      headers: initHeaders,
      body: data,
    });

    if (!response.ok) {
      const responseBody = await response.text();
      throw createFirebaseStorageError({
        stage: "init",
        status: response.status,
        message: responseBody || response.statusText,
      });
    }

    const uploadUrl = response.headers.get("X-Goog-Upload-URL");

    if (!uploadUrl) {
      throw createFirebaseStorageError({
        stage: "init",
        status: 502,
        message: "Firebase did not return an image upload URL",
      });
    }
    // Bước 2: Tải dữ liệu hình ảnh lên thông qua URL resumable trả về từ bước 1
    try {
      await instanceFirestoreUpload.put(uploadUrl, imageBuffer);
    } catch (err) {
      throw createFirebaseStorageError({ stage: "transfer", cause: err });
    }

    // Lấy URL tải về hình ảnh từ Firebase Storage
    const getUrl = `https://firebasestorage.googleapis.com/v0/b/locket-img/o/users%2F${userId}%2Fmoments%2Fthumbnails%2F${imageName}`;
    const getHeaders = {
      "content-type": "application/json; charset=UTF-8",
      authorization: `Firebase ${idToken}`,
      ...(appCheckToken ? { "X-Firebase-AppCheck": appCheckToken } : {}),
    };

    const getResponse = await fetch(getUrl, {
      method: "GET",
      headers: getHeaders,
    });

    if (!getResponse.ok) {
      const responseBody = await getResponse.text();
      throw createFirebaseStorageError({
        stage: "metadata",
        status: getResponse.status,
        message: responseBody || getResponse.statusText,
      });
    }

    const downloadToken = (await getResponse.json()).downloadTokens;
    if (!downloadToken) {
      throw createFirebaseStorageError({
        stage: "metadata",
        status: 502,
        message: "Firebase returned no image download token",
      });
    }
    logInfo("uploadImageToFirebaseStorage", "End");

    return `${getUrl}?alt=media&token=${downloadToken}`;
  } catch (error) {
    if (shouldRefreshAppCheck(error, retryAttempt)) {
      invalidateGeneratedAppCheckToken();
      const refreshedToken = await getOrCreateAppCheckToken({
        forceRefresh: true,
      }).catch(() => null);
      if (refreshedToken) {
        return uploadImageToFirebaseStorage(userId, idToken, image, {
          appCheckToken: refreshedToken,
          retryAttempt: retryAttempt + 1,
        });
      }
    }
    logError("uploadImageToFirebaseStorage", error.message);
    throw error;
  } finally {
    // Xoá file ảnh tạm
    if (image.path && fs.existsSync(image.path)) {
      fs.unlinkSync(image.path);
    }
  }
};
//#endregion

module.exports = {
  createFirebaseObjectId,
  uploadImageToFirebaseStorage,
};
