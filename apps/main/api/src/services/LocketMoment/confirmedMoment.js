function unwrapMomentId(value) {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") {
    return String(value.stringValue || value.string_value || "").trim();
  }
  return "";
}

function getConfirmedMomentId(moment) {
  if (!moment || typeof moment !== "object" || Array.isArray(moment)) return "";
  return (
    unwrapMomentId(moment.canonical_uid) ||
    unwrapMomentId(moment.id) ||
    unwrapMomentId(moment.momentId)
  );
}

function findMoment(responseData) {
  const candidates = [
    responseData?.result?.data,
    responseData?.data,
    responseData?.moment,
    responseData,
  ];
  return candidates.find((candidate) => getConfirmedMomentId(candidate)) || null;
}

function extractConfirmedMoment(responseData) {
  const moment = findMoment(responseData);
  if (!moment) {
    const error = new Error(
      "Locket chưa xác nhận đã lưu bài đăng. Bài vẫn được giữ trong hàng đợi.",
    );
    error.code = "LOCKET_POST_NOT_CONFIRMED";
    error.status = 502;
    throw error;
  }
  return moment;
}

module.exports = {
  extractConfirmedMoment,
  getConfirmedMomentId,
};
