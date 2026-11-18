const express = require("express");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const http = require("http");
const { Server } = require("socket.io");

const envFile =
  process.env.NODE_ENV === "production"
    ? ".env.production"
    : ".env.development";

dotenv.config({ path: ".env" });
dotenv.config({ path: envFile });
dotenv.config({ path: ".env.local" });

if (process.env.NODE_ENV !== "production" && !process.env.FIREBASE_PROJECT_ID) {
  dotenv.config({ path: ".env.production" });
}

const cors = require("cors");
const { logInfo } = require("./src/utils/logEventUtils.js");

// Routers
const routes = require("./src/routes/index.js");
const errorHandler = require("./src/helpers/error-handler.js");
const { securityHeaders } = require("./src/middlewares/security-headers.js");
const { requestTelemetry } = require("./src/middlewares/request-telemetry.js");
const {
  assertProductionReadiness,
} = require("./src/services/System/productionReadiness.js");
const { startWorker: startSlotMonitorWorker } = require("./src/services/SlotMonitor");
const { startVipExpiryWorker } = require("./src/services/System/vipExpiryWorker");

const app = express();
app.set("trust proxy", 1);
const server = http.createServer(app);
const configuredCorsOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedCorsOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  /^http:\/\/(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}):5173$/,
  ...configuredCorsOrigins,
];

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: allowedCorsOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Import services for socket handlers
const chatServices = require("./src/services/LocketMessage");
const authServices = require("./src/services/LocketAuth/AuthService");
const {
  authenticateSocketToken,
  normalizeSocketLimit,
  resolveSocketSession,
  socketErrorPayload,
} = require("./src/services/System/socketAuth");

io.use(async (socket, next) => {
  try {
    socket.data.session = await authenticateSocketToken(
      socket.handshake.auth?.token,
      authServices,
    );
    next();
  } catch (error) {
    next(error);
  }
});

// Socket connection handler
io.on("connection", (socket) => {
  logInfo("SOCKET", `Client connected: ${socket.id}`);

  socket.on("disconnect", (reason) => {
    logInfo("SOCKET", `Client disconnected: ${socket.id} (${reason})`);
  });

  // Get list of conversations
  socket.on("get_list_message", async (data = {}, acknowledge) => {
    try {
      const { idToken, localId } = await resolveSocketSession(
        socket,
        data.token,
        authServices,
      );

      const result = await chatServices.getAllMessages(
        idToken,
        localId,
        null,
        normalizeSocketLimit(data.limit),
      );
      socket.emit("new_on_list_message", result.messages || []);
      acknowledge?.({
        ok: true,
        requestId: data.requestId || null,
        count: result.messages?.length || 0,
        nextPageToken: result.nextPageToken || null,
      });
    } catch (error) {
      console.error("Socket get_list_message error:", error.message);
      const payload = socketErrorPayload(error, data.requestId);
      socket.emit("socket:error", payload);
      acknowledge?.(payload);
    }
  });

  // Get messages with specific user
  socket.on("get_messages_with_user", async (data = {}, acknowledge) => {
    try {
      if (!data?.messageId) {
        const missing = new Error("messageId missing");
        missing.code = "SOCKET_MESSAGE_ID_MISSING";
        throw missing;
      }
      const { idToken, localId } = await resolveSocketSession(
        socket,
        data.token,
        authServices,
      );

      const result = await chatServices.getMessagesWithUser(
        idToken,
        localId,
        data.messageId,
        data.timestamp,
        normalizeSocketLimit(data.limit),
        data.otherUserId
      );
      socket.emit("new_message_with_user", result.messages || []);
      acknowledge?.({
        ok: true,
        requestId: data.requestId || null,
        count: result.messages?.length || 0,
        nextPageToken: result.nextPageToken || null,
      });
    } catch (error) {
      console.error("Socket get_messages_with_user error:", error.message);
      const payload = socketErrorPayload(error, data.requestId);
      socket.emit("socket:error", payload);
      acknowledge?.(payload);
    }
  });

  // Handle chat messages
  socket.on("chat:send", (data) => {
    socket.broadcast.emit("chat:receive", data);
  });

  // Handle typing indicator
  socket.on("typing:start", (data) => {
    socket.broadcast.emit("typing:show", data);
  });

  socket.on("typing:stop", (data) => {
    socket.broadcast.emit("typing:hide", data);
  });
});

app.use(securityHeaders);
app.use(requestTelemetry);
app.use(
  cors({
    origin: allowedCorsOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true,
  }),
);

app.use(cookieParser());
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || "5mb", strict: true }));
app.use(express.urlencoded({
  extended: true,
  limit: process.env.URLENCODED_BODY_LIMIT || "1mb",
}));

// Nạp các route vào ứng dụng
routes(app);

// Middleware xử lý lỗi
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  if (process.env.NODE_ENV === "production") {
    assertProductionReadiness();
  }
  server.listen(PORT, () => {
    require("./src/services/AppCheck/settingsStore").settingsStore.load();
    logInfo("SERVER", `Server backend is running at localhost:${PORT}`);
    logInfo("SOCKET", `Socket.IO is ready on port ${PORT}`);
    startSlotMonitorWorker();
    startVipExpiryWorker();
  });
}

module.exports = app;
