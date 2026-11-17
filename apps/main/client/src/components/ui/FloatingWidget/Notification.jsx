import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";
import { Bell, X } from "lucide-react";
import { TbPinned } from "react-icons/tb";
import { getNotifications } from "@/services";
import { useAuthStore } from "@/stores";
import {
  markNotificationsRead,
  mergeReadStates,
  notificationReadKey,
  notificationVersion,
  readNotificationState,
  unreadNotifications,
} from "@/utils/notificationReadState";

const storageForNotifications = () => {
  try { return window.localStorage; } catch { return null; }
};
const sameReadState = (left, right) => Object.keys(left).length === Object.keys(right).length &&
  Object.entries(left).every(([id, version]) => right[id] === version);

function parseMessage(text = "") {
  const parts = String(text).split(/(https?:\/\/[^\s]+)/g);
  return parts.map((part, i) => {
    if (/^https?:\/\//i.test(part)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary font-semibold underline hover:text-primary/80 transition-colors"
        >
          {part}
        </a>
      );
    }

    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

const FloatingNotification = () => {
  const accountId = useAuthStore((state) => state.user?.uid || state.user?.localId || state.user?.username || null);
  const readKey = notificationReadKey(accountId ? `user:${accountId}` : "guest");
  const [readRecord, setReadRecord] = useState(() => ({ key: readKey, values: readNotificationState(storageForNotifications(), readKey) }));
  const readValues = readRecord.key === readKey ? readRecord.values : readNotificationState(storageForNotifications(), readKey);
  const readRecordRef = useRef({ key: readKey, values: readValues });
  readRecordRef.current = { key: readKey, values: readValues };
  const [notifications, setNotifications] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [animate, setAnimate] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [showNewNotificationAlert, setShowNewNotificationAlert] =
    useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const mountedRef = useRef(false);
  const requestRef = useRef(null);
  const alertTimerRef = useRef(null);
  const modalTimerRef = useRef(null);
  const shakeTimerRef = useRef(null);
  const modalOpenRef = useRef(false);
  const signatureRef = useRef("");
  const unread = useMemo(() => unreadNotifications(notifications, readValues), [notifications, readValues]);
  const unreadSignature = unread.map((item) => notificationVersion(item)).join("|");

  const updateReadValues = useCallback((values) => {
    readRecordRef.current = { key: readKey, values };
    setReadRecord((previous) => previous.key === readKey && sameReadState(previous.values, values)
      ? previous : { key: readKey, values });
  }, [readKey]);

  const markRead = useCallback((items) => {
    if (!modalOpenRef.current || document.visibilityState === "hidden") return;
    const storage = storageForNotifications();
    const stored = readNotificationState(storage, readKey);
    const current = readRecordRef.current.key === readKey ? readRecordRef.current.values : stored;
    const next = markNotificationsRead(items, mergeReadStates(stored, current));
    const changed = !sameReadState(current, next);
    const needsWrite = Boolean(storage) && !sameReadState(stored, next);
    updateReadValues(next);
    if (needsWrite) {
      try { storage.setItem(readKey, JSON.stringify(next)); } catch { /* Keep the current view marked read when storage is unavailable. */ }
    }
    if (changed || needsWrite) window.dispatchEvent(new CustomEvent("mtien-notifications-read", { detail: { key: readKey, values: next } }));
  }, [readKey, updateReadValues]);

  useEffect(() => {
    updateReadValues(readNotificationState(storageForNotifications(), readKey));
    const syncReadValues = (incoming, reset = false) => {
      const current = readRecordRef.current.key === readKey ? readRecordRef.current.values : {};
      const next = reset ? {} : mergeReadStates(current, incoming);
      updateReadValues(next);
      const storage = storageForNotifications();
      if (!reset && storage && !sameReadState(readNotificationState(storage, readKey), next)) {
        try { storage.setItem(readKey, JSON.stringify(next)); } catch { /* In-memory state still works. */ }
      }
    };
    const onStorage = (event) => {
      if (event.key !== null && event.key !== readKey) return;
      syncReadValues(readNotificationState(storageForNotifications(), readKey), event.newValue === null);
    };
    const onRead = (event) => {
      if (event.detail?.key === readKey) syncReadValues(event.detail.values);
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("mtien-notifications-read", onRead);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("mtien-notifications-read", onRead);
    };
  }, [readKey, updateReadValues]);

  useEffect(() => {
    const markVisible = () => {
      if (showModal && modalOpenRef.current) markRead(notifications);
    };
    markVisible();
    document.addEventListener("visibilitychange", markVisible);
    return () => document.removeEventListener("visibilitychange", markVisible);
  }, [showModal, notifications, markRead]);

  useEffect(() => {
    clearTimeout(alertTimerRef.current);
    clearTimeout(shakeTimerRef.current);
    if (showModal || !unreadSignature) {
      signatureRef.current = "";
      setShowNewNotificationAlert(false);
      setIsShaking(false);
      return undefined;
    }
    const signature = `${readKey}:${unreadSignature}`;
    if (signature === signatureRef.current) return undefined;
    signatureRef.current = signature;
    setShowNewNotificationAlert(true);
    setIsShaking(true);
    alertTimerRef.current = setTimeout(() => setShowNewNotificationAlert(false), 3000);
    shakeTimerRef.current = setTimeout(() => setIsShaking(false), 2000);
    return () => {
      clearTimeout(alertTimerRef.current);
      clearTimeout(shakeTimerRef.current);
    };
  }, [readKey, unreadSignature, showModal]);

  const fetchNotifications = useCallback(async () => {
      requestRef.current?.abort();
      const request = new AbortController();
      requestRef.current = request;
      setIsLoading(true);
      try {
        const res = await getNotifications({ signal: request.signal });
        if (!mountedRef.current || request.signal.aborted) return;
        const data = res.data.notifications;

        const formatted = data.map((item) => ({
          ...item,
          time: new Date(item.created_at).toLocaleString("vi-VN"),
          createdAt: new Date(item.created_at).getTime(),
        }));

        // Sắp xếp:
        // - pinned trước
        // - cùng pinned thì sort theo createdAt DESC (mới nhất trước)
        formatted.sort((a, b) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          return b.createdAt - a.createdAt;
        });

        setNotifications(formatted);
        setLoadError("");
      } catch (err) {
        if (mountedRef.current && !request.signal.aborted) {
          setLoadError("Không tải được thông báo mới. Bạn có thể thử lại.");
        }
      } finally {
        if (mountedRef.current && requestRef.current === request) setIsLoading(false);
      }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchNotifications();
    const refreshVisible = () => {
      if (document.visibilityState !== "hidden") fetchNotifications();
    };
    const interval = setInterval(refreshVisible, 60000);
    window.addEventListener("focus", refreshVisible);
    window.addEventListener("mtien-notifications-updated", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      mountedRef.current = false;
      requestRef.current?.abort();
      clearTimeout(alertTimerRef.current);
      clearTimeout(shakeTimerRef.current);
      clearTimeout(modalTimerRef.current);
      clearInterval(interval);
      window.removeEventListener("focus", refreshVisible);
      window.removeEventListener("mtien-notifications-updated", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [fetchNotifications]);

  // Lock scroll khi mở modal
  useEffect(() => {
    document.body.style.overflow = showModal ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [showModal]);

  // Mở modal với animation
  const openModal = () => {
    clearTimeout(modalTimerRef.current);
    modalOpenRef.current = true;
    markRead(notifications);
    fetchNotifications();
    setShowNewNotificationAlert(false);
    setShowModal(true);
    modalTimerRef.current = setTimeout(() => setAnimate(true), 10);
  };

  const closeModal = () => {
    clearTimeout(modalTimerRef.current);
    modalOpenRef.current = false;
    setAnimate(false);
    modalTimerRef.current = setTimeout(() => setShowModal(false), 300);
  };

  return (
    <>
      {/* Floating Notification Button */}
      <div className="relative">
        {/* New Notification Alert */}
        {showNewNotificationAlert && (
          <div className="absolute bg-green-500 text-white bottom-full right-0 mb-3 px-4 py-2 rounded-lg shadow-xl text-sm font-medium flex items-center gap-2 whitespace-nowrap">
            🔔 Có thông báo mới!
            <div
              className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 
                       border-l-transparent border-r-transparent border-t-emerald-500"
            ></div>
          </div>
        )}

        <button
          type="button"
          aria-label="Mở giao diện thông báo"
          aria-expanded={showModal}
          onClick={openModal}
          className="relative flex items-center justify-center w-12 h-12 rounded-full bg-base-300 border text-base-content shadow-sm cursor-pointer"
        >
          <Bell
            size={24}
            className={`text-base-content ${
              isShaking ? "shake-animation" : ""
            }`}
          />
          {!showModal && unread.length > 0 && (
            <span data-testid="notification-unread-badge" aria-label={`${unread.length} thông báo chưa đọc`} className="absolute no-select -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-1 py-0.5 leading-none ring-2 ring-white">
              {unread.length}
            </span>
          )}
        </button>
      </div>

      {/* Modal */}
      {showModal && (
        <div
          className={`fixed inset-0 z-[60] shadow-md flex items-center justify-center p-4 
            bg-base-100/10 backdrop-blur-sm transition-opacity duration-300 
            ${animate ? "opacity-100" : "opacity-0"}`}
          onClick={closeModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="mtien-notifications-title"
            className={`relative w-full max-w-lg bg-base-100 rounded-3xl shadow-2xl overflow-hidden 
              transform transition-all duration-300 
              ${
                animate ? "scale-100 translate-y-0" : "scale-90 translate-y-4"
              }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative bg-base-300 px-6 py-4 flex items-center justify-between text-base-content">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-base-100/70 rounded-full">
                  <Bell className="w-6 h-6" />
                </div>
                <h2 id="mtien-notifications-title" className="text-xl font-bold">
                  Thông báo
                </h2>
              </div>
              <button
                type="button"
                aria-label="Đóng thông báo"
                onClick={closeModal}
                className="p-2 rounded-full bg-base-100/70"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="max-h-[50vh] overflow-y-auto">
              {loadError && <div className="m-4 rounded-xl bg-error/10 p-3 text-sm" role="alert"><p>{loadError}</p><button type="button" className="btn btn-ghost btn-sm mt-2" disabled={isLoading} onClick={fetchNotifications}>Thử tải lại thông báo</button></div>}
              {isLoading && notifications.length === 0 ? <p className="px-6 py-12 text-center text-sm opacity-70" role="status">Đang tải thông báo…</p> : notifications.length === 0 && !loadError ? (
                <div className="flex flex-col items-center justify-center py-12 px-6">
                  <div className="w-16 h-16 bg-base-100 rounded-full flex items-center justify-center mb-4">
                    <Bell className="w-8 h-8 text-base-content/70" />
                  </div>
                  <p className="text-base-content/80 text-center text-lg">
                    Không có thông báo nào
                  </p>
                  <p className="text-base-content/80 text-center text-sm mt-1">
                    Các thông báo mới sẽ xuất hiện tại đây
                  </p>
                </div>
              ) : (
                <div className="bg-base-100">
                  {notifications.map((item, index) => (
                    <div
                      key={item.id}
                      className={`p-6 bg-base-200 transition-colors duration-200 rounded-2xl m-2 shadow 
      ${index === 0 && !item.pinned ? "bg-base-300" : ""}`}
                    >
                      {item.title && (
                        <div className="relative flex items-center justify-between mb-2">
                          <h3 className="min-w-0 break-words font-semibold text-base-content text-base leading-snug [overflow-wrap:anywhere]">
                            {item.title}
                          </h3>

                          {/* Nếu item là thông báo đầu tiên KHÔNG GHIM → gắn "Mới nhất" */}
                          {index === 0 && !item.pinned && (
                            <span className="bg-error text-base-content text-xs font-bold px-2 py-0.5 rounded-full shadow">
                              Mới nhất
                            </span>
                          )}

                          {item.pinned === true && (
                            <TbPinned
                              className="absolute -top-2 -right-2 text-error rotate-30"
                              size={25}
                            />
                          )}
                        </div>
                      )}
                      <div className="mb-3 whitespace-pre-line break-words text-sm leading-relaxed text-base-content [overflow-wrap:anywhere]">
                        {parseMessage(item.message)}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-base-content/80">
                        <svg
                          className="w-3 h-3"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span>Admin {item.author || "MTIEN"} · {item.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FloatingNotification;
