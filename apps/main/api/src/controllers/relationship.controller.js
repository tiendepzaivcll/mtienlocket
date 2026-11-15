const { instanceLocketV2 } = require("../libs/instanceLocket");
const { createRelationshipActions } = require("../services/LocketFriend/relationshipActions");
const performAction = createRelationshipActions(instanceLocketV2);

exports.relationshipAction = async (req, res, next) => {
  try {
    const data = await performAction({
      action: req.body?.action,
      targetUid: req.body?.targetUid,
      userUid: req.user.localId,
      idToken: req.user.idToken,
    });
    return res.json({ success: true, data });
  } catch (error) {
    // Do not forward Axios request config (which contains the session token).
    const upstream = error.response?.status;
    const status = upstream === 401 || upstream === 403 ? 502 :
      upstream === 404 || upstream === 405 ? 501 : error.status || 502;
    const message = upstream === 401
      ? "Locket không chấp nhận phiên đăng nhập hoặc App Check (401). Kiểm tra App Check tại /admin rồi thử lại."
      : upstream === 403 ? "Locket từ chối quyền chặn/xóa bạn (403). Web chưa thay đổi danh sách bạn bè."
      : upstream === 404 || upstream === 405 ? "Locket không cung cấp endpoint chặn tương thích (404/405). Chưa chặn tài khoản."
      : upstream === 429 ? "Locket giới hạn số lần thao tác (429). Vui lòng thử lại sau."
      : upstream ? `Không xác nhận được thao tác từ Locket (HTTP ${upstream}). Không tự động thử lại.` : error.message;
    console.warn("[friend-action] failed", { action: req.body?.action,
      endpoint: error.actionEndpoint, upstreamStatus: upstream || null, code: error.code });
    next(Object.assign(new Error(message), {
      status, code: error.code === "FRIEND_ACTION_UNCONFIRMED" || !upstream
        ? error.code : "FRIEND_ACTION_UPSTREAM_FAILED",
      data: upstream ? { upstreamStatus: upstream, endpoint: error.actionEndpoint } : undefined,
    }));
  }
};
