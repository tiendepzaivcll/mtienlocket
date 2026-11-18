// File: controllers/payment.controller.js
// PayOS + Firestore payment system for VIP & AI Filter subscriptions
// Self-service: users enter their username, pick a plan, pay, entitlement auto-activates

const crypto = require("crypto");
const axios = require("axios");
const { db } = require("../config/firebase-admin-config");
const {
  DAY_MS,
  VIP_PLANS,
  AI_FILTER_PLANS,
  PLANS_MAP,
  toTimestampMs,
  resolveEffectiveAccess,
} = require("../utils/accessPlans");

const VIP_FEATURES = {
  free: {
    videoLength: "10 giây",
    streakRestore: "Không hỗ trợ",
    photoboothFrames: "Không hỗ trợ",
    aiFilters: "Bán riêng",
    uploadQuality: "HD",
    seenStatus: false,
    caption: "General & Holiday",
  },
  vip: {
    videoLength: "30 giây",
    streakRestore: "Không giới hạn",
    photoboothFrames: "Tất cả khung",
    aiFilters: "Bán riêng",
    uploadQuality: "HD cao nhất",
    seenStatus: true,
    caption: "Đầy đủ + tuỳ chỉnh",
  },
};

// ─── PayOS helpers ──────────────────────────────────────────────────
const PAYOS_CLIENT_ID = () => process.env.PAYOS_CLIENT_ID;
const PAYOS_API_KEY = () => process.env.PAYOS_API_KEY;
const PAYOS_CHECKSUM_KEY = () => process.env.PAYOS_CHECKSUM_KEY;
const PAYOS_API_URL = "https://api-merchant.payos.vn";

const sortObjKeys = (obj) => {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;
  const sorted = {};
  Object.keys(obj)
    .sort()
    .forEach((key) => {
      const val = obj[key];
      if (val && typeof val === "object" && !Array.isArray(val)) {
        sorted[key] = sortObjKeys(val);
      } else if (Array.isArray(val)) {
        sorted[key] = val.map((item) =>
          item && typeof item === "object" ? sortObjKeys(item) : item,
        );
      } else {
        sorted[key] = val;
      }
    });
  return sorted;
};

const convertObjToQueryStr = (data) => {
  const sorted = sortObjKeys(data || {});
  return Object.keys(sorted)
    .map((key) => {
      const value = sorted[key];
      if (value === null || value === undefined || value === "null" || value === "undefined") {
        return `${key}=`;
      }
      if (typeof value === "object") {
        return `${key}=${JSON.stringify(value)}`;
      }
      return `${key}=${value}`;
    })
    .join("&");
};

const createSignature = (data, checksumKey) => {
  const raw = convertObjToQueryStr(data);
  return crypto.createHmac("sha256", checksumKey).update(raw).digest("hex");
};

const verifyWebhookSignature = (data, receivedSignature) => {
  const checksumKey = PAYOS_CHECKSUM_KEY();
  if (!checksumKey || !data || !receivedSignature) return false;
  const computed = createSignature(data, checksumKey);
  return computed === receivedSignature;
};

const fetchPayosOrderStatus = async (orderCode) => {
  const clientId = PAYOS_CLIENT_ID();
  const apiKey = PAYOS_API_KEY();
  if (!clientId || !apiKey) return null;

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
  return payosRes.data?.data || null;
};

// ─── Firestore collections ─────────────────────────────────────────
const ORDERS_COLLECTION = "payment_orders";
const SUBSCRIPTIONS_COLLECTION = "subscriptions";
const APPROVED_USERS_COLLECTION = "approved_users";

const generateOrderCode = () =>
  Number(`${String(Math.floor(Date.now() / 1000)).slice(-7)}${Math.floor(10 + Math.random() * 90)}`);

// ─── Controller ─────────────────────────────────────────────────────
class PaymentController {
  /**
   * GET /api/payment/plans
   * Public: trả về danh sách gói VIP + gói AI Filter bán riêng
   */
  getPlans = async (req, res) => {
    return res.status(200).json({
      success: true,
      data: {
        plans: VIP_PLANS.filter((p) => !p.adminOnly),
        aiPlans: AI_FILTER_PLANS,
        features: VIP_FEATURES,
      },
    });
  };

  /**
   * POST /api/payment/claim-trial
   * PUBLIC — Kích hoạt gói dùng thử 1 ngày (0đ) + 1 ảnh AI (mỗi username chỉ dùng 1 lần)
   * Body: { username }
   */
  claimTrial = async (req, res) => {
    try {
      const { username } = req.body;
      if (!username || !String(username).trim()) {
        return res.status(400).json({
          success: false,
          message: "Vui lòng nhập username Locket",
        });
      }

      const normalizedUsername = String(username)
        .trim()
        .replace(/^@+/, "")
        .toLowerCase();

      if (!normalizedUsername) {
        return res.status(400).json({
          success: false,
          message: "Tên người dùng không hợp lệ",
        });
      }

      if (!db) {
        return res.status(503).json({
          success: false,
          message: "Database chưa sẵn sàng",
        });
      }

      const userRef = db.collection(APPROVED_USERS_COLLECTION).doc(normalizedUsername);
      const userDoc = await userRef.get();
      const userData = userDoc.exists ? userDoc.data() : null;

      if (userData?.hasUsedTrial === true) {
        return res.status(400).json({
          success: false,
          code: "TRIAL_ALREADY_USED",
          message: "Tài khoản của bạn đã sử dụng gói dùng thử 1 ngày trước đó. Vui lòng chọn gói VIP để tiếp tục!",
        });
      }

      const now = Date.now();
      const nowIso = new Date(now).toISOString();
      const expireAt = now + 1 * DAY_MS; // 24 giờ
      const currentCredits = Number(userData?.aiCredits || 0);

      const updatePayload = {
        username: normalizedUsername,
        role: "vip",
        active: true,
        approved: true,
        enabled: true,
        vipPlanId: "vip_trial",
        vipPlanName: "VIP Dùng thử (1 ngày)",
        vipPlanDays: 1,
        vipExpireAt: expireAt,
        aiCredits: currentCredits + 1, // Tặng 1 ảnh AI
        hasUsedTrial: true,
        trialClaimedAt: nowIso,
        updatedAt: nowIso,
        note: userData?.note ? `${userData.note} (Đã dùng thử 1N)` : "Tài khoản đã dùng thử (1 ngày)",
        ...(userDoc.exists ? {} : { createdAt: nowIso }),
      };

      await userRef.set(updatePayload, { merge: true });

      return res.status(200).json({
        success: true,
        message: "Kích hoạt gói dùng thử 1 ngày thành công! Bạn nhận được 24h VIP + 1 ảnh AI.",
        data: {
          username: normalizedUsername,
          role: "vip",
          vipPlanName: "VIP Dùng thử (1 ngày)",
          vipExpireAt: expireAt,
          aiCredits: currentCredits + 1,
          hasUsedTrial: true,
        },
      });
    } catch (error) {
      console.error("❌ claimTrial error:", error);
      return res.status(500).json({
        success: false,
        message: "Lỗi kích hoạt gói dùng thử",
      });
    }
  };

  /**
   * POST /api/payment/create-order
   * PUBLIC — không cần đăng nhập
   * Body: { planId, username }
   */
  createOrder = async (req, res) => {
    try {
      const { planId, username } = req.body;

      if (!username || !String(username).trim()) {
        return res.status(400).json({
          success: false,
          message: "Vui lòng nhập tên người dùng (username)",
        });
      }

      const normalizedUsername = String(username)
        .trim()
        .replace(/^@+/, "")
        .toLowerCase();

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
          message: "Gói dịch vụ không hợp lệ",
        });
      }

      if (plan.adminOnly) {
        return res.status(400).json({
          success: false,
          message: "Gói này chỉ do Quản trị viên cấp trực tiếp.",
        });
      }

      // BẮT BUỘC: Phải có gói VIP còn hạn mới được phép mua gói AI Filter
      if (plan.category === "ai_filter" && db) {
        let userDoc = await db.collection(APPROVED_USERS_COLLECTION).doc(normalizedUsername).get();
        if (!userDoc.exists) {
          const querySnap = await db
            .collection(APPROVED_USERS_COLLECTION)
            .where("username", "in", [normalizedUsername, `@${normalizedUsername}`])
            .limit(1)
            .get();
          if (!querySnap.empty) {
            userDoc = querySnap.docs[0];
          }
        }

        if (!userDoc || !userDoc.exists) {
          return res.status(400).json({
            success: false,
            code: "VIP_REQUIRED_FOR_AI",
            message: "Bạn cần có gói VIP trước khi mua lượt AI Filter. Vui lòng nâng cấp VIP trước!",
          });
        }

        const access = resolveEffectiveAccess(userDoc.data(), Date.now());
        if (!access.isVipActive) {
          return res.status(400).json({
            success: false,
            code: "VIP_REQUIRED_FOR_AI",
            message: "Gói AI Filter chỉ dành cho thành viên VIP. Gói VIP của bạn đã hết hạn hoặc chưa kích hoạt, vui lòng nâng cấp VIP trước!",
          });
        }
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

      let orderCode = generateOrderCode();
      if (db) {
        const existingOrder = await db
          .collection(ORDERS_COLLECTION)
          .doc(String(orderCode))
          .get();
        if (existingOrder.exists) {
          orderCode = generateOrderCode();
        }
      }

      const baseUrl = req.headers.origin || "https://locket-pro.online";
      const returnUrl =
        process.env.PAYOS_RETURN_URL || `${baseUrl}/payment/result`;
      const cancelUrl =
        process.env.PAYOS_CANCEL_URL || `${baseUrl}/pricing`;

      // PayOS description: tối đa 25 ký tự, KHÔNG chứa ký tự đặc biệt như @ để tránh lỗi PayOS từ chối
      const cleanName = normalizedUsername.replace(/[^a-zA-Z0-9]/g, "");
      const description = (
        plan.category === "ai_filter"
          ? `AI ${plan.credits || 0}A ${cleanName}`
          : `VIP ${plan.days || 0}N ${cleanName}`
      ).slice(0, 25);

      const signData = {
        amount: plan.price,
        cancelUrl,
        description,
        orderCode,
        returnUrl,
      };

      const signature = createSignature(signData, checksumKey);

      const payosResponse = await axios.post(
        `${PAYOS_API_URL}/v2/payment-requests`,
        {
          orderCode,
          amount: plan.price,
          description,
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
          expiredAt: Math.floor(Date.now() / 1000) + 30 * 60,
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

      const orderRecord = {
        orderCode,
        planId: plan.id,
        planName: plan.name,
        planDays: Number.isFinite(plan.days) ? plan.days : null,
        credits: Number.isFinite(plan.credits) ? plan.credits : null,
        planCategory: plan.category || "vip",
        price: plan.price,
        username: normalizedUsername,
        status: "PENDING",
        checkoutUrl: payosData.checkoutUrl,
        qrCode: payosData.qrCode,
        paymentLinkId: payosData.paymentLinkId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (db) {
        await db.collection(ORDERS_COLLECTION).doc(String(orderCode)).set(orderRecord);
        console.log(
          `📦 Order created: #${orderCode} for @${normalizedUsername} - ${plan.name} (${plan.category})`,
        );
      }

      return res.status(200).json({
        success: true,
        data: {
          orderCode,
          checkoutUrl: payosData.checkoutUrl,
          qrCode: payosData.qrCode,
          amount: plan.price,
          price: plan.price,
          planId: plan.id,
          planName: plan.name,
          planDays: Number.isFinite(plan.days) ? plan.days : null,
          credits: Number.isFinite(plan.credits) ? plan.credits : null,
          planCategory: plan.category || "vip",
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
  };

  /**
   * GET /api/payment/order/:orderCode
   * PUBLIC: lấy thông tin đơn hàng (nếu đang PENDING thì tự kiểm tra PayOS ngay)
   */
  getOrder = async (req, res) => {
    try {
      const { orderCode } = req.params;

      if (!db) {
        return res.status(503).json({
          success: false,
          message: "Database chưa sẵn sàng",
        });
      }

      const orderRef = db.collection(ORDERS_COLLECTION).doc(String(orderCode));
      const doc = await orderRef.get();

      if (!doc.exists) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy đơn hàng",
        });
      }

      const order = doc.data();

      if (order.status === "PENDING") {
        try {
          const payosInfo = await fetchPayosOrderStatus(orderCode);
          if (payosInfo?.status === "PAID") {
            const updatedOrder = await this._markOrderPaidAndActivate(orderCode, payosInfo);
            return res.status(200).json({
              success: true,
              data: updatedOrder || { ...order, status: "PAID" },
            });
          }
          if (payosInfo?.status === "CANCELLED") {
            await orderRef.update({
              status: "CANCELLED",
              updatedAt: new Date().toISOString(),
            });
            return res.status(200).json({
              success: true,
              data: { ...order, status: "CANCELLED" },
            });
          }
        } catch (err) {
          console.warn("⚠️ getOrder live PayOS check skipped:", err.message);
        }
      }

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
  };

  /**
   * POST /api/payment/webhook
   * PayOS webhook: xử lý khi thanh toán thành công → auto kích hoạt VIP / AI Filter
   */
  handleWebhook = async (req, res) => {
    try {
      const body = req.body || {};
      const { code, data, signature } = body;

      console.log("🔔 PayOS webhook received:", JSON.stringify(body).slice(0, 500));

      // PayOS sends a test/verification webhook — always return 200
      if (!data && !code) {
        console.log("ℹ️ Webhook test/ping request — responding OK");
        return res.status(200).json({ success: true });
      }

      // Handle confirm webhook (PayOS sends orderCode 123 to verify URL)
      if (data && Number(data.orderCode) === 123) {
        console.log("ℹ️ PayOS confirm webhook test — responding OK");
        return res.status(200).json({ success: true });
      }

      if (code !== "00" || !data || !data.orderCode) {
        console.log("ℹ️ Webhook non-success code:", code);
        return res.status(200).json({ success: true });
      }

      const { orderCode } = data;
      let verified = signature ? verifyWebhookSignature(data, signature) : false;

      // Fallback: if signature format differs, confirm directly against PayOS Merchant API
      if (!verified) {
        console.warn(
          `⚠️ Webhook signature mismatch for order #${orderCode}, verifying directly with PayOS API...`,
        );
        try {
          const payosInfo = await fetchPayosOrderStatus(orderCode);
          if (payosInfo?.status === "PAID") {
            verified = true;
          }
        } catch (verifyErr) {
          console.error("❌ Direct PayOS verification error:", verifyErr.message);
        }
      }

      if (!verified) {
        console.warn(`⚠️ Unverified webhook ignored for order #${orderCode}`);
        return res.status(200).json({ success: false, message: "Invalid signature" });
      }

      if (!db) {
        console.error("❌ Firestore not available for webhook");
        return res.status(200).json({ success: true });
      }

      const updatedOrder = await this._markOrderPaidAndActivate(orderCode, data);
      if (updatedOrder) {
        console.log(
          `✅ Payment confirmed & activated: order #${orderCode} for @${updatedOrder.username} - ${updatedOrder.planName}`,
        );
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("❌ Webhook error:", error.message);
      return res.status(200).json({ success: true });
    }
  };

  /**
   * Atomically marks an order as PAID (if not already PAID) and activates the corresponding
   * VIP or AI Filter entitlement. Prevents duplicate extensions when webhook and polling race.
   */
  async _markOrderPaidAndActivate(orderCode, payosData = null) {
    const orderRef = db.collection(ORDERS_COLLECTION).doc(String(orderCode));
    let activatedOrder = null;
    let shouldActivate = false;

    await db.runTransaction(async (tx) => {
      const doc = await tx.get(orderRef);
      if (!doc.exists) return;

      const current = doc.data();
      if (current.status === "PAID") {
        activatedOrder = current;
        return;
      }

      const nowIso = new Date().toISOString();
      const updated = {
        ...current,
        status: "PAID",
        paidAt: nowIso,
        updatedAt: nowIso,
        ...(payosData ? { payosData } : {}),
      };

      tx.update(orderRef, {
        status: "PAID",
        paidAt: nowIso,
        updatedAt: nowIso,
        ...(payosData ? { payosData } : {}),
      });

      activatedOrder = updated;
      shouldActivate = true;
    });

    if (shouldActivate && activatedOrder) {
      await this._activateVip(activatedOrder);
    }

    return activatedOrder;
  }

  /**
   * Internal: kích hoạt gói VIP hoặc gói AI Filter riêng biệt dựa trên đơn hàng
   */
  async _activateVip(order) {
    const {
      username: rawUsername,
      planId,
      planName,
      planDays: rawPlanDays,
      planCategory,
      price,
      orderCode,
    } = order;

    const username = String(rawUsername || "")
      .trim()
      .replace(/^@+/, "")
      .toLowerCase();
    if (!username) return;

    const planFromCatalog = PLANS_MAP.get(planId);
    const category =
      planCategory ||
      planFromCatalog?.category ||
      (String(planId || "").startsWith("ai_") ? "ai_filter" : "vip");
    const planDays = Number(rawPlanDays) || planFromCatalog?.days || 30;
    const now = Date.now();
    const nowIso = new Date(now).toISOString();

    const lastPayment = {
      orderCode,
      amount: price,
      planId,
      planName,
      category,
      paidAt: nowIso,
    };

    const approvedRef = db.collection(APPROVED_USERS_COLLECTION).doc(username);
    const approvedDoc = await approvedRef.get();
    const existingData = approvedDoc.exists ? approvedDoc.data() : null;
    const resolvedExisting = existingData
      ? resolveEffectiveAccess(existingData, now)
      : null;

    if (category === "ai_filter") {
      // ─── KÍCH HOẠT NẠP LƯỢT AI FILTER (CỘNG DỒN CREDITS) ───
      const creditsToAdd = Number(planFromCatalog?.credits || order?.credits || 0);
      const currentCredits = Math.max(
        0,
        Number(existingData?.aiCredits ?? (existingData?.aiFilterEnabled ? 20 : 0))
      );
      const newCredits = currentCredits + creditsToAdd;

      if (approvedDoc.exists) {
        const updatePayload = {
          ...(resolvedExisting?.vipExpired ? resolvedExisting.downgradePatch : {}),
          username,
          active: true,
          approved: true,
          enabled: true,
          aiFilterEnabled: true,
          aiCredits: newCredits,
          lastPayment,
          updatedAt: nowIso,
        };
        await approvedRef.set(updatePayload, { merge: true });
      } else {
        await approvedRef.set({
          username,
          role: "free",
          active: true,
          approved: true,
          enabled: true,
          aiFilterEnabled: true,
          aiCredits: newCredits,
          note: `Nạp ${planName}`,
          lastPayment,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }

      console.log(
        `✨ AI Filter credits added: @${username} +${creditsToAdd} credits (Total: ${newCredits})`,
      );
      return;
    }

    // ─── KÍCH HOẠT GÓI VIP (TẶNG KÈM AI CREDITS) ─────────────────────
    const bonusCredits = Number(planFromCatalog?.bonusAiCredits || 0);
    const currentCredits = Number(existingData?.aiCredits || 0);
    const newCredits = currentCredits + bonusCredits;

    const currentVipExpiry = toTimestampMs(existingData?.vipExpireAt) || 0;
    const baseTime =
      existingData &&
      resolvedExisting?.effectiveRole === "vip" &&
      currentVipExpiry > now
        ? currentVipExpiry
        : now;
    const newVipExpireAt = baseTime + planDays * DAY_MS;

    if (approvedDoc.exists) {
      const updatePayload = {
        ...(resolvedExisting?.aiExpired ? resolvedExisting.downgradePatch : {}),
        username,
        role: "vip",
        active: true,
        approved: true,
        enabled: true,
        vipPlanId: planId,
        vipPlanName: planName,
        vipPlanDays: planDays,
        vipExpireAt: newVipExpireAt,
        aiCredits: newCredits,
        lastPayment,
        updatedAt: nowIso,
      };
      if (!existingData.note) {
        updatePayload.note = `Tự đăng ký VIP - ${planName}`;
      }
      await approvedRef.set(updatePayload, { merge: true });
    } else {
      await approvedRef.set({
        username,
        role: "vip",
        active: true,
        approved: true,
        enabled: true,
        aiFilterEnabled: false,
        aiCredits: newCredits,
        note: `Tự đăng ký VIP - ${planName}`,
        vipPlanId: planId,
        vipPlanName: planName,
        vipPlanDays: planDays,
        vipExpireAt: newVipExpireAt,
        lastPayment,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }

    const subRef = db.collection(SUBSCRIPTIONS_COLLECTION).doc(username);
    const subDoc = await subRef.get();
    await subRef.set(
      {
        username,
        category: "vip",
        planId,
        planName,
        planDays,
        expireAt: newVipExpireAt,
        lastPayment,
        updatedAt: nowIso,
        ...(subDoc.exists ? {} : { createdAt: nowIso }),
      },
      { merge: true },
    );

    console.log(
      `🎖️ VIP activated: @${username} → ${planName} (${planDays}d), expires ${new Date(newVipExpireAt).toISOString()}`,
    );
  }

  /**
   * POST /api/payment/check-order/:orderCode
   * PUBLIC: kiểm tra lại trạng thái đơn hàng từ PayOS
   */
  recheckOrder = async (req, res) => {
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

      if (order.status === "PAID") {
        return res.status(200).json({
          success: true,
          data: { ...order, status: "PAID" },
        });
      }

      try {
        const payosInfo = await fetchPayosOrderStatus(orderCode);
        const payosStatus = payosInfo?.status;

        if (payosStatus === "PAID") {
          const updatedOrder = await this._markOrderPaidAndActivate(
            orderCode,
            payosInfo,
          );
          console.log(`✅ Order #${orderCode} auto-activated via recheck for @${order.username}`);
          return res.status(200).json({
            success: true,
            data: updatedOrder || { ...order, status: "PAID" },
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
  };
}

const controller = new PaymentController();
controller._private = {
  sortObjKeys,
  convertObjToQueryStr,
  createSignature,
  verifyWebhookSignature,
};

module.exports = controller;
