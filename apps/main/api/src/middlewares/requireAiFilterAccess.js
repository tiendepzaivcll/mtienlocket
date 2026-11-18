const { db } = require("../config/firebase-admin-config");
const { authServices } = require("../services");
const {
  isApprovedDocEnabled,
  resolveEffectiveAccess,
} = require("../utils/accessPlans");

const APPROVED_USER_COLLECTION = "approved_users";

const requireAiFilterAccess = async (req, res, next) => {
  try {
    if (!db) {
      return res.status(503).json({
        success: false,
        message: "Firestore chưa sẵn sàng",
      });
    }

    const uid = req.user?.localId || req.user?.uid;
    if (!uid) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    let approvedDoc = null;
    let access = null;

    // 1. Tìm theo UID trước
    const snapshot = await db
      .collection(APPROVED_USER_COLLECTION)
      .where("uid", "==", uid)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      approvedDoc = snapshot.docs[0];
      access = approvedDoc.data() || null;
    }

    // 2. Nếu chưa có UID trong doc (do admin mới tạo hoặc chưa sync), tìm theo username
    if (!access) {
      let username = req.headers["x-username"] || req.body?.username;

      if (!username && req.user?.idToken) {
        try {
          const userInfo = await authServices.getUserInfoV2(req.user.idToken, uid);
          username = userInfo?.username;
        } catch (uErr) {
          console.warn("⚠️ [requireAiFilterAccess] Không lấy được userInfo từ Locket:", uErr.message);
        }
      }

      if (username) {
        const cleanUsername = String(username).trim().toLowerCase().replace(/^@+/, "");
        const docRef = db.collection(APPROVED_USER_COLLECTION).doc(cleanUsername);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
          approvedDoc = docSnap;
          access = docSnap.data() || null;
          // Tự động liên kết UID để lần sau tìm nhanh hơn
          docRef.set({ uid, lastAccessAt: new Date().toISOString() }, { merge: true }).catch(() => {});
        }
      }
    }

    if (!access) {
      return res.status(403).json({
        success: false,
        code: "AI_FILTER_VIP_REQUIRED",
        message: "Tính năng AI Filter chỉ dành cho thành viên VIP. Vui lòng nâng cấp VIP trước!",
        data: {
          title: "Cần nâng cấp VIP",
          description: "Nâng cấp VIP để mở khóa quyền mua và sử dụng AI Filter",
        },
      });
    }

    const resolved = resolveEffectiveAccess(access);
    if (resolved.needsPersist && approvedDoc?.ref) {
      approvedDoc.ref.set(resolved.downgradePatch, { merge: true }).catch((err) => {
        console.warn("⚠️ Không thể lưu trạng thái hết hạn:", err.message);
      });
    }

    // 1. Phải là thành viên VIP còn hạn HOẶC có số lượt aiCredits > 0
    if (!resolved.isVipActive && resolved.aiCredits <= 0) {
      return res.status(403).json({
        success: false,
        code: "AI_FILTER_VIP_REQUIRED",
        message: "Tính năng AI Filter chỉ dành cho thành viên VIP hoặc người có lượt chụp AI. Vui lòng nạp gói để tiếp tục!",
        data: {
          title: "Cần nâng cấp",
          description: "Nâng cấp VIP hoặc nạp thêm lượt AI để sử dụng AI Filter.",
        },
      });
    }

    // 2. Phải còn số lượt tạo ảnh (aiCredits > 0)
    if (resolved.aiCredits <= 0) {
      return res.status(403).json({
        success: false,
        code: "AI_FILTER_OUT_OF_CREDITS",
        message: "Bạn đã hết lượt tạo ảnh AI. Vui lòng nạp thêm gói để tiếp tục!",
        data: {
          title: "Hết lượt tạo ảnh AI",
          description: "Mua thêm gói lượt tạo ảnh AI tại trang Nâng cấp.",
        },
      });
    }

    req.aiFilterAccess = true;
    req.approvedDocRef = approvedDoc.ref;
    req.aiCredits = resolved.aiCredits;
    return next();
  } catch (error) {
    console.error("❌ Lỗi kiểm tra quyền AI Filter:", error);
    return res.status(500).json({
      success: false,
      message: "Không kiểm tra được quyền AI Filter",
    });
  }
};

module.exports = {
  requireAiFilterAccess,
};
