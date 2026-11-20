import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useApp } from "@/context/AppContext";
import ChatDetail from "./View/ChatDetail";
import SocketStatus from "./View/SocketStatus";
import { ConversationItem } from "./View/Conversation/ConversationItem";
import { GroupConversationItem } from "./View/Conversation/GroupConversationItem";
import { markReadMessage } from "@/services";
import { ConversationSkeleton } from "./View/Conversation/ConversationSkeleton";
import { CONFIG } from "@/config";
import { useSocket } from "@/context/SocketContext";
import { useGroupMessagesStore, useMessagesStore } from "@/stores";
import { getToken } from "@/utils";
import { v4 as uuidv4 } from "uuid";

const INITIAL_DISPLAY_COUNT = CONFIG.ui.chat.initialVisible;

// ================= Component: RightHomeScreen =================
const RightHomeScreen = ({ setIsHomeOpen }) => {
  const { navigation } = useApp();
  const { isHomeOpen, setIsChatDetailOpen } = navigation;

  const { socket, isConnected, connectionInfo, reconnect } = useSocket();
  const [selectedChat, setSelectedChat] = useState(null); // conversation đang mở
  useEffect(() => {
    setIsChatDetailOpen(isHomeOpen && Boolean(selectedChat));
    return () => setIsChatDetailOpen(false);
  }, [isHomeOpen, selectedChat, setIsChatDetailOpen]);
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY_COUNT);

  const { idToken } = getToken();

  const {
    messages,
    fetchConversations,
    upsertConversation,
    loading,
    conversations,
    getMessagesByUser,
    loadOlderMessages,
    messageHasMore,
    loadingOlderConversation,
    markConversationRead,
    addMessageWithUserV2,
  } = useMessagesStore();
  const {
    groups,
    messages: groupMessages,
    loadingGroups,
    loadingConversation: loadingGroupConversation,
    loadingOlderConversation: loadingOlderGroup,
    groupHasMore,
    fetchGroups,
    fetchGroupMessages,
    loadOlderGroupMessages,
    markGroupRead,
  } = useGroupMessagesStore();

  const handleListMessage = (upsertConversation) => (data) => {
    if (!Array.isArray(data) || !data.length) return;
    data.forEach(upsertConversation);
  };

  // ================= Socket init =================
  useEffect(() => {
    if (!isHomeOpen || !socket || !idToken) return;

    let awaitingResponse = false;
    let responseTimeoutId;
    const releaseRequest = () => {
      awaitingResponse = false;
      window.clearTimeout(responseTimeoutId);
    };
    const handler = (data) => {
      releaseRequest();
      handleListMessage(upsertConversation)(data);
    };
    const requestList = () => {
      if (
        awaitingResponse ||
        !socket.connected ||
        document.visibilityState !== "visible"
      ) {
        return;
      }
      const latestToken = getToken()?.idToken;
      if (!latestToken) return;
      awaitingResponse = true;
      responseTimeoutId = window.setTimeout(releaseRequest, 12_000);
      socket.emit("get_list_message", {
        requestId: uuidv4(),
        timestamp: null,
        limit: INITIAL_DISPLAY_COUNT,
        token: latestToken,
      }, releaseRequest);
    };
    const requestWhenVisible = () => {
      if (document.visibilityState === "visible") requestList();
    };

    socket.on("new_on_list_message", handler);
    socket.on("connect", requestList);
    document.addEventListener("visibilitychange", requestWhenVisible);
    requestList();

    const intervalId = window.setInterval(requestList, 30_000);

    return () => {
      releaseRequest();
      socket.off("new_on_list_message", handler);
      socket.off("connect", requestList);
      document.removeEventListener("visibilitychange", requestWhenVisible);
      window.clearInterval(intervalId);
    };
  }, [isHomeOpen, idToken, socket, upsertConversation]);

  // ================= Socket listener cho selectedChat =================
  useEffect(() => {
    if (
      !isHomeOpen ||
      !socket ||
      !selectedChat?.uid ||
      selectedChat.type === "group" ||
      !idToken
    ) {
      return;
    }

    let awaitingResponse = false;
    let responseTimeoutId;
    const releaseRequest = () => {
      awaitingResponse = false;
      window.clearTimeout(responseTimeoutId);
    };
    const handleNewMessageWithUserV2 = (data) => {
      releaseRequest();
      if (!data) return;
      addMessageWithUserV2(selectedChat.uid, data);
    };

    socket.on("new_message_with_user", handleNewMessageWithUserV2);

    const requestMessages = () => {
      if (
        awaitingResponse ||
        !socket.connected ||
        document.visibilityState !== "visible"
      ) {
        return;
      }
      const latestToken = getToken()?.idToken;
      if (!latestToken) return;
      awaitingResponse = true;
      responseTimeoutId = window.setTimeout(releaseRequest, 12_000);
      socket.emit("get_messages_with_user", {
        requestId: uuidv4(),
        messageId: selectedChat.uid,
        timestamp: null,
        limit: 50,
        token: latestToken,
      }, releaseRequest);
    };
    const requestWhenVisible = () => {
      if (document.visibilityState === "visible") requestMessages();
    };

    socket.on("connect", requestMessages);
    document.addEventListener("visibilitychange", requestWhenVisible);
    requestMessages();

    const intervalId = window.setInterval(requestMessages, 10_000);

    return () => {
      releaseRequest();
      socket.off("new_message_with_user", handleNewMessageWithUserV2);
      socket.off("connect", requestMessages);
      document.removeEventListener("visibilitychange", requestWhenVisible);
      window.clearInterval(intervalId);
    };
  }, [
    isHomeOpen,
    socket,
    selectedChat?.uid,
    selectedChat?.type,
    idToken,
    addMessageWithUserV2,
  ]);

  // ================= Reset displayCount khi đóng isHomeOpen =================
  useEffect(() => {
    if (!isHomeOpen) {
      setDisplayCount(INITIAL_DISPLAY_COUNT);
    }
  }, [isHomeOpen]);

  // ================= Fetch conversations =================
  useEffect(() => {
    if (!idToken) return;
    void Promise.allSettled([fetchConversations(), fetchGroups()]);
  }, [fetchConversations, fetchGroups, idToken]);

  useEffect(() => {
    if (!isHomeOpen || !idToken) return undefined;
    const refreshGroups = () => {
      if (document.visibilityState === "visible") void fetchGroups();
    };
    const intervalId = window.setInterval(refreshGroups, 30_000);
    document.addEventListener("visibilitychange", refreshGroups);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshGroups);
    };
  }, [fetchGroups, idToken, isHomeOpen]);

  // Group chat currently uses Locket's callable API. Poll only the open group;
  // this catches messages/reactions/deletions without duplicating DM listeners.
  useEffect(() => {
    if (
      !isHomeOpen ||
      selectedChat?.type !== "group" ||
      !selectedChat.uid
    ) {
      return undefined;
    }

    let inFlight = false;
    const refreshGroup = async () => {
      if (document.visibilityState !== "visible" || inFlight) return;
      inFlight = true;
      try {
        await fetchGroupMessages(selectedChat.uid, { force: true });
      } finally {
        inFlight = false;
      }
    };
    const refreshOnRecovery = () => void refreshGroup();

    const intervalId = window.setInterval(refreshGroup, 8_000);
    window.addEventListener("t97:network-recovered", refreshOnRecovery);
    window.addEventListener("t97:realtime-recovered", refreshOnRecovery);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("t97:network-recovered", refreshOnRecovery);
      window.removeEventListener("t97:realtime-recovered", refreshOnRecovery);
    };
  }, [fetchGroupMessages, isHomeOpen, selectedChat]);

  // ================= Chọn chat =================
  const handleSelectChat = async (chat) => {
    setSelectedChat(chat);

    if (!chat?.uid) return;

    if (chat.type === "group") {
      await fetchGroupMessages(chat.uid);
      if (chat.isRead === false) await markGroupRead(chat.uid);
    } else {
      await getMessagesByUser(chat.uid);
      if (chat.isRead === false) {
        await markReadMessage(chat.uid);
        markConversationRead(chat.uid);
      }
    }
  };

  // ================= Load more conversations =================
  const handleLoadMore = () => {
    setDisplayCount((prev) => prev + 10);
  };

  // ================= Sắp xếp và lọc conversations =================
  const normalizeSortTime = (value) => {
    const number = Number(value || 0);
    return number > 0 && number < 100_000_000_000 ? number * 1000 : number;
  };
  const sortedMessages = [
    ...conversations.map((conversation) => ({
      kind: "direct",
      id: `direct:${conversation.uid}`,
      sortTime: normalizeSortTime(
        conversation.latestMessage?.createdAt || conversation.update_time,
      ),
      value: conversation,
    })),
    ...groups.map((group) => ({
      kind: "group",
      id: `group:${group.id}`,
      sortTime: normalizeSortTime(group.last_updated_at),
      value: group,
    })),
  ].sort((a, b) => b.sortTime - a.sortTime);

  const displayedMessages = sortedMessages.slice(0, displayCount);
  const remainingCount = sortedMessages.length - displayCount;

  const messagesByConversation = selectedChat?.uid
    ? selectedChat.type === "group"
      ? groupMessages[selectedChat.uid] || []
      : messages[selectedChat.uid] || []
    : [];

  return (
    <>
      {/* ================= Conversation list ================= */}
      <div
        style={{ background: "var(--bg-app)" }}
        className={`fixed inset-0 flex flex-col transition-transform duration-500 overflow-hidden
        ${
          isHomeOpen
            ? selectedChat
              ? "-translate-x-full"
              : "translate-x-0"
            : "translate-x-full"
        }`}
      >
        <div
          style={{
            background: "var(--surface-dock)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
          }}
          className="sticky top-0 z-20 flex items-center justify-between px-4 py-2.5 border-b border-[var(--border-subtle)] text-[var(--text-primary)]"
        >
          <button
            onClick={() => {
              setIsHomeOpen(false);
              setSelectedChat(null);
            }}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-[var(--surface-pill)] text-[var(--text-primary)] border border-[var(--border-subtle)] hover:opacity-80 transition cursor-pointer z-10 active:scale-95"
            aria-label="Quay lại"
          >
            <ChevronLeft size={24} />
          </button>
          <SocketStatus
            isConnected={isConnected}
            connectionInfo={connectionInfo}
            reconnect={reconnect}
          />
        </div>

        <div
          className="flex-1 space-y-3 overflow-y-auto px-4 pt-4"
          style={{
            paddingBottom: "calc(8rem + env(safe-area-inset-bottom))",
          }}
        >
          {(loading || loadingGroups) && sortedMessages.length === 0 ? (
            // Hiển thị skeleton khi đang loading
            Array.from({ length: INITIAL_DISPLAY_COUNT }).map((_, idx) => (
              <ConversationSkeleton key={idx} />
            ))
          ) : (
            <>
              {/* Danh sách conversations */}
              {displayedMessages.map((item) =>
                item.kind === "group" ? (
                  <GroupConversationItem
                    key={item.id}
                    group={item.value}
                    onSelect={handleSelectChat}
                  />
                ) : (
                  <ConversationItem
                    key={item.id}
                    msg={item.value}
                    onSelect={handleSelectChat}
                  />
                ),
              )}

              {/* Nút "Xem thêm" */}
              {remainingCount > 0 && (
                <button
                  onClick={handleLoadMore}
                  className="w-full py-3 mt-4 text-sm font-semibold text-[var(--accent-primary)] bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:opacity-85 rounded-2xl transition"
                >
                  Xem thêm {remainingCount} cuộc hội thoại
                </button>
              )}

              {/* Thông báo khi không có conversations */}
              {sortedMessages.length === 0 && (
                <div className="text-center text-[var(--text-secondary)] py-8 font-medium">
                  Chưa có cuộc hội thoại nào
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ================= ChatDetail ================= */}
      <ChatDetail
        selectedChat={selectedChat}
        messages={messagesByConversation || []}
        setSelectedChat={setSelectedChat}
        isLoading={
          selectedChat?.type === "group" &&
          loadingGroupConversation === selectedChat?.uid &&
          messagesByConversation.length === 0
        }
        hasMore={Boolean(
          selectedChat?.uid &&
            (selectedChat.type === "group"
              ? groupHasMore[selectedChat.uid]
              : messageHasMore[selectedChat.uid]),
        )}
        isLoadingOlder={
          selectedChat?.type === "group"
            ? loadingOlderGroup === selectedChat?.uid
            : loadingOlderConversation === selectedChat?.uid
        }
        onLoadOlder={() =>
          selectedChat?.type === "group"
            ? loadOlderGroupMessages(selectedChat?.uid)
            : loadOlderMessages(selectedChat?.uid)
        }
      />
    </>
  );
};

export default RightHomeScreen;
