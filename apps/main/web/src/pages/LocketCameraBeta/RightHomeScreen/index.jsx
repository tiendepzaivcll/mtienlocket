import { useEffect, useState, useRef } from "react";
import { ChevronLeft } from "lucide-react";
import { useApp } from "@/context/AppContext";
import ChatDetail from "./View/ChatDetail";
import { ConversationItem } from "./View/Conversation/ConversationItem";
import { markReadMessage } from "@/services";
import { ConversationSkeleton } from "./View/Conversation/ConversationSkeleton";
import { CONFIG } from "@/config";
import { useAuthStore, useMessagesStore } from "@/stores";

const INITIAL_DISPLAY_COUNT = CONFIG.ui.chat.initialVisible;
const POLLING_INTERVAL = 5000; // 5 giây

// ================= Component: RightHomeScreen =================
const RightHomeScreen = ({ setIsHomeOpen }) => {
  const { user } = useAuthStore();
  const { navigation } = useApp();
  const { isHomeOpen } = navigation;

  const [selectedChat, setSelectedChat] = useState(null); // conversation đang mở
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY_COUNT);

  const idToken = localStorage.getItem("idToken");

  const {
    messages,
    fetchConversations,
    loading,
    conversations,
    getMessagesByUser,
    refreshMessagesByUser,
  } = useMessagesStore();

  // ================= Polling refs =================
  const conversationsPollingRef = useRef(null);
  const messagesPollingRef = useRef(null);

  // ================= Polling conversations list =================
  useEffect(() => {
    if (!idToken || !isHomeOpen) return;

    // Polling conversations mỗi 5 giây
    const pollConversations = () => {
      fetchConversations(true); // true = silent refresh
    };

    conversationsPollingRef.current = setInterval(pollConversations, POLLING_INTERVAL);

    return () => {
      if (conversationsPollingRef.current) {
        clearInterval(conversationsPollingRef.current);
      }
    };
  }, [idToken, isHomeOpen]);

  // ================= Polling messages khi đang xem chat =================
  useEffect(() => {
    if (!selectedChat?.uid) return;

    // Polling messages mỗi 5 giây
    const pollMessages = () => {
      refreshMessagesByUser(selectedChat.uid, selectedChat.with_user);
    };

    messagesPollingRef.current = setInterval(pollMessages, POLLING_INTERVAL);

    return () => {
      if (messagesPollingRef.current) {
        clearInterval(messagesPollingRef.current);
      }
    };
  }, [selectedChat?.uid, selectedChat?.with_user]);

  // ================= Reset displayCount khi đóng isHomeOpen =================
  useEffect(() => {
    if (!isHomeOpen) {
      setDisplayCount(INITIAL_DISPLAY_COUNT);
    }
  }, [isHomeOpen]);

  // ================= Fetch conversations =================
  useEffect(() => {
    if (!idToken) return;
    fetchConversations();
  }, [idToken]);

  // ================= Chọn chat =================
  const handleSelectChat = async (chat) => {
    setSelectedChat(chat);

    if (!chat?.uid) return;

    await getMessagesByUser(chat.uid, chat.with_user);

    if (chat.isRead === false) {
      await markReadMessage(chat.uid);
    }
  };

  // ================= Load more conversations =================
  const handleLoadMore = () => {
    setDisplayCount((prev) => prev + 10);
  };

  // ================= Sắp xếp và lọc conversations =================
  const sortedMessages = conversations
    ?.slice()
    .sort(
      (a, b) =>
        Number(b.latestMessage?.createdAt || 0) -
        Number(a.latestMessage?.createdAt || 0)
    );

  const displayedMessages = sortedMessages.slice(0, displayCount);
  const remainingCount = sortedMessages.length - displayCount;

  const messagesByConversation = selectedChat?.uid
    ? messages[selectedChat.uid] || []
    : [];

  return (
    <>
      {/* ================= Conversation list ================= */}
      <div
        className={`fixed inset-0 flex flex-col transition-transform duration-500 bg-base-100 overflow-hidden
        ${
          isHomeOpen
            ? selectedChat
              ? "-translate-x-full"
              : "translate-x-0"
            : "translate-x-full"
        }`}
      >
        <div className="relative flex items-center shadow-lg justify-between px-4 py-2 text-base-content">
          <button
            onClick={() => {
              setIsHomeOpen(false);
              setSelectedChat(null);
            }}
            className="btn p-1 border-0 rounded-full hover:bg-base-200 transition cursor-pointer z-10"
          >
            <ChevronLeft size={30} />
          </button>
          <h1 className="text-base font-bold tracking-wide">Tin nhắn</h1>
          <div className="w-8 h-8 shrink-0" aria-hidden="true" />
        </div>

        <div className="flex-1 px-4 py-6 overflow-y-auto space-y-4">
          {loading ? (
            // Hiển thị skeleton khi đang loading
            Array.from({ length: INITIAL_DISPLAY_COUNT }).map((_, idx) => (
              <ConversationSkeleton key={idx} />
            ))
          ) : (
            <>
              {/* Danh sách conversations */}
              {displayedMessages.map((msg) => (
                <ConversationItem
                  key={msg.uid}
                  msg={msg}
                  onSelect={handleSelectChat}
                />
              ))}

              {/* Nút "Xem thêm" */}
              {remainingCount > 0 && (
                <button
                  onClick={handleLoadMore}
                  className="w-full py-3 mt-4 text-sm font-medium text-primary hover:bg-base-200 rounded-lg transition-colors duration-200"
                >
                  Xem thêm {remainingCount} cuộc hội thoại
                </button>
              )}

              {/* Thông báo khi không có conversations */}
              {sortedMessages.length === 0 && (
                <div className="text-center text-base-content/60 py-8">
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
      />
    </>
  );
};

export default RightHomeScreen;
