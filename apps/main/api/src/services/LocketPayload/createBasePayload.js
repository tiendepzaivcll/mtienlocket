const crypto = require("crypto");
const { logInfo } = require("../../utils/logEventUtils");
const { createAnalytics } = require("../LocketAnalytics");
const { getYYYYMMDD } = require("../../utils/formatDay");

const getMd5Hash = (str) => {
  return crypto.createHash("md5").update(str).digest("hex");
};

const createIntValue = (value) => ({
  "@type": "type.googleapis.com/google.protobuf.Int64Value",
  value: value.toString(),
});

const getRestoreStreakData = (optionsData = {}) =>
  optionsData.restoreStreakData || optionsData.restoreStreakDate || null;

const resolveStreakDate = (optionsData = {}) => {
  const today = getYYYYMMDD();
  const restoreDate = getRestoreStreakData(optionsData)?.data;
  if (restoreDate === undefined || restoreDate === null) return today;

  const normalizedDate = Number(restoreDate);
  const value = String(normalizedDate);
  if (!/^\d{8}$/.test(value) || normalizedDate > today) {
    throw new Error("Ngày khôi phục chuỗi không hợp lệ.");
  }

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  const parsedDate = new Date(Date.UTC(year, month - 1, day));
  const isValidDate =
    parsedDate.getUTCFullYear() === year &&
    parsedDate.getUTCMonth() === month - 1 &&
    parsedDate.getUTCDate() === day;

  if (!isValidDate) {
    throw new Error("Ngày khôi phục chuỗi không hợp lệ.");
  }

  return normalizedDate;
};

/**
 * Tạo payload cơ bản cho ảnh hoặc video
 */
const createBasePayload = ({
  mediaUrl,
  thumbnailUrl,
  optionsData,
  isVideo = false,
}) => {
  const { recipients, audience } = optionsData;
  const restoreStreakData = getRestoreStreakData(optionsData);
  const isRestoreMode = restoreStreakData?.mode === "restore";
  
  logInfo("createBasePayload", "Bắt đầu khởi tạo payload");

  const payload = {
    thumbnail_url: thumbnailUrl || mediaUrl, // nếu ảnh thì chính là mediaUrl
    classification_results: {
      content_observations: {},
      suggested_reactions: [],
    },
    md5: isRestoreMode
      ? `${getMd5Hash(mediaUrl)}_${(Date.now() / 1000)
          .toFixed(6)
          .replace(/0+$/, "")
          .replace(/\.$/, "")}`
      : getMd5Hash(mediaUrl),
    analytics: createAnalytics(),
    overlays: [],
  };

  if (!isRestoreMode) {
    payload.show_personally = false;
  }

  if (audience === "private") {
    payload.sent_to_self_only = true;
    payload.sent_to_all = false;
  } else {
    payload.sent_to_self_only = false;
    payload.sent_to_all = true;
    payload.recipients = Array.isArray(recipients)
      ? recipients
      : recipients
        ? [recipients]
        : [];
  }

  // Nếu là video thì thêm các trường riêng
  if (isVideo) {
    payload.video_url = mediaUrl;
  }

  const streakDate = resolveStreakDate(optionsData);
  logInfo("newStreakDate", "Nhận yêu cầu tạo chuỗi cho ngày", streakDate);
  if (isRestoreMode) {
    payload.restore_streak_for_yyyymmdd = createIntValue(streakDate);
  } else {
    payload.update_streak_for_yyyymmdd = createIntValue(streakDate);
  }

  return payload;
};

/**
 * Tạo payload cho ảnh
 */
const createBaseImagePayload = ({ imageUrl, optionsData }) =>
  createBasePayload({ mediaUrl: imageUrl, optionsData, isVideo: false });

/**
 * Tạo payload cho video (sử dụng chung base)
 */
const createBaseVideoPayload = ({ videoUrl, thumbnailUrl, optionsData }) =>
  createBasePayload({
    mediaUrl: videoUrl,
    thumbnailUrl,
    optionsData,
    isVideo: true,
  });

module.exports = {
  createBasePayload,
  createBaseImagePayload,
  createBaseVideoPayload,
  createIntValue,
};
