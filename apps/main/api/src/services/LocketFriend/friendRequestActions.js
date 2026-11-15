function requestActionError(message, code, status = 502) {
  return Object.assign(new Error(message), { code, status });
}

const normalizeRequestUids = (uids, userUid, maxBatchSize = 200) => {
  if (!Array.isArray(uids) || uids.length === 0 || uids.length > maxBatchSize) {
    throw requestActionError(
      `Danh sách yêu cầu phải có từ 1 đến ${maxBatchSize} UID.`,
      "INVALID_FRIEND_REQUEST_BATCH",
      400,
    );
  }

  const normalized = [...new Set(uids.map((uid) => String(uid || "").trim()))];
  if (
    normalized.some(
      (uid) => !uid || uid.length > 128 || /[\s/]/.test(uid) || uid === userUid,
    )
  ) {
    throw requestActionError(
      "Danh sách yêu cầu kết bạn không hợp lệ.",
      "INVALID_FRIEND_REQUEST_TARGET",
      400,
    );
  }
  return normalized;
};

const confirmDeletedRequest = (response, uid) => {
  const body = response?.data || {};
  const result = body?.result ?? body;
  const data = result?.data ?? result;
  const returnedUid = data?.user_uid || data?.uid;
  const errors = body?.error || result?.error || body?.errors || result?.errors;
  const hasErrors = Array.isArray(errors) ? errors.length > 0 : Boolean(errors);
  const status = Number(result?.status);
  const acknowledged =
    status === 200 || result?.success === true || returnedUid === uid;

  if (
    hasErrors ||
    result?.success === false ||
    !acknowledged ||
    (returnedUid && returnedUid !== uid)
  ) {
    throw requestActionError(
      "Locket chưa xác nhận xóa yêu cầu kết bạn.",
      "FRIEND_REQUEST_DELETE_UNCONFIRMED",
    );
  }
};

function createFriendRequestActions(client) {
  return async ({ idToken, userUid, uids, direction = "incoming" }) => {
    if (!["incoming", "outgoing"].includes(direction)) {
      throw requestActionError(
        "Chiều yêu cầu kết bạn không hợp lệ.",
        "INVALID_FRIEND_REQUEST_DIRECTION",
        400,
      );
    }

    const targets = normalizeRequestUids(uids, userUid);
    const successUidList = [];
    const failures = [];
    let cursor = 0;

    const worker = async () => {
      while (cursor < targets.length) {
        const uid = targets[cursor];
        cursor += 1;
        try {
          const response = await client.post(
            "deleteFriendRequest",
            { data: { user_uid: uid, direction } },
            { meta: { idToken }, timeout: 15_000 },
          );
          confirmDeletedRequest(response, uid);
          successUidList.push(uid);
        } catch (error) {
          failures.push({
            uid,
            status: Number(error?.response?.status || error?.status || 0) || null,
            code: error?.code || "FRIEND_REQUEST_DELETE_FAILED",
          });
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(5, targets.length) }, () => worker()),
    );

    return {
      total: targets.length,
      successCount: successUidList.length,
      successUidList,
      failures,
    };
  };
}

module.exports = {
  confirmDeletedRequest,
  createFriendRequestActions,
  normalizeRequestUids,
};
