import React, { useState, useRef } from "react";
import { ArrowUp } from "lucide-react";
import { sendGroupMessage, sendMessage } from "@/services";
import { SonnerError } from "@/components/ui/SonnerToast";
import { getToken } from "@/utils";
import { useSocket } from "@/context/SocketContext";
import { generateUUIDv4Upper } from "@/utils/generate/uuid";
import { useGroupMessagesStore } from "@/stores";

const ChatDetailFooter = ({ selectedChat }) => {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendStatus, setSendStatus] = useState("idle");
  const textareaRef = useRef(null);
  const pendingClientTokenRef = useRef(null);
  const { socket } = useSocket();
  const fetchGroupMessages = useGroupMessagesStore(
    (state) => state.fetchGroupMessages,
  );
  const fetchGroups = useGroupMessagesStore((state) => state.fetchGroups);

  const MAX_ROWS = 6; // số dòng tối đa

  const handleSend = async () => {
    if (!message.trim() || loading) return;

    setLoading(true);
    setSendStatus("sending");
    try {
      const isGroup = selectedChat?.type === "group";
      const receiverUid = selectedChat?.friend?.uid || selectedChat?.with_user;

      if (!isGroup && !receiverUid) {
        SonnerError("Không tìm thấy người nhận.");
        return;
      }

      const text = message.trim();
      const { idToken, localId } = getToken();
      const clientToken =
        pendingClientTokenRef.current || generateUUIDv4Upper();
      pendingClientTokenRef.current = clientToken;
      const res = isGroup
        ? await sendGroupMessage({
            groupId: selectedChat.uid,
            message: text,
            clientToken,
          })
        : await sendMessage({
            sender: localId,
            receiver_uid: receiverUid,
            message: text,
            client_token: clientToken,
          });

      const isSuccessful =
        res?.result?.status === 200 ||
        res?.result?.status === "200" ||
        res?.result ||
        res?.data ||
        res?.success !== false;

      if (!isSuccessful) {
        console.warn("Send message failed:", res);
        SonnerError("Gửi tin nhắn thất bại!");
        setSendStatus("failed");
        return;
      }

      setMessage("");
      setSendStatus("sent");
      pendingClientTokenRef.current = null;
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto"; // reset lại
      }

      // Chỉ hiển thị bản tin đã được Locket xác nhận. Trước đây client tự tạo
      // UUID tạm rồi socket trả về ID thật, khiến một lần gửi hiện thành hai tin.
      if (isGroup) {
        await Promise.allSettled([
          fetchGroupMessages(selectedChat.uid, { force: true }),
          fetchGroups(),
        ]);
      } else {
        socket?.emit("get_messages_with_user", {
          messageId: selectedChat.uid,
          timestamp: null,
          token: idToken,
        });
      }
    } catch (error) {
      console.error("Send message error:", error);
      SonnerError(
        "Gửi tin nhắn thất bại!",
        error?.response?.data?.error?.message ||
          error?.response?.data?.message ||
          error?.message ||
          "Không rõ nguyên nhân",
      );
      setSendStatus("failed");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setMessage(e.target.value);

    const target = e.target;
    target.style.height = "auto"; // reset để tính lại

    const lineHeight = 24; // px (nên khớp với leading-6 = 1.5rem)
    const maxHeight = lineHeight * MAX_ROWS;

    // nếu chiều cao vượt quá maxHeight thì giữ maxHeight và cho scroll
    target.style.height =
      target.scrollHeight > maxHeight
        ? maxHeight + "px"
        : target.scrollHeight + "px";
  };

  const disabled = loading || !message.trim();

  return (
    <div className="">
      <div className="flex w-full items-end gap-3 px-4 py-3 bg-[var(--surface-card)] border border-[var(--border-subtle)] text-[var(--text-primary)] rounded-3xl shadow-md relative">
        <textarea
          ref={textareaRef}
          placeholder={
            selectedChat?.type === "group"
              ? "Gửi tin nhắn vào nhóm..."
              : "Gửi tin nhắn..."
          }
          value={message}
          onChange={handleChange}
          rows={1}
          className="flex-1 bg-transparent focus:outline-none font-semibold pl-1 pr-8 resize-none disabled:opacity-50 leading-6 overflow-y-auto text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]"
          disabled={loading}
        />
        <button
          onClick={handleSend}
          disabled={disabled}
          style={!disabled ? { background: "var(--shutter-gradient)", color: "#FFFFFF", border: "none" } : undefined}
          className={`btn absolute right-3 bottom-2.5 p-1 btn-sm btn-circle flex justify-center items-center disabled:opacity-40 transition-all ${
            disabled
              ? "bg-[var(--surface-pill)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
              : "shadow-md hover:scale-105 active:scale-95 text-white"
          }`}
        >
          {loading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
          ) : (
            <ArrowUp className="w-5 h-5 text-current" />
          )}
        </button>
      </div>
      {sendStatus !== "idle" && (
        <p
          className={`mt-1 px-4 text-xs ${
            sendStatus === "failed" ? "text-error" : "opacity-60"
          }`}
        >
          {sendStatus === "sending"
            ? "Đang gửi…"
            : sendStatus === "sent"
              ? "Đã gửi và đang đồng bộ với Locket"
              : "Gửi lỗi — nội dung và mã retry đã được giữ lại"}
        </p>
      )}
    </div>
  );
};

export default ChatDetailFooter;
