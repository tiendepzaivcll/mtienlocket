const Router = require("express");
const router = Router();
const paymentController = require("../controllers/payment.controller.js");

// 🔓 All public — self-service payment flow
router.get("/plans", paymentController.getPlans);
router.get("/check-user/:username", paymentController.checkUserVip);
router.post("/claim-trial", paymentController.claimTrial);
router.post("/create-order", paymentController.createOrder);
router.get("/order/:orderCode", paymentController.getOrder);
router.post("/check-order/:orderCode", paymentController.recheckOrder);

// 🔔 PayOS Webhook
router.post("/webhook", paymentController.handleWebhook);

module.exports = router;
