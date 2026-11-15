// src/socket/socketClient.js
import { API_ENDPOINTS } from "@/config/apiConfig";
import { getToken } from "@/utils";
import { io } from "socket.io-client";
import { shouldForceSocketReconnect } from "./socketSessionPolicy";

const getLatestToken = () => getToken()?.idToken || null;

export const updateSocketAuthToken = (socket, token = getLatestToken()) => {
  if (!socket || !token) return false;
  socket.auth = { ...(socket.auth || {}), token };
  return true;
};

export const createSocket = (
  idToken,
  { onConnect, onDisconnect, onError, onReconnectAttempt, onServerError } = {},
) => {
  if (!idToken) return null;

  const socketClient = io(API_ENDPOINTS.socketUrl, {
    transports: ["websocket", "polling"],
    tryAllTransports: true,
    auth: { token: idToken },
    autoConnect: false,
    // ✅ RECONNECT CONFIG
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    randomizationFactor: 0.5,
    timeout: 20000,
    rememberUpgrade: true,
  });

  socketClient.io.on("reconnect_attempt", (attempt) => {
    updateSocketAuthToken(socketClient);
    onReconnectAttempt?.(attempt, socketClient);
  });

  // Trạng thái kết nối
  socketClient.on("connect", () => {
    console.log("Socket connected:", socketClient.id);
    onConnect?.(socketClient);
  });

  socketClient.on("disconnect", (reason) => {
    console.log("Socket disconnected:", reason);
    onDisconnect?.(reason, socketClient);

    // Socket.IO does not reconnect automatically when the server explicitly
    // closes a client. Refresh auth and restart in that one exceptional case.
    if (shouldForceSocketReconnect(reason)) {
      updateSocketAuthToken(socketClient);
      socketClient.connect();
    }
  });

  socketClient.on("connect_error", (err) => {
    updateSocketAuthToken(socketClient);
    console.error("Connect error:", err.message);
    onError?.(err, socketClient);
  });

  socketClient.on("socket:error", (error) => {
    onServerError?.(error, socketClient);
  });

  socketClient.connect();
  return socketClient;
};
