const { instanceLocketV2 } = require("../../libs");

const getRestoreStreakData = (optionsData = {}) =>
  optionsData.restoreStreakData || optionsData.restoreStreakDate || null;

const readIntValue = (value) => Number(value?.value ?? value);

const streakContainsDate = (streak, targetDate) =>
  readIntValue(streak?.last_updated_yyyymmdd) === targetDate ||
  readIntValue(streak?.past_streak?.last_updated_yyyymmdd) === targetDate;

const wait = (delay) => new Promise((resolve) => setTimeout(resolve, delay));

const fetchLatestStreak = async (idToken) => {
  const response = await instanceLocketV2.post(
    "getLatestMomentV2",
    {
      data: {
        excluded_users: [],
        fetch_streak: true,
        should_count_missed_moments: true,
      },
    },
    { meta: { idToken } },
  );

  return response.data?.result?.streak || null;
};

const verifyStreakRestoreResult = async ({
  responseData,
  optionsData,
  idToken,
}) => {
  const restoreData = getRestoreStreakData(optionsData);
  if (restoreData?.mode !== "restore") return null;

  const targetDate = Number(restoreData.data);
  const result = responseData?.result || responseData || {};
  const postedMoment = result.data || responseData?.data || null;
  const resultErrors = Array.isArray(result.errors) ? result.errors : [];

  if (!postedMoment) {
    throw new Error(
      resultErrors.length
        ? resultErrors.join(", ")
        : "Locket không trả về moment khôi phục hợp lệ.",
    );
  }

  if (
    readIntValue(postedMoment.streak_recovery_yyyymmdd) === targetDate ||
    streakContainsDate(result.streak, targetDate)
  ) {
    return {
      verified: true,
      restoreDate: targetDate,
      source: postedMoment.streak_recovery_yyyymmdd
        ? "postMomentV2.data.streak_recovery_yyyymmdd"
        : "postMomentV2.streak",
      streak: result.streak || null,
    };
  }

  let lastStreak = result.streak || null;
  let lastError = null;
  for (const delay of [700, 1200, 2200, 3500]) {
    await wait(delay);
    try {
      lastStreak = await fetchLatestStreak(idToken);
      if (streakContainsDate(lastStreak, targetDate)) {
        return {
          verified: true,
          restoreDate: targetDate,
          source: "getLatestMomentV2.streak",
          streak: lastStreak,
        };
      }
    } catch (error) {
      lastError = error;
    }
  }

  const error = new Error(
    "Moment đã được đăng nhưng Locket chưa cập nhật chuỗi cho ngày đã chọn.",
  );
  error.status = 502;
  error.data = {
    restoreDate: targetDate,
    streak: lastStreak,
    verificationError: lastError?.message || null,
  };
  throw error;
};

module.exports = {
  readIntValue,
  streakContainsDate,
  verifyStreakRestoreResult,
};
