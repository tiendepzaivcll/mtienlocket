import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Clipboard, Plus, SmilePlus, Trash2 } from "lucide-react";
import ChatDetailHeader from "../Layout/HeaderChatDetail";
import ChatDetailFooter from "../Layout/InputChatDetail";
import ChatEmojiPicker from "../Layout/ChatEmojiPicker";
import {
  deleteGroupMessage,
  deleteMessage,
  reactToGroupMessage,
  removeGroupMessageReaction,
  removeReactionOnMessage,
  sendReactionOnMessage,
} from "@/services";
import { SonnerError, SonnerSuccess } from "@/components/ui/SonnerToast";
import {
  useFriendStoreV3,
  useGroupMessagesStore,
  useMessagesStore,
} from "@/stores";
import { getToken } from "@/utils";
import { getAvatarSource, handleAvatarError } from "@/utils/avatar";
import { reactionUserId } from "@/stores/MessageStores/messageMutations";
import { getChatMenuPlacement } from "@/utils/chatMenuPlacement";
import { getQuickReactions } from "@/utils/chatEmoji";

const QUICK_REACTIONS = ["💛", "😂", "😍", "😢", "👍", "🔥"];

const formatMessageTime = (value) => {
  const number = Number(value || 0);
  if (!number) return "";
  const milliseconds = number > 100_000_000_000 ? number : number * 1000;
  return new Date(milliseconds).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const groupReactions = (reactions = []) => {
  const counts = new Map();
  reactions.forEach((reaction) => {
    if (reaction?.emoji) {
      counts.set(reaction.emoji, (counts.get(reaction.emoji) || 0) + 1);
    }
  });
  return [...counts.entries()];
};

const ChatMessageItem = ({
  msg,
  selectedChat,
  preferredReaction,
  onChooseCustomReaction,
}) => {
  const { localId: me } = getToken();
  const isGroup = selectedChat?.type === "group";
  const isMe = (msg.sender || msg.user_id) === me;
  const [showMenu, setShowMenu] = useState(false);
  const [menuPlacement, setMenuPlacement] = useState("above");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const holdTimerRef = useRef(null);
  const bubbleRef = useRef(null);
  const menuRef = useRef(null);
  const friendMap = useFriendStoreV3((state) => state.friendDetailsMap);
  const updateDirectReaction = useMessagesStore((state) => state.updateReaction);
  const removeDirectMessage = useMessagesStore((state) => state.removeMessage);
  const updateGroupReaction = useGroupMessagesStore(
    (state) => state.updateReaction,
  );
  const removeGroupMessage = useGroupMessagesStore(
    (state) => state.removeMessage,
  );

  const sender = friendMap?.[msg.sender || msg.user_id];
  const myReaction = (msg.reactions || []).find(
    (reaction) => reactionUserId(reaction) === me,
  )?.emoji;
  const groupedReactions = groupReactions(msg.reactions);
  const quickReactions = useMemo(
    () => getQuickReactions(QUICK_REACTIONS, preferredReaction),
    [preferredReaction],
  );

  const clearHold = useCallback(() => {
    if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
  }, []);
  useEffect(() => clearHold, [clearHold]);

  const updateMenuPlacement = useCallback((measuredMenuHeight = 190) => {
    const bubble = bubbleRef.current;
    if (!bubble) return;
    const anchor = bubble.getBoundingClientRect();
    const scrollRegion = bubble.closest("[data-chat-scroll-region]");
    const boundary = scrollRegion?.getBoundingClientRect() || {
      top: 0,
      bottom: window.visualViewport?.height || window.innerHeight,
    };
    setMenuPlacement(
      getChatMenuPlacement({
        anchorTop: anchor.top,
        anchorBottom: anchor.bottom,
        boundaryTop: boundary.top,
        boundaryBottom: boundary.bottom,
        menuHeight: measuredMenuHeight,
      }),
    );
  }, []);

  const openMenu = useCallback(() => {
    updateMenuPlacement();
    setShowMenu(true);
  }, [updateMenuPlacement]);

  useLayoutEffect(() => {
    if (!showMenu || !menuRef.current) return;
    updateMenuPlacement(menuRef.current.getBoundingClientRect().height);
  }, [showMenu, updateMenuPlacement]);

  const handleReaction = async (emoji) => {
    if (busyRef.current || !me) return;
    busyRef.current = true;
    const shouldRemove = myReaction === emoji;
    setBusy(true);
    try {
      if (isGroup) {
        if (shouldRemove) {
          await removeGroupMessageReaction({
            groupId: selectedChat.uid,
            messageId: msg.id,
          });
        } else {
          await reactToGroupMessage({
            groupId: selectedChat.uid,
            messageId: msg.id,
            emoji,
          });
        }
        await updateGroupReaction(
          selectedChat.uid,
          msg.id,
          me,
          shouldRemove ? null : emoji,
        );
      } else {
        if (shouldRemove) {
          await removeReactionOnMessage({
            conversationId: selectedChat.uid,
            messageId: msg.id,
          });
        } else {
          await sendReactionOnMessage({
            conversationId: selectedChat.uid,
            messageId: msg.id,
            emoji,
          });
        }
        await updateDirectReaction(
          selectedChat.uid,
          msg.id,
          me,
          shouldRemove ? null : emoji,
        );
      }
      setShowMenu(false);
      setShowEmojiPicker(false);
    } catch (error) {
      SonnerError(
        shouldRemove ? "Không thể gỡ cảm xúc" : "Không thể thả cảm xúc",
        error?.response?.data?.error?.message || error?.message,
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!isMe || busy) return;
    if (!window.confirm("Thu hồi tin nhắn này?")) return;
    setBusy(true);
    try {
      if (isGroup) {
        await deleteGroupMessage({
          groupId: selectedChat.uid,
          messageId: msg.id,
        });
        await removeGroupMessage(selectedChat.uid, msg.id);
      } else {
        await deleteMessage({
          conversationId: selectedChat.uid,
          messageId: msg.id,
        });
        await removeDirectMessage(selectedChat.uid, msg.id);
      }
      setShowMenu(false);
      SonnerSuccess("Đã thu hồi tin nhắn");
    } catch (error) {
      SonnerError(
        "Không thể thu hồi tin nhắn",
        error?.response?.data?.error?.message || error?.message,
      );
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(msg.text || "");
      SonnerSuccess("Đã sao chép tin nhắn");
      setShowMenu(false);
    } catch {
      SonnerError("Không thể sao chép tin nhắn");
    }
  };

  const contentType = msg.content?.type;
  const isSystemMessage =
    isGroup &&
    [
      "userAddedToGroup",
      "userRemovedFromGroup",
      "groupNameChanged",
      "groupImageChanged",
    ].includes(contentType);

  if (isSystemMessage) {
    return (
      <div className="mx-auto max-w-[85%] rounded-full bg-base-200 px-3 py-1 text-center text-xs opacity-70">
        {msg.text || "Nhóm vừa được cập nhật"}
      </div>
    );
  }

  return (
    <div className={`chat ${isMe ? "chat-end" : "chat-start"}`}>
      {isGroup && !isMe && (
        <div className="chat-image avatar">
          <div className="h-8 w-8 overflow-hidden rounded-full border border-base-300">
            <img
              src={getAvatarSource(sender)}
              alt={sender?.firstName || "Thành viên"}
              onError={handleAvatarError}
            />
          </div>
        </div>
      )}
      {isGroup && !isMe && (
        <div className="chat-header mb-1 text-[10px] font-semibold opacity-60">
          {sender
            ? `${sender.firstName || ""} ${sender.lastName || ""}`.trim()
            : (msg.sender || msg.user_id || "Thành viên").slice(0, 8)}
        </div>
      )}

      {showMenu && (
        <button
          type="button"
          aria-label="Đóng menu tin nhắn"
          className="fixed inset-0 z-[70] cursor-default bg-base-100/30 backdrop-blur-[2px]"
          onClick={() => setShowMenu(false)}
        />
      )}

      <div
        ref={bubbleRef}
        className={`chat-bubble relative max-w-xs select-none bg-base-200 font-medium text-base-content md:max-w-md ${
          showMenu ? "z-[71] ring-2 ring-primary/30" : ""
        } ${groupedReactions.length ? "mt-4" : ""}`}
        onContextMenu={(event) => {
          event.preventDefault();
          openMenu();
        }}
        onTouchStart={() => {
          clearHold();
          holdTimerRef.current = window.setTimeout(openMenu, 450);
        }}
        onTouchMove={clearHold}
        onTouchEnd={clearHold}
        onTouchCancel={clearHold}
      >
        {msg.reply_moment && (
          <div className="mb-1 text-xs italic opacity-70">↪ Đã trả lời Locket</div>
        )}
        {msg.thumbnail_url && (
          <img
            src={msg.thumbnail_url}
            alt="Nội dung đính kèm"
            className="my-1 h-32 w-32 rounded-lg object-cover"
          />
        )}
        <span className="break-words">{msg.text}</span>

        {groupedReactions.length > 0 && (
          <div
            className={`absolute -top-6 flex rounded-full bg-base-100 p-1 text-sm shadow ${
              isMe ? "left-0" : "right-0"
            }`}
          >
            {groupedReactions.slice(0, 3).map(([emoji, count]) => (
              <span key={emoji} className="px-0.5">
                {emoji}{count > 1 ? count : ""}
              </span>
            ))}
          </div>
        )}

        {showMenu && (
          <div
            ref={menuRef}
            className={`absolute z-[72] min-w-[230px] rounded-2xl border border-base-300 bg-base-100 p-2 shadow-xl ${
              isMe ? "right-0" : "left-0"
            } ${
              menuPlacement === "below" ? "top-full mt-2" : "bottom-full mb-2"
            }`}
          >
            <div className="mb-2 flex items-center gap-1 border-b border-base-300 pb-2">
              {quickReactions.map((emoji) => (
                <button
                  type="button"
                  key={emoji}
                  disabled={busy}
                  onClick={() => handleReaction(emoji)}
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-lg ${
                    myReaction === emoji ? "bg-primary/20" : "hover:bg-base-200"
                  }`}
                >
                  {emoji}
                </button>
              ))}
              <button
                type="button"
                aria-label="Thêm emoji khác"
                disabled={busy}
                onClick={() => {
                  clearHold();
                  setShowMenu(false);
                  setShowEmojiPicker(true);
                }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base hover:bg-base-200"
              >
                <Plus size={19} strokeWidth={2.5} />
              </button>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-base-200"
            >
              <Clipboard size={18} /> Sao chép
            </button>
            {!isMe && (
              <div className="flex items-center gap-3 px-3 py-2 text-xs opacity-50">
                <SmilePlus size={18} /> Chạm lại emoji đang chọn để gỡ
              </div>
            )}
            {isMe && (
              <button
                type="button"
                disabled={busy}
                onClick={handleDelete}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-error hover:bg-error/10"
              >
                <Trash2 size={18} /> Thu hồi
              </button>
            )}
          </div>
        )}
      </div>

      <div className="chat-footer text-xs opacity-50">
        {formatMessageTime(msg.create_time || msg.created_at)}
      </div>
      {showEmojiPicker && <ChatEmojiPicker busy={busy} selectedEmoji={myReaction}
        onSelect={(emoji) => {
          onChooseCustomReaction(emoji);
          handleReaction(emoji);
        }} onClose={() => setShowEmojiPicker(false)} />}
    </div>
  );
};

const ChatDetail = ({
  selectedChat,
  messages,
  setSelectedChat,
  isLoading,
  hasMore,
  isLoadingOlder,
  onLoadOlder,
}) => {
  const messagesContainerRef = useRef(null);
  const [preferredReaction, setPreferredReaction] = useState("");
  const sortedMessages = useMemo(
    () =>
      [...messages].sort(
        (a, b) => Number(a.create_time) - Number(b.create_time),
      ),
    [messages],
  );
  const latestMessageId = sortedMessages.at(-1)?.id || null;

  useLayoutEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
  }, [latestMessageId, selectedChat]);

  const handleLoadOlder = async () => {
    const container = messagesContainerRef.current;
    const previousHeight = container?.scrollHeight || 0;
    const previousTop = container?.scrollTop || 0;
    await onLoadOlder?.();
    window.requestAnimationFrame(() => {
      if (!container) return;
      container.scrollTop =
        previousTop + Math.max(0, container.scrollHeight - previousHeight);
    });
  };

  return (
    <div
      className={`fixed inset-0 z-60 flex flex-col bg-base-100 text-base-content transition-transform duration-500 ${
        selectedChat ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="sticky top-0 z-10 bg-base-100">
        <ChatDetailHeader
          selectedChat={selectedChat}
          onBack={() => setSelectedChat(null)}
        />
      </div>
      <div
        ref={messagesContainerRef}
        data-chat-scroll-region
        className="h-full flex-1 space-y-4 overflow-y-auto p-4"
      >
        {hasMore && (
          <button
            type="button"
            onClick={handleLoadOlder}
            disabled={isLoadingOlder}
            className="btn btn-sm mx-auto flex rounded-full"
          >
            {isLoadingOlder ? "Đang tải…" : "Tải tin nhắn cũ hơn"}
          </button>
        )}
        {isLoading ? (
          <div className="flex flex-col space-y-4">
            {[...Array(5)].map((_, index) => (
              <div
                key={index}
                className="h-10 w-2/3 animate-pulse rounded-lg bg-base-300"
              />
            ))}
          </div>
        ) : sortedMessages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm opacity-60">
            Chưa có tin nhắn nào
          </div>
        ) : (
          [...new Map(sortedMessages.filter((msg) => msg?.id).map((msg) => [msg.id, msg])).values()].map(
            (msg) => (
              <ChatMessageItem
                key={msg.id}
                msg={msg}
                selectedChat={selectedChat}
                preferredReaction={preferredReaction}
                onChooseCustomReaction={setPreferredReaction}
              />
            ),
          )
        )}
      </div>
      <div className="sticky bottom-4 z-10 p-2">
        <ChatDetailFooter selectedChat={selectedChat} />
      </div>
    </div>
  );
};

export default ChatDetail;
