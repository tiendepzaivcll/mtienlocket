const { logInfo, logError } = require("../utils/logEventUtils");

/**
 * Middleware kiểm tra VIP expiry
 * Hết hạn VIP => Reject request với 403
 * Không có VIP => Reject request với 403
 */
const checkVipExpiry = async (req, res, next) => {
  try {
    // Lazy load db to avoid circular dependency
    let db;
    try {
      db = require("../config/firebase-admin-config").db;
    } catch (err) {
      console.warn("⚠️ Firebase module not available, skipping VIP check");
      return next();
    }

    // Nếu db is null, Firebase init failed
    if (!db) {
      console.warn("⚠️ Firebase DB not initialized, allowing request through");
      return next();
    }

    const userEmail = req.user?.email;
    const userLocalId = req.user?.localId; // Firebase user_id from JWT

    if (!userEmail) {
      return res.status(401).json({
        success: false,
        message: "Không tìm thấy email người dùng",
      });
    }

    if (!userLocalId) {
      return res.status(401).json({
        success: false,
        message: "Không tìm thấy Firebase ID người dùng",
      });
    }

    // Normalize email
    const normalizedEmail = userEmail.toLowerCase();

    // Tìm VIP data từ Firebase
    try {
      const docRef = db.collection("subscriptions").doc(normalizedEmail);
      const doc = await docRef.get();

      if (!doc.exists) {
        logInfo(
          "checkVipExpiry",
          `❌ VIP deleted: ${userEmail} (email removed from subscriptions)`
        );
        return res.status(403).json({
          success: false,
          message: "Gói VIP của bạn đã bị xóa khỏi hệ thống",
          code: "VIP_DELETED",
        });
      }

      const vipData = doc.data();
      let { expireAt, uid: vipUid } = vipData;

      // 🔄 AUTO-POPULATE: If localId is missing, add it to Firestore
      if (!vipUid) {
        logInfo(
          "checkVipExpiry",
          `🔄 Auto-adding Firebase ID to ${userEmail}: ${userLocalId}`
        );
        try {
          await docRef.update({ uid: userLocalId });
          vipUid = userLocalId; // Update local var for next check
        } catch (updateErr) {
          logError("checkVipExpiry - Auto-update Firebase ID", updateErr.message);
          // Don't fail here, continue with check
        }
      }

      // ✅ VERIFY: Check if Firebase ID matches
      if (vipUid && vipUid !== userLocalId) {
        logInfo(
          "checkVipExpiry",
          `❌ Firebase ID mismatch: request ID=${userLocalId}, VIP ID=${vipUid}`
        );
        return res.status(403).json({
          success: false,
          message: "Firebase ID không khớp với dữ liệu VIP đã lưu",
          code: "VIP_UID_MISMATCH",
        });
      }
      const now = Date.now();
      const remainingMs = expireAt - now;
      const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));

      // 📅 Kiểm tra hết hạn
      if (expireAt < now) {
        logInfo(
          "checkVipExpiry",
          `❌ VIP hết hạn: ${userEmail} (expireAt: ${new Date(expireAt).toISOString()})`
        );
        return res.status(403).json({
          success: false,
          message: "Gói VIP của bạn đã hết hạn",
          code: "VIP_EXPIRED",
          expiredAt: expireAt,
        });
      }

      // ✅ VIP còn hạn
      logInfo(
        "checkVipExpiry",
        `✅ VIP hợp lệ: ${userEmail} (${remainingDays} ngày còn lại)`
      );

      // VIP còn hạn - thêm vào request
      req.vip = {
        email: normalizedEmail,
        expireAt,
        remainingDays,
      };

      logInfo("checkVipExpiry", `✅ VIP hợp lệ: ${userEmail}`);
      next();
    } catch (firebaseError) {
      logError("checkVipExpiry - Firebase Error", firebaseError.message);
      console.warn(
        "⚠️ Firebase query failed, allowing request through:",
        firebaseError.message
      );
      // Nếu lỗi Firebase, cho qua (tránh crash nếu Firestore tạm thời lỗi)
      next();
    }
  } catch (error) {
    logError("checkVipExpiry", error.message);
    console.error("❌ checkVipExpiry critical error:", error);
    // Không return 500, chỉ log và cho qua
    next();
  }
};

module.exports = checkVipExpiry;
