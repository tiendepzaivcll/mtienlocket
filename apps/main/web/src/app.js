const express = require("express");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const cors = require("cors");
const { logInfo } = require("./utils/logEventUtils.js"); 

const adminController = require("./controllers/admin.controller.js"); 

const envFile = process.env.NODE_ENV === "production" ? ".env.production" : ".env.development";
dotenv.config({ path: envFile });

const routes = require("./routes/index.js"); 
const errorHandler = require("./helpers/error-handler.js"); 

const app = express();

const configuredCorsOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: ["http://localhost:5173", ...configuredCorsOrigins],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  }),
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Admin health check.
app.use((req, res, next) => {
  if (req.url.endsWith("/ping")) {
    return res.json({ 
      message: "ADMIN SERVER ĐÃ THÔNG!",
      note: "Available at /api/admin/ping and /admin/ping",
      your_url: req.url 
    });
  }
  next();
});

// Admin login.
app.post("/api/admin/login", adminController.login);

// VIP management.
app.get("/api/admin/vip", adminController.verifyAdmin, adminController.getVipEmails);
app.post("/api/admin/vip", adminController.verifyAdmin, adminController.addVipEmail);
app.put("/api/admin/vip/:id", adminController.verifyAdmin, adminController.updateVipEmail);
app.delete("/api/admin/vip/:id", adminController.verifyAdmin, adminController.deleteVipEmail);

// 🚀 -----------------------------------------------------------

routes(app);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    logInfo("SERVER", `Server backend is running at localhost:${PORT}`);
  });
}

module.exports = app;
