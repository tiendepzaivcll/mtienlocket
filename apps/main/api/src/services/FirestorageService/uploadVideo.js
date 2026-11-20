const fs = require("fs");
const videoService = require("../DataProcessing/generateThumbnail.js");
const axios = require("axios");
const {
  createFirebaseObjectId,
  uploadImageToFirebaseStorage,
} = require("./uploadImage.js");
const { logError, logInfo } = require("../../utils/logEventUtils.js");
const {
  getOrCreateAppCheckToken,
  invalidateGeneratedAppCheckToken,
} = require("../AppCheck/appCheckService");
const {
  createFirebaseStorageError,
  shouldRefreshAppCheck,
} = require("./firebaseStoragePolicy");

const uploadThumbnailFromVideo = async (userId, idToken, video) => {
  try {
    const thumbnailBytes = await videoService.thumbnailData(
      video.path,
      "jpeg",
      128,
      75,
    );
    return await uploadImageToFirebaseStorage(userId, idToken, thumbnailBytes);
  } catch (error) {
    logError("uploadThumbnailFromVideo", error.code || error.message);
    return null;
  }
};

async function startResumableUpload({
  userId,
  idToken,
  videoSize,
  objectPath,
  appCheckToken,
}) {
  const encodedPath = encodeURIComponent(objectPath);
  const url = `https://firebasestorage.googleapis.com/v0/b/locket-video/o/${encodedPath}?uploadType=resumable&name=${encodedPath}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=UTF-8",
      authorization: `Firebase ${idToken}`,
      "x-goog-upload-protocol": "resumable",
      accept: "*/*",
      "x-goog-upload-command": "start",
      "x-goog-upload-content-length": `${videoSize}`,
      "accept-language": "vi-VN,vi;q=0.9",
      "x-firebase-storage-version": "ios/12.12.0",
      "user-agent":
        "com.locket.Locket/2.60.0 iPhone/26.1 hw/iPhone16_2 (GTMSUF/1)",
      "x-goog-upload-content-type": "video/mp4",
      "x-firebase-gmpid": "1:641029076083:ios:cc8eb46290d69b234fa606",
      ...(appCheckToken ? { "X-Firebase-AppCheck": appCheckToken } : {}),
    },
    body: JSON.stringify({
      name: objectPath,
      contentType: "video/mp4",
      bucket: "",
      cacheControl: "public, max-age=604800",
      metadata: { creator: userId, visibility: "private" },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw createFirebaseStorageError({
      stage: "init",
      status: response.status,
      message: body || response.statusText,
    });
  }

  const uploadUrl = response.headers.get("X-Goog-Upload-URL");
  if (!uploadUrl) {
    throw createFirebaseStorageError({
      stage: "init",
      status: 502,
      message: "Firebase did not return a resumable upload URL",
    });
  }
  return uploadUrl;
}

async function transferVideo({ uploadUrl, video, videoSize }) {
  try {
    await axios.put(uploadUrl, video, {
      timeout: 120_000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      headers: {
        "content-type": "application/octet-stream",
        "content-length": `${videoSize}`,
        "x-goog-upload-protocol": "resumable",
        "x-goog-upload-offset": "0",
        "x-goog-upload-command": "upload, finalize",
        "x-goog-upload-content-length": `${videoSize}`,
        "upload-complete": "?1",
        "upload-draft-interop-version": "6",
        "user-agent":
          "com.locket.Locket/2.60.0 iPhone/26.1 hw/iPhone16_2 (GTMSUF/1)",
      },
    });
  } catch (cause) {
    throw createFirebaseStorageError({ stage: "transfer", cause });
  }
}

async function getVideoDownloadUrl({
  userId,
  idToken,
  videoName,
  appCheckToken,
}) {
  const getUrl = `https://firebasestorage.googleapis.com/v0/b/locket-video/o/users%2F${userId}%2Fmoments%2Fvideos%2F${videoName}`;
  const response = await fetch(getUrl, {
    method: "GET",
    headers: {
      "content-type": "application/json; charset=UTF-8",
      authorization: `Firebase ${idToken}`,
      ...(appCheckToken ? { "X-Firebase-AppCheck": appCheckToken } : {}),
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw createFirebaseStorageError({
      stage: "metadata",
      status: response.status,
      message: body || response.statusText,
    });
  }

  const downloadToken = (await response.json()).downloadTokens;
  if (!downloadToken) {
    throw createFirebaseStorageError({
      stage: "metadata",
      status: 502,
      message: "Firebase returned no video download token",
    });
  }
  return `${getUrl}?alt=media&token=${downloadToken}`;
}

async function runVideoUploadAttempt({
  userId,
  idToken,
  video,
  videoName,
  appCheckToken,
}) {
  const videoBuffer = Buffer.isBuffer(video)
    ? video
    : video?.buffer
      ? video.buffer
      : video?.path
        ? fs.readFileSync(video.path)
        : Buffer.from(video);
  const videoSize = videoBuffer.length;
  const objectPath = `users/${userId}/moments/videos/${videoName}`;
  const uploadUrl = await startResumableUpload({
    userId,
    idToken,
    videoSize,
    objectPath,
    appCheckToken,
  });
  await transferVideo({ uploadUrl, video: videoBuffer, videoSize });
  return getVideoDownloadUrl({
    userId,
    idToken,
    videoName,
    appCheckToken,
  });
}

const uploadVideoToFirebaseStorage = async (userId, idToken, video) => {
  logInfo("uploadVideoToFirebaseStorage", "Start");
  const videoName = `${createFirebaseObjectId()}.mp4`;
  let appCheckToken = await getOrCreateAppCheckToken().catch(() => null);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const downloadUrl = await runVideoUploadAttempt({
        userId,
        idToken,
        video,
        videoName,
        appCheckToken,
      });
      logInfo("uploadVideoToFirebaseStorage", "End");
      return downloadUrl;
    } catch (error) {
      if (shouldRefreshAppCheck(error, attempt)) {
        invalidateGeneratedAppCheckToken();
        const refreshedToken = await getOrCreateAppCheckToken({
          forceRefresh: true,
        }).catch(() => null);
        if (refreshedToken) {
          appCheckToken = refreshedToken;
          continue;
        }
      }

      logError("uploadVideoToFirebaseStorage", error.code || error.message);
      throw error;
    }
  }

  throw createFirebaseStorageError({
    stage: "upload",
    status: 502,
    message: "Firebase video upload exhausted",
  });
};

module.exports = {
  uploadVideoToFirebaseStorage,
  uploadThumbnailFromVideo,
  _private: {
    getVideoDownloadUrl,
    runVideoUploadAttempt,
    startResumableUpload,
    transferVideo,
  },
};
