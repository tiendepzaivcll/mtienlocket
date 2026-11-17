// File: controllers/payment.controller.js
// PayOS + Firestore payment system for VIP subscriptions
// Self-service: users enter their username, pick a plan, pay, VIP auto-activates

const crypto = require("crypto");
const { db } = require("../config/firebase-admin-config");

// ─── Plan definitions ───────────────────────────────────────────────
const VIP_PLANS = [
  {
    id: "vip_1month",
    name: "VIP 1 Tháng",
    description: "Trải nghiệm đầy đủ tính năng VIP trong 1 tháng",
    price: 25000,
    days: 30,
    badge: null,
  },
  {
    id: "vip_6months",
    name: "VIP 6 Tháng",
    description: "Tiết kiệm 34% so với gói tháng",
    price: 99000,
    days: 180,
    badge: "Phổ biến",
  },
  {
    id: "vip_1year",
    name: "VIP 1 Năm",
    description: "Tiết kiệm 50% — ưu đãi tốt nhất",
    price: 149000,
    days: 365,
    badge: "Tốt nhất",
  },
];

const VIP_FEATURES = {
  free: {
    videoLength: "5 giây",
    streakRestore: "0 lần/tháng",
    photoboothFrames: "3 khung cơ bản",
    aiFilters: "Không có",
    uploadQuality: "Tiêu chuẩn",
    seenStatus: false,
    caption: "Cơ bản",
  },
  vip: {
    videoLength: "30 giây",
    streakRestore: "Không giới hạn",
    photoboothFrames: "Tất cả khung",
    aiFilters: "Đầy đủ bộ lọc AI",
    uploadQuality: "HD cao nhất",
    seenStatus: true,
    caption: "Đầy đủ + tuỳ chỉnh",
  },
};

const PLANS_MAP = new Map(VIP_PLANS.map((p) => [p.id, p]));

// ─── PayOS helpers ──────────────────────────────────────────────────
const PAYOS_CLIENT_ID = () => process.env.PAYOS_CLIENT_ID;
const PAYOS_API_KEY = () => process.env.PAYOS_API_KEY;
const PAYOS_CHECKSUM_KEY = () => process.env.PAYOS_CHECKSUM_KEY;
const PAYOS_API_URL = "https://api-merchant.payos.vn";

const sortObjKeys = (obj) => {
  const sorted = {};
  Object.keys(obj)
    .sort()
    .forEach((key) => {
      sorted[key] = obj[key];
    });
  return sorted;
};

const createSignature = (data, checksumKey) => {
  const sorted = sortObjKeys(data);
  const raw = Object.entries(sorted)
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return crypto.createHmac("sha256", checksumKey).update(raw).digest("hex");
};

const verifyWebhookSignature = (data, receivedSignature) => {
  const checksumKey = PAYOS_CHECKSUM_KEY();
  if (!checksumKey) return false;
  const computed = createSignature(data, checksumKey);
  return computed === receivedSignature;
};

// ─── Firestore collections ─────────────────────────────────────────
const ORDERS_COLLECTION = "payment_orders";
const SUBSCRIPTIONS_COLLECTION = "subscriptions";
const APPROVED_USERS_COLLECTION = "approved_users";

// ─── Controller ─────────────────────────────────────────────────────
class PaymentController {
  /**
   * GET /api/payment/plans
   * Public: trả về danh sách gói VIP
   */
  async getPlans(req, res) {
    return res.status(200).json({
      success: true,
      data: {
        plans: VIP_PLANS,
        features: VIP_FEATURES,
      },
    });
  }

  /**
   * POST /api/payment/create-order
   * PUBLIC — không cần đăng nhập
   * Body: { planId, username }
   * username = tên người dùng Locket (dùng để kích hoạt VIP sau thanh toán)
   */
  async createOrder(req, res) {
    try {
      const { planId, username } = req.body;

      if (!username || !String(username).trim()) {
        return res.status(400).json({
          success: false,
          message: "Vui lòng nhập tên người dùng (username)",
        });
      }

      const normalizedUsername = String(username).trim().replace(/^@+/, "").toLowerCase();

      if (!normalizedUsername) {
        return res.status(400).json({
          success: false,
          message: "Tên người dùng không hợp lệ",
        });
      }

      const plan = PLANS_MAP.get(planId);
      if (!plan) {
        return res.status(400).json({
          success: false,
          message: "Gói VIP không hợp lệ",
        });
      }

      const clientId = PAYOS_CLIENT_ID();
      const apiKey = PAYOS_API_KEY();
      const checksumKey = PAYOS_CHECKSUM_KEY();

      if (!clientId || !apiKey || !checksumKey) {
        console.error("❌ PayOS credentials not configured");
        return res.status(503).json({
          success: false,
          message: "Hệ thống thanh toán chưa được cấu hình",
        });
      }

      // Generate unique order code (must be numeric for PayOS, int32 range)
      const orderCode = Date.now() % 2147483647;

      const baseUrl = req.headers.origin || "https://locket-pro.online";
      const returnUrl =
        process.env.PAYOS_RETURN_URL || `${baseUrl}/payment/result`;
      const cancelUrl =
        process.env.PAYOS_CANCEL_URL || `${baseUrl}/pricing`;

      // Description includes username for reference
      const description = `${plan.name} - @${normalizedUsername}`;

      // Data for signature
      const signData = {
        amount: plan.price,
        cancelUrl,
        description: description.slice(0, 25), // PayOS limits description to 25 chars
        orderCode,
        returnUrl,
      };

      const signature = createSignature(signData, checksumKey);

      // Call PayOS API
      const axios = require("axios");
      const payosResponse = await axios.post(
        `${PAYOS_API_URL}/v2/payment-requests`,
        {
          orderCode,
          amount: plan.price,
          description: description.slice(0, 25),
          buyerName: normalizedUsername,
          cancelUrl,
          returnUrl,
          signature,
          items: [
            {
              name: plan.name,
              quantity: 1,
              price: plan.price,
            },
          ],
          expiredAt: Math.floor(Date.now() / 1000) + 30 * 60, // 30 phút
        },
        {
          headers: {
            "Content-Type": "application/json",
            "x-client-id": clientId,
            "x-api-key": apiKey,
          },
          timeout: 15000,
        },
      );

      const payosData = payosResponse.data?.data;

      if (!payosData) {
        console.error("❌ PayOS response empty:", payosResponse.data);
        return res.status(502).json({
          success: false,
          message: "Không thể tạo đơn thanh toán",
        });
      }

      // Save order to Firestore
      if (db) {
        await db.collection(ORDERS_COLLECTION).doc(String(orderCode)).set({
          orderCode,
          planId: plan.id,
          planName: plan.name,
          planDays: plan.days,
          price: plan.price,
          username: normalizedUsername,
          status: "PENDING",
          checkoutUrl: payosData.checkoutUrl,
          qrCode: payosData.qrCode,
          paymentLinkId: payosData.paymentLinkId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        console.log(`📦 Order created: #${orderCode} for @${normalizedUsername} - ${plan.name}`);
      }

      return res.status(200).json({
        success: true,
        data: {
          orderCode,
          checkoutUrl: payosData.checkoutUrl,
          qrCode: payosData.qrCode,
          amount: plan.price,
          planName: plan.name,
          planDays: plan.days,
          username: normalizedUsername,
        },
      });
    } catch (error) {
      console.error("❌ createOrder error:", error.response?.data || error.message);
      return res.status(500).json({
        success: false,
        message: "Lỗi tạo đơn thanh toán",
      });
    }
  }

  /**
   * GET /api/payment/order/:orderCode
   * PUBLIC: lấy thông tin đơn hàng (ai cũng xem được bằng orderCode)
   */
  async getOrder(req, res) {
    try {
      const { orderCode } = req.params;

      if (!db) {
        return res.status(503).json({
          success: false,
          message: "Database chưa sẵn sàng",
        });
      }

      const doc = await db
        .collection(ORDERS_COLLECTION)
        .doc(String(orderCode))
        .get();

      if (!doc.exists) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy đơn hàng",
        });
      }

      const order = doc.data();

      return res.status(200).json({
        success: true,
        data: order,
      });
    } catch (error) {
      console.error("❌ getOrder error:", error.message);
      return res.status(500).json({
        success: false,
        message: "Lỗi lấy thông tin đơn hàng",
      });
    }
  }

  /**
   * POST /api/payment/webhook
   * PayOS webhook: xử lý khi thanh toán thành công → auto kích hoạt VIP
   */
  async handleWebhook(req, res) {
    try {
      const body = req.body || {};
      const { code, data, signature } = body;

      console.log("🔔 PayOS webhook received:", JSON.stringify(body).slice(0, 500));

      // PayOS sends a test/verification webhook — always return 200
      if (!data && !code) {
        console.log("ℹ️ Webhook test/ping request — responding OK");
        return res.status(200).json({ success: true });
      }

      // Handle confirm webhook (PayOS sends this to verify URL)
      if (code === "00" && data && data.orderCode === 123) {
        console.log("ℹ️ PayOS confirm webhook test — responding OK");
        return res.status(200).json({ success: true });
      }

      // Verify signature (skip for test webhooks)
      if (data && signature && data.orderCode !== 123) {
        const isValid = verifyWebhookSignature(data, signature);
        if (!isValid) {
          console.warn("⚠️ Invalid webhook signature");
          return res.status(200).json({ success: false, message: "Invalid signature" });
        }
      }

      // code "00" = success
      if (code !== "00" || !data) {
        console.log("ℹ️ Webhook non-success code:", code);
        return res.status(200).json({ success: true });
      }

      const { orderCode, amount } = data;

      if (!db) {
        console.error("❌ Firestore not available for webhook");
        return res.status(200).json({ success: true });
      }

      // Get order from Firestore
      const orderRef = db.collection(ORDERS_COLLECTION).doc(String(orderCode));
      const orderDoc = await orderRef.get();

      if (!orderDoc.exists) {
        console.warn(`⚠️ Order ${orderCode} not found in Firestore`);
        return res.status(200).json({ success: true });
      }

      const order = orderDoc.data();

      // Skip if already processed
      if (order.status === "PAID") {
        console.log(`ℹ️ Order ${orderCode} already processed`);
        return res.status(200).json({ success: true });
      }

      // Update order status
      await orderRef.update({
        status: "PAID",
        paidAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        payosData: data,
      });

      // ─── Auto-activate VIP by username ──────────────────────
      await this._activateVip(order);

      console.log(
        `✅ Payment confirmed & VIP activated: order #${orderCode} for @${order.username} - ${order.planName}`,
      );

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("❌ Webhook error:", error.message);
      return res.status(200).json({ success: true });
    }
  }

  /**
   * Internal: kích hoạt VIP cho user dựa trên username
   */
  async _activateVip(order) {
    const { username, planId, planName, planDays, price, orderCode } = order;
    const now = Date.now();

    // 1) Update or create approved_users doc for this username
    const approvedRef = db.collection(APPROVED_USERS_COLLECTION).doc(username);
    const approvedDoc = await approvedRef.get();

    if (approvedDoc.exists) {
      await approvedRef.update({
        role: "vip",
        vipPlanId: planId,
        vipPlanName: planName,
        vipExpireAt: now + planDays * 24 * 60 * 60 * 1000,
        lastPayment: {
          orderCode,
          amount: price,
          paidAt: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      });
    } else {
      // Create new approved_users entry with VIP role
      await approvedRef.set({
        role: "vip",
        active: true,
        approved: true,
        enabled: true,
        aiFilterEnabled: true,
        vipPlanId: planId,
        vipPlanName: planName,
        vipExpireAt: now + planDays * 24 * 60 * 60 * 1000,
        lastPayment: {
          orderCode,
          amount: price,
          paidAt: new Date().toISOString(),
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // 2) Also update subscriptions by username (for checkVipExpiry middleware)
    const subRef = db.collection(SUBSCRIPTIONS_COLLECTION).doc(username);
    const subDoc = await subRef.get();

    let newExpireAt;
    if (subDoc.exists) {
      const existing = subDoc.data();
      const currentExpiry = existing.expireAt || 0;
      const baseTime = currentExpiry > now ? currentExpiry : now;
      newExpireAt = baseTime + planDays * 24 * 60 * 60 * 1000;
    } else {
      newExpireAt = now + planDays * 24 * 60 * 60 * 1000;
    }

    await subRef.set(
      {
        username,
        planId,
        planName,
        planDays,
        expireAt: newExpireAt,
        lastPayment: {
          orderCode,
          amount: price,
          paidAt: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
        ...(subDoc.exists ? {} : { createdAt: new Date().toISOString() }),
      },
      { merge: true },
    );

    console.log(`🎖️ VIP activated: @${username} → ${planName}, expires ${new Date(newExpireAt).toISOString()}`);
  }

  /**
   * POST /api/payment/check-order/:orderCode
   * PUBLIC: kiểm tra lại trạng thái đơn hàng từ PayOS
   */
  async recheckOrder(req, res) {
    try {
      const { orderCode } = req.params;

      if (!db) {
        return res.status(503).json({
          success: false,
          message: "Database chưa sẵn sàng",
        });
      }

      const orderRef = db.collection(ORDERS_COLLECTION).doc(String(orderCode));
      const orderDoc = await orderRef.get();

      if (!orderDoc.exists) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy đơn hàng",
        });
      }

      const order = orderDoc.data();

      // Already paid? Return cached
      if (order.status === "PAID") {
        return res.status(200).json({
          success: true,
          data: { ...order, status: "PAID" },
        });
      }

      // Query PayOS for real-time status
      const clientId = PAYOS_CLIENT_ID();
      const apiKey = PAYOS_API_KEY();
      if (clientId && apiKey) {
        try {
          const axios = require("axios");
          const payosRes = await axios.get(
            `${PAYOS_API_URL}/v2/payment-requests/${orderCode}`,
            {
              headers: {
                "x-client-id": clientId,
                "x-api-key": apiKey,
              },
              timeout: 10000,
            },
          );
          const payosStatus = payosRes.data?.data?.status;

          if (payosStatus === "PAID" && order.status !== "PAID") {
            await orderRef.update({
              status: "PAID",
              paidAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });

            // Auto-activate VIP
            await this._activateVip(order);

            console.log(`✅ VIP auto-activated via recheck for @${order.username}`);
            return res.status(200).json({
              success: true,
              data: { ...order, status: "PAID" },
            });
          }

          if (payosStatus === "CANCELLED") {
            await orderRef.update({
              status: "CANCELLED",
              updatedAt: new Date().toISOString(),
            });
            return res.status(200).json({
              success: true,
              data: { ...order, status: "CANCELLED" },
            });
          }
        } catch (payosErr) {
          console.warn("⚠️ PayOS recheck failed:", payosErr.message);
        }
      }

      return res.status(200).json({
        success: true,
        data: order,
      });
    } catch (error) {
      console.error("❌ recheckOrder error:", error.message);
      return res.status(500).json({
        success: false,
        message: "Lỗi kiểm tra đơn hàng",
      });
    }
  }
}

module.exports = new PaymentController();
