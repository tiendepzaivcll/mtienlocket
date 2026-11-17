const jwt = require("jsonwebtoken");
const { admin, db } = require("../config/firebase-admin-config");

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || ADMIN_PASSWORD;
const APPROVED_USER_COLLECTION = "approved_users";
const ACCESS_ROLES = new Set(["vip", "celebrity"]);

const normalizeUsername = (value = "") =>
  String(value || "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase();

const normalizeRole = (value = "vip") =>
  ACCESS_ROLES.has(String(value || "").trim().toLowerCase())
    ? String(value).trim().toLowerCase()
    : "vip";

const getNow = () =>
  admin?.firestore?.FieldValue?.serverTimestamp
    ? admin.firestore.FieldValue.serverTimestamp()
    : new Date().toISOString();

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

      const snapshot = await db.collection(APPROVED_USER_COLLECTION).orderBy("username").get();
      const users = snapshot.docs.map((doc) => ({
        id: doc.id,
        username: doc.data().username || doc.id,
        role: normalizeRole(doc.data().role),
        active: doc.data().active !== false,
        aiFilterEnabled: doc.data().aiFilterEnabled === true,
        note: doc.data().note || "",
        createdAt: doc.data().createdAt || null,
        updatedAt: doc.data().updatedAt || null,
      }));

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
      if (!ACCESS_ROLES.has(requestedRole)) {
        return res.status(400).json({ success: false, message: "Quyền truy cập không hợp lệ" });
      }

      const role = normalizeRole(requestedRole);

      const ref = db.collection(APPROVED_USER_COLLECTION).doc(username);
      await ref.set(
        {
          username,
          role,
          active: true,
          aiFilterEnabled,
          note,
          createdAt: getNow(),
          updatedAt: getNow(),
        },
        { merge: true },
      );

      res.status(201).json({
        success: true,
        data: {
          id: username,
          username,
          role,
          active: true,
          aiFilterEnabled,
          note,
        },
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

      const data = {
        updatedAt: getNow(),
      };

      if (typeof req.body?.active === "boolean") {
        data.active = req.body.active;
      }
      if (typeof req.body?.aiFilterEnabled === "boolean") {
        data.aiFilterEnabled = req.body.aiFilterEnabled;
      }
      if (typeof req.body?.note === "string") {
        data.note = req.body.note.trim();
      }
      if (req.body?.role !== undefined) {
        const requestedRole = String(req.body.role || "").trim().toLowerCase();
        if (!ACCESS_ROLES.has(requestedRole)) {
          return res.status(400).json({ success: false, message: "Quyền truy cập không hợp lệ" });
        }
        data.role = requestedRole;
      }

      await db.collection(APPROVED_USER_COLLECTION).doc(username).set(data, { merge: true });
      res.status(200).json({ success: true, message: "Đã cập nhật" });
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
      const snapshot = await db.collection("subscriptions").get();
      const emails = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.status(200).json({ success: true, data: emails });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // === THÊM VIP MỚI ===
  async addVipEmail(req, res) {
    try {
      const data = req.body;
      const docRef = await db.collection("subscriptions").add(data);
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
      await db.collection("subscriptions").doc(id).update(data);
      res.status(200).json({ success: true, message: "Đã cập nhật thành công" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // === XÓA VIP ===
  async deleteVipEmail(req, res) {
    try {
      const { id } = req.params;
      await db.collection("subscriptions").doc(id).delete();
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

      res.status(200).json({ success: true, data: orders });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // === LẤY DANH SÁCH SUBSCRIPTIONS (VIP) ===
  async listSubscriptions(req, res) {
    try {
      if (!db) {
        return res.status(500).json({ success: false, message: "Firestore chưa sẵn sàng" });
      }

      const snapshot = await db.collection("subscriptions").get();
      const now = Date.now();
      const subs = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          username: data.username || doc.id,
          planId: data.planId || null,
          planName: data.planName || null,
          planDays: data.planDays || null,
          expireAt: data.expireAt || null,
          isExpired: data.expireAt ? data.expireAt < now : true,
          lastPayment: data.lastPayment || null,
          createdAt: data.createdAt || null,
          updatedAt: data.updatedAt || null,
          email: data.email || null,
        };
      });

      // Sort: active first, then by expireAt desc
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
      const snapshot = await db.collection("subscriptions").get();
      const seen = new Set();
      const duplicates = [];
      
      snapshot.forEach(doc => {
        const email = doc.data().email;
        if (seen.has(email)) {
          duplicates.push(doc.id);
        } else {
          seen.add(email);
        }
      });

      // Lặp qua mảng rác và xóa
      for (const id of duplicates) {
        await db.collection("subscriptions").doc(id).delete();
      }

      res.status(200).json({ success: true, message: `Đã dọn dẹp sạch sẽ ${duplicates.length} mục trùng lặp!` });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = new AdminController();
