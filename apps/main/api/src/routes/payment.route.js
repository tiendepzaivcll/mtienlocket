const Router = require("express");
const router = Router();
const paymentController = require("../controllers/payment.controller.js");
const { verifyIdToken } = require("../middlewares/verifyToken.js");

// 🔓 Public: danh sách gói VIP
router.get("/plans", paymentController.getPlans);

// 🔐 Auth required: tạo đơn hàng
router.post("/create-order", verifyIdToken, paymentController.createOrder);

// 🔐 Auth required: xem đơn hàng
router.get("/order/:orderCode", verifyIdToken, paymentController.getOrder);

// 🔐 Auth required: kiểm tra lại đơn hàng
router.post("/check-order/:orderCode", verifyIdToken, paymentController.recheckOrder);

// 🔐 Auth required: xem gói VIP hiện tại
router.get("/my-subscription", verifyIdToken, paymentController.getMySubscription);

// 🔔 PayOS Webhook (no auth — called by PayOS server)
router.post("/webhook", paymentController.handleWebhook);

module.exports = router;
