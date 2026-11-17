const locketRouter = require("./locket.route.js");
const apiRouter = require("./api.route.js");
const publicRouter = require("./public.route.js");
const adminRouter = require("./admin.route.js");
const paymentRouter = require("./payment.route.js");
const { buildHealthReport } = require("../services/System/healthService.js");
const slotMonitor = require("../services/SlotMonitor");

module.exports = (app) => {
  app.get("/", (req, res) => {
    res.json({ message: "🚀 Server is running!" });
  });

  app.get("/health", (req, res) => {
    res.status(200).json(buildHealthReport());
  });

  app.use("/locket", locketRouter);
  app.use("/api", apiRouter);
  app.use("/api/payment", paymentRouter);
  app.use("/api/slot-monitor", slotMonitor.routes);
  app.use("/admin", adminRouter);
  app.use("/v1/public", publicRouter);
};
