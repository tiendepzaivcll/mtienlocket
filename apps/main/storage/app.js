require("dotenv").config();
const express = require("express");
const cors = require("cors");
const routes = require("./src/routes");
const { logGroupWrapper, logInfo } = require("./src/utils/logEventUtils");

const app = express();

const configuredCorsOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = [
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
  ...configuredCorsOrigins,
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // Cho phép request từ cùng server (ex: curl)
      if (
        allowedOrigins.some((pattern) =>
          typeof pattern === "string"
            ? pattern === origin
            : pattern.test(origin)
        )
      ) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true, // Nếu bạn cần gửi cookie/authorization
  }),
);

// Các middleware khác
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(logGroupWrapper);

// Nạp các route vào ứng dụng
routes(app);

// Khởi động server
const PORT = process.env.PORT || 5003;
if (require.main === module) {
  app.listen(PORT, () => {
    logInfo("SERVER", `🚀 Backend đang chạy tại http://localhost:${PORT}`);
  });
}

module.exports = app;
