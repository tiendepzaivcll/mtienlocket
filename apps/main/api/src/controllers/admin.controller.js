const jwt = require("jsonwebtoken");
const { admin, db } = require("../config/firebase-admin-config");
const {
  VALID_ROLES,
  normalizeAccessRole,
  resolveAdminVipSelection,
  resolveAdminAiSelection,
  resolveEffectiveAccess,
  toTimestampMs,
} = require("../utils/accessPlans");

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || ADMIN_PASSWORD;
const APPROVED_USER_COLLECTION = "approved_users";
const SUBSCRIPTIONS_COLLECTION = "subscriptions";

const normalizeUsername = (value = "") =>
  String(value || "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase();

const getNow = () =>
  admin?.firestore?.FieldValue?.serverTimestamp
    ? admin.firestore.FieldValue.serverTimestamp()
    : new Date().toISOString();

const formatAdminUserDoc = (id, data = {}, resolved = resolveEffectiveAccess(data)) => ({
  id,
  username: data.username || id,
  role: resolved.effectiveRole,
  active: data.active !== false,
  aiFilterEnabled: resolved.effectiveAiEnabled,
  aiCredits: resolved.aiCredits,
  hasUsedTrial: resolved.hasUsedTrial,
  note: data.note || "",
  vipPlanId: resolved.vipPlanId,
  vipPlanName: resolved.vipPlanName,
  vipPlanDays: resolved.vipPlanDays,
  vipExpireAt: resolved.vipExpireAt,
  lastExpiredVipPlan: resolved.lastExpiredVipPlan || null,
  lastExpiredVipAt: resolved.lastExpiredVipAt || null,
  lastPayment: data.lastPayment || null,
  createdAt: data.createdAt || null,
  updatedAt: data.updatedAt || null,
});

class AdminController {
  // === ĐĂNG NHẬP ===
  async login(req, res) {
    const { password } = req.body;
    if (!ADMIN_PASSWORD || !JWT_SECRET) {
      return res.status(500).json({
        success: false,
        message: "Chưa cấu hình ADMIN_PASSWORD",
      });
    }

    if (password === ADMIN_PASSWORD) {
      const token = jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: "24h" });
      return res.status(200).json({ success: true, token });
    }
    return res.status(401).json({ success: false, message: "Sai mật khẩu" });
  }

  // === MIDDLEWARE XÁC THỰC ===
  verifyAdmin(req, res, next) {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ success: false, message: "Thiếu token" });

    try {
      const claims = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
      if (claims.role !== "admin") return res.status(403).json({ success: false, message: "Cần quyền admin" });
      next();
    } catch (error) {
      return res.status(403).json({ success: false, message: "Token không hợp lệ hoặc đã hết hạn" });
    }
  }

  async listApprovedUsers(req, res) {
    try {
      if (!db) {
        return res.status(500).json({ success: false, message: "Firestore chưa sẵn sàng" });
      }

      const snapshot = await db.collection(APPROVED_USER_COLLECTION).get();
      const now = Date.now();
      const persistPromises = [];

      const users = snapshot.docs.map((doc) => {
        const raw = doc.data() || {};
        const resolved = resolveEffectiveAccess(raw, now);
        if (resolved.needsPersist) {
          persistPromises.push(
            doc.ref.set(resolved.downgradePatch, { merge: true }).catch((err) => {
              console.warn(`⚠️ Không lưu được trạng thái hết hạn cho @${doc.id}:`, err.message);
            }),
          );
        }
        return formatAdminUserDoc(doc.id, raw, resolved);
      });

      if (persistPromises.length > 0) {
        await Promise.all(persistPromises);
      }

      users.sort((a, b) => (a.username || "").localeCompare(b.username || ""));

      res.status(200).json({ success: true, data: users });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async addApprovedUser(req, res) {
    try {
      if (!db) {
        return res.status(500).json({ success: false, message: "Firestore chưa sẵn sàng" });
      }

      const username = normalizeUsername(req.body?.username);
      const note = String(req.body?.note || "").trim();
      const requestedRole = String(req.body?.role || "vip").trim().toLowerCase();
      const aiFilterEnabled = req.body?.aiFilterEnabled === true;

      if (!username) {
        return res.status(400).json({ success: false, message: "Thiếu username" });
      }
      if (!VALID_ROLES.has(requestedRole)) {
        return res.status(400).json({ success: false, message: "Quyền truy cập không hợp lệ" });
      }

      const role = normalizeAccessRole(requestedRole, "vip");
      const now = Date.now();
      const nowIso = new Date(now).toISOString();

      let vipFields = {
        vipPlanId: null,
        vipPlanName: null,
        vipPlanDays: null,
        vipExpireAt: null,
      };

      if (role === "vip") {
        vipFields = resolveAdminVipSelection(
          {
            vipPlanId: req.body?.vipPlanId,
            planDays: req.body?.planDays,
          },
          now,
        );
      }

      let aiFields = {
        aiFilterEnabled: false,
        aiFilterPlanId: null,
        aiFilterPlanName: null,
        aiFilterPlanDays: null,
        aiFilterExpireAt: null,
      };

      if (aiFilterEnabled) {
        aiFields = {
          aiFilterEnabled: true,
          ...resolveAdminAiSelection(
            {
              aiFilterPlanId: req.body?.aiFilterPlanId,
              aiFilterPlanDays: req.body?.aiFilterPlanDays,
            },
            now,
          ),
        };
      }

      const ref = db.collection(APPROVED_USER_COLLECTION).doc(username);
      const record = {
        username,
        role,
        active: true,
        approved: true,
        enabled: true,
        note,
        ...vipFields,
        ...aiFields,
        createdAt: getNow(),
        updatedAt: getNow(),
      };

      await ref.set(record, { merge: true });

      if (role === "vip") {
        await db.collection(SUBSCRIPTIONS_COLLECTION).doc(username).set(
          {
            username,
            category: "vip",
            planId: vipFields.vipPlanId,
            planName: vipFields.vipPlanName,
            planDays: vipFields.vipPlanDays || null,
            expireAt: vipFields.vipExpireAt || null,
            updatedAt: nowIso,
            createdAt: nowIso,
          },
          { merge: true },
        );
      }

      if (aiFilterEnabled && aiFields.aiFilterExpireAt) {
        await db.collection(SUBSCRIPTIONS_COLLECTION).doc(`${username}__ai_filter`).set(
          {
            username,
            category: "ai_filter",
            planId: aiFields.aiFilterPlanId,
            planName: aiFields.aiFilterPlanName,
            planDays: aiFields.aiFilterPlanDays,
            expireAt: aiFields.aiFilterExpireAt,
            updatedAt: nowIso,
            createdAt: nowIso,
          },
          { merge: true },
        );
      }

      const savedDoc = await ref.get();
      const savedData = savedDoc.data() || record;

      res.status(201).json({
        success: true,
        data: formatAdminUserDoc(username, savedData),
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async updateApprovedUser(req, res) {
    try {
      if (!db) {
        return res.status(500).json({ success: false, message: "Firestore chưa sẵn sàng" });
      }

      const username = normalizeUsername(req.params.username);
      if (!username) {
        return res.status(400).json({ success: false, message: "Thiếu username" });
      }

      const now = Date.now();
      const nowIso = new Date(now).toISOString();
      const ref = db.collection(APPROVED_USER_COLLECTION).doc(username);
      const existingSnap = await ref.get();
      const existing = existingSnap.exists ? existingSnap.data() || {} : {};

      const data = {
        username,
        updatedAt: getNow(),
      };

      if (typeof req.body?.active === "boolean") {
        data.active = req.body.active;
      }
      if (typeof req.body?.note === "string") {
        data.note = req.body.note.trim();
      }

      if (req.body?.role !== undefined) {
        const requestedRole = String(req.body.role || "").trim().toLowerCase();
        if (!VALID_ROLES.has(requestedRole)) {
          return res.status(400).json({ success: false, message: "Quyền truy cập không hợp lệ" });
        }
        data.role = requestedRole;

        if (requestedRole !== "vip") {
          data.vipPlanId = null;
          data.vipPlanName = null;
          data.vipPlanDays = null;
          data.vipExpireAt = null;
        } else if (
          req.body?.vipPlanId === undefined &&
          req.body?.planDays === undefined &&
          !existing.vipPlanName
        ) {
          // Default to VIP 1 Tháng if upgraded from Free without specifying plan, or keep existing
          const vipSel = resolveAdminVipSelection({ vipPlanId: "vip_1month" }, now);
          Object.assign(data, vipSel);
        }
      }

      if (req.body?.vipPlanId !== undefined || req.body?.planDays !== undefined) {
        data.role = "vip";
        const vipSel = resolveAdminVipSelection(
          {
            vipPlanId: req.body?.vipPlanId,
            planDays: req.body?.planDays,
          },
          now,
        );
        Object.assign(data, vipSel);

        if (vipSel.vipPlanId) {
          await db.collection(SUBSCRIPTIONS_COLLECTION).doc(username).set(
            {
              username,
              category: "vip",
              planId: vipSel.vipPlanId,
              planName: vipSel.vipPlanName,
              planDays: vipSel.vipPlanDays || null,
              expireAt: vipSel.vipExpireAt || null,
              updatedAt: nowIso,
            },
            { merge: true },
          );
        }
      }

      if (typeof req.body?.aiFilterEnabled === "boolean") {
        data.aiFilterEnabled = req.body.aiFilterEnabled;
        if (!req.body.aiFilterEnabled) {
          data.aiFilterPlanId = null;
          data.aiFilterPlanName = null;
          data.aiFilterPlanDays = null;
          data.aiFilterExpireAt = null;
        } else if (
          req.body?.aiFilterPlanId !== undefined ||
          req.body?.aiFilterPlanDays !== undefined
        ) {
          Object.assign(
            data,
            resolveAdminAiSelection(
              {
                aiFilterPlanId: req.body?.aiFilterPlanId,
                aiFilterPlanDays: req.body?.aiFilterPlanDays,
              },
              now,
            ),
          );
        } else if (!existing.aiFilterPlanName) {
          Object.assign(data, resolveAdminAiSelection({ aiFilterPlanId: "ai_lifetime" }, now));
        }
      } else if (
        req.body?.aiFilterPlanId !== undefined ||
        req.body?.aiFilterPlanDays !== undefined
      ) {
        data.aiFilterEnabled = true;
        const aiSel = resolveAdminAiSelection(
          {
            aiFilterPlanId: req.body?.aiFilterPlanId,
            aiFilterPlanDays: req.body?.aiFilterPlanDays,
          },
          now,
        );
        Object.assign(data, aiSel);
      }

      if (req.body?.aiCredits !== undefined) {
        data.aiCredits = Math.max(0, Number(req.body.aiCredits) || 0);
        data.aiFilterEnabled = data.aiCredits > 0;
      }

      if (typeof req.body?.hasUsedTrial === "boolean") {
        data.hasUsedTrial = req.body.hasUsedTrial;
      }

      await ref.set(data, { merge: true });
      const updatedSnap = await ref.get();
      const updatedData = updatedSnap.data() || { ...existing, ...data };

      res.status(200).json({
        success: true,
        message: "Đã cập nhật",
        data: formatAdminUserDoc(username, updatedData),
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async deleteApprovedUser(req, res) {
    try {
      if (!db) {
        return res.status(500).json({ success: false, message: "Firestore chưa sẵn sàng" });
      }

      const username = normalizeUsername(req.params.username);
      if (!username) {
        return res.status(400).json({ success: false, message: "Thiếu username" });
      }

      await db.collection(APPROVED_USER_COLLECTION).doc(username).delete();
      res.status(200).json({ success: true, message: "Đã xoá" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // === LẤY DANH SÁCH VIP ===
  async getVipEmails(req, res) {
    try {
      const snapshot = await db.collection(SUBSCRIPTIONS_COLLECTION).get();
      const emails = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      res.status(200).json({ success: true, data: emails });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // === THÊM VIP MỚI ===
  async addVipEmail(req, res) {
    try {
      const data = req.body;
      const docRef = await db.collection(SUBSCRIPTIONS_COLLECTION).add(data);
      res.status(201).json({ success: true, id: docRef.id, ...data });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // === CẬP NHẬT VIP ===
  async updateVipEmail(req, res) {
    try {
      const { id } = req.params;
      const data = req.body;
      await db.collection(SUBSCRIPTIONS_COLLECTION).doc(id).update(data);
      res.status(200).json({ success: true, message: "Đã cập nhật thành công" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // === XÓA VIP ===
  async deleteVipEmail(req, res) {
    try {
      const { id } = req.params;
      await db.collection(SUBSCRIPTIONS_COLLECTION).doc(id).delete();
      res.status(200).json({ success: true, message: "Đã xóa thành công" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // === LẤY DANH SÁCH PAYMENT ORDERS ===
  async listPaymentOrders(req, res) {
    try {
      if (!db) {
        return res.status(500).json({ success: false, message: "Firestore chưa sẵn sàng" });
      }

      const snapshot = await db
        .collection("payment_orders")
        .orderBy("createdAt", "desc")
        .limit(200)
        .get();

      const orders = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Lấy cấu hình reset doanh thu nếu có
      let revenueSettings = null;
      try {
        const revDoc = await db.collection("server_settings").doc("revenue_settings").get();
        if (revDoc.exists) revenueSettings = revDoc.data();
      } catch {
        // ignore
      }

      res.status(200).json({ success: true, data: orders, revenueSettings });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // === XOÁ 1 ĐƠN HÀNG THANH TOÁN (ADMIN) ===
  async deletePaymentOrder(req, res) {
    try {
      if (!db) {
        return res.status(500).json({ success: false, message: "Firestore chưa sẵn sàng" });
      }
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ success: false, message: "Thiếu id đơn hàng" });
      }
      await db.collection("payment_orders").doc(String(id)).delete();
      res.status(200).json({ success: true, message: "Đã xoá đơn hàng thành công" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // === DỌN DẸP TOÀN BỘ ĐƠN HÀNG ĐÃ HUỶ / HẾT HẠN (ADMIN) ===
  async cleanupPaymentOrders(req, res) {
    try {
      if (!db) {
        return res.status(500).json({ success: false, message: "Firestore chưa sẵn sàng" });
      }
      const snapshot = await db.collection("payment_orders").get();
      const now = Date.now();
      let deletedCount = 0;
      const batch = db.batch();

      snapshot.docs.forEach((doc) => {
        const data = doc.data() || {};
        const isCancelled = data.status === "CANCELLED";
        const isExpiredPending =
          data.status === "PENDING" &&
          ((data.expiresAt && new Date(data.expiresAt).getTime() < now) ||
            (data.createdAt && new Date(data.createdAt).getTime() < now - 10 * 60 * 1000));

        if (isCancelled || isExpiredPending) {
          batch.delete(doc.ref);
          deletedCount++;
        }
      });

      if (deletedCount > 0) {
        await batch.commit();
      }

      res.status(200).json({
        success: true,
        message: `Đã dọn dẹp ${deletedCount} đơn hàng đã huỷ / hết hạn`,
        deletedCount,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // === RESET DOANH THU (LƯU MỐC ĐÃ CHỐT VÀO LỊCH SỬ) ===
  async resetRevenue(req, res) {
    try {
      if (!db) {
        return res.status(500).json({ success: false, message: "Firestore chưa sẵn sàng" });
      }
      const nowIso = new Date().toISOString();
      const settingsRef = db.collection("server_settings").doc("revenue_settings");
      await settingsRef.set(
        {
          lastResetAt: nowIso,
          updatedAt: nowIso,
        },
        { merge: true },
      );
      res.status(200).json({
        success: true,
        message: "Đã reset doanh thu thành công. Doanh thu trước mốc này đã được lưu vào lịch sử.",
        lastResetAt: nowIso,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // === LẤY DANH SÁCH SUBSCRIPTIONS (VIP & AI FILTER) ===
  async listSubscriptions(req, res) {
    try {
      if (!db) {
        return res.status(500).json({ success: false, message: "Firestore chưa sẵn sàng" });
      }

      const snapshot = await db.collection(SUBSCRIPTIONS_COLLECTION).get();
      const now = Date.now();
      const subs = snapshot.docs.map((doc) => {
        const data = doc.data();
        const expireAt = toTimestampMs(data.expireAt);
        return {
          id: doc.id,
          username: data.username || doc.id.replace(/__ai_filter$/, ""),
          category:
            data.category ||
            (String(data.planId || "").startsWith("ai_") || doc.id.endsWith("__ai_filter")
              ? "ai_filter"
              : "vip"),
          planId: data.planId || null,
          planName: data.planName || null,
          planDays: data.planDays || null,
          expireAt,
          isExpired: expireAt ? expireAt < now : true,
          lastPayment: data.lastPayment || null,
          createdAt: data.createdAt || null,
          updatedAt: data.updatedAt || null,
          email: data.email || null,
        };
      });

      subs.sort((a, b) => {
        if (a.isExpired !== b.isExpired) return a.isExpired ? 1 : -1;
        return (b.expireAt || 0) - (a.expireAt || 0);
      });

      res.status(200).json({ success: true, data: subs });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // === XÓA TRÙNG LẶP (QUÉT RÁC) ===
  async removeDuplicates(req, res) {
    try {
      const snapshot = await db.collection(SUBSCRIPTIONS_COLLECTION).get();
      const seen = new Set();
      const duplicates = [];

      snapshot.forEach((doc) => {
        const email = doc.data().email;
        if (email && seen.has(email)) {
          duplicates.push(doc.id);
        } else if (email) {
          seen.add(email);
        }
      });

      for (const id of duplicates) {
        await db.collection(SUBSCRIPTIONS_COLLECTION).doc(id).delete();
      }

      res.status(200).json({
        success: true,
        message: `Đã dọn dẹp sạch sẽ ${duplicates.length} mục trùng lặp!`,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = new AdminController();
