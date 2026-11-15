function actionError(message, code, status = 502) {
  return Object.assign(new Error(message), { code, status });
}

function createRelationshipActions(client) {
  return async ({ action, idToken, userUid, targetUid }) => {
    const uid = typeof targetUid === "string" ? targetUid.trim() : "";
    if (!uid || uid.length > 128 || /[\s/]/.test(uid) || uid === userUid) {
      throw actionError("Tài khoản được chọn không hợp lệ.", "INVALID_FRIEND_TARGET", 400);
    }
    const endpoints = action === "remove" ? ["removeFriend"] : action === "block"
      ? ["blockUser", "blockFriend", "blockAccount"] : null;
    if (!endpoints) throw actionError("Thao tác không hợp lệ.", "INVALID_FRIEND_ACTION", 400);
    let response;
    for (const endpoint of endpoints) {
      try {
        response = await client.post(endpoint, { data: { user_uid: uid } }, {
          meta: { idToken }, timeout: 15000,
        });
        break;
      } catch (error) {
        error.actionEndpoint = endpoint;
        const status = Number(error.response?.status);
        // Compatibility names from the supplied sample. Never retry auth,
        // permission, rate-limit, timeout or ambiguous server failures.
        if (![404, 405].includes(status) || endpoint === endpoints.at(-1)) throw error;
      }
    }
    const body = response.data;
    const result = body?.result;
    const data = result?.data ?? result;
    const returnedUid = data?.user_uid || data?.uid;
    const errors = body?.error || result?.error || body?.errors || result?.errors;
    const hasErrors = Array.isArray(errors) ? errors.length > 0 : Boolean(errors);
    const acknowledged = Number(result?.status) === 200 || result?.success === true ||
      (returnedUid === uid && !result?.status);
    if (hasErrors || result?.success === false || !acknowledged ||
      (returnedUid && returnedUid !== uid)) {
      throw actionError("Locket chưa xác nhận thao tác. Danh sách bạn bè chưa được thay đổi.", "FRIEND_ACTION_UNCONFIRMED");
    }
    return { uid, action, confirmed: true };
  };
}

module.exports = { createRelationshipActions };
