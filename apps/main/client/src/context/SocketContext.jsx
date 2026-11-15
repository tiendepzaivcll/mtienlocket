import { createSocket, updateSocketAuthToken } from "@/socket/socketClient";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAuthStore } from "@/stores";
import { getToken } from "@/utils";
import { resolveSocketSessionUid } from "@/socket/socketSessionPolicy";

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const user = useAuthStore((state) => state.user);
  const isAuth = useAuthStore((state) => state.isAuth);
  const socketRef = useRef(null);
  const hadConnectedRef = useRef(false);
  const wasDisconnectedRef = useRef(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionInfo, setConnectionInfo] = useState({
    phase: "idle",
    reason: null,
    attempt: 0,
  });

  const storedLocalId = getToken()?.localId;
  const sessionUid = resolveSocketSessionUid({ storedLocalId, user });

  useEffect(() => {
    const { idToken } = getToken();
    if (!idToken || !isAuth || !sessionUid) return;

    // ❗ Chỉ tạo socket nếu chưa có
    if (!socketRef.current) {
      setConnectionInfo({ phase: "connecting", reason: null, attempt: 0 });
      socketRef.current = createSocket(idToken, {
        onConnect: () => {
          setIsConnected(true);
          setConnectionInfo({ phase: "connected", reason: null, attempt: 0 });
          if (hadConnectedRef.current && wasDisconnectedRef.current) {
            window.dispatchEvent(new Event("t97:realtime-recovered"));
          }
          hadConnectedRef.current = true;
          wasDisconnectedRef.current = false;
        },
        onDisconnect: (reason) => {
          setIsConnected(false);
          setConnectionInfo((current) => ({
            ...current,
            phase: "disconnected",
            reason: reason || "transport closed",
          }));
          wasDisconnectedRef.current = true;
        },
        onError: (error) => {
          setIsConnected(false);
          setConnectionInfo((current) => ({
            ...current,
            phase: "error",
            reason: error?.data?.code || error?.message || "connect error",
          }));
        },
        onReconnectAttempt: (attempt) => {
          setConnectionInfo((current) => ({
            ...current,
            phase: "reconnecting",
            attempt,
          }));
        },
        onServerError: (error) => {
          setConnectionInfo((current) => ({
            ...current,
            reason: error?.code || error?.message || "request error",
          }));
        },
      });
    }

    const refreshSocketToken = () => {
      const latestToken = getToken()?.idToken;
      if (!updateSocketAuthToken(socketRef.current, latestToken)) return;
      if (!socketRef.current.connected) socketRef.current.connect();
    };

    const reconnectWhenOnline = () => {
      refreshSocketToken();
      window.dispatchEvent(new Event("t97:network-recovered"));
    };

    const reconnectWhenVisible = () => {
      if (document.visibilityState === "visible") refreshSocketToken();
    };

    window.addEventListener("t97-token-refreshed", refreshSocketToken);
    window.addEventListener("online", reconnectWhenOnline);
    window.addEventListener("focus", refreshSocketToken);
    document.addEventListener("visibilitychange", reconnectWhenVisible);

    return () => {
      window.removeEventListener("t97-token-refreshed", refreshSocketToken);
      window.removeEventListener("online", reconnectWhenOnline);
      window.removeEventListener("focus", refreshSocketToken);
      document.removeEventListener("visibilitychange", reconnectWhenVisible);
      socketRef.current?.disconnect();
      socketRef.current = null;
      hadConnectedRef.current = false;
      wasDisconnectedRef.current = false;
    };
  }, [isAuth, sessionUid]);

  const reconnect = useCallback(() => {
    const latestToken = getToken()?.idToken;
    if (!updateSocketAuthToken(socketRef.current, latestToken)) return false;
    setConnectionInfo((current) => ({
      ...current,
      phase: "connecting",
      reason: null,
    }));
    socketRef.current.connect();
    return true;
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        isConnected,
        connectionInfo,
        reconnect,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

// This hook intentionally shares the provider's private context.
// eslint-disable-next-line react-refresh/only-export-components
export function useSocket() {
  return useContext(SocketContext);
}
