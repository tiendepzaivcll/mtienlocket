const FIREBASE_PERMISSION_STATUSES = new Set([401, 403]);

function extractFirebaseMessage(value) {
  return String(
    value?.response?.data?.error?.message ||
      value?.response?.data?.error ||
      value?.response?.data?.message ||
      value?.message ||
      "Firebase Storage request failed",
  ).slice(0, 300);
}

function firebaseStageCode(stage, status) {
  const normalizedStage = String(stage || "upload").toUpperCase();
  return FIREBASE_PERMISSION_STATUSES.has(Number(status))
    ? `FIREBASE_STORAGE_${normalizedStage}_FORBIDDEN`
    : `FIREBASE_STORAGE_${normalizedStage}_FAILED`;
}

function createFirebaseStorageError({ stage, status, cause, message }) {
  const resolvedStatus = Number(status || cause?.response?.status || 502);
  const error = new Error(message || extractFirebaseMessage(cause));
  error.status = resolvedStatus;
  error.code = firebaseStageCode(stage, resolvedStatus);
  error.data = {
    stage,
    upstreamStatus: resolvedStatus,
    upstreamMessage: extractFirebaseMessage(cause || { message }),
  };
  return error;
}

function shouldRefreshAppCheck(error, attempt = 0) {
  return (
    attempt === 0 &&
    FIREBASE_PERMISSION_STATUSES.has(
      Number(error?.status || error?.response?.status || 0),
    )
  );
}

module.exports = {
  createFirebaseStorageError,
  extractFirebaseMessage,
  firebaseStageCode,
  shouldRefreshAppCheck,
};
