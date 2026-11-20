import { useEffect, useRef, useState } from "react";
import { Ban, ChevronLeft, Ellipsis, UserMinus, Users } from "lucide-react";
import { getAvatarSource, handleAvatarError } from "@/utils/avatar";
import { getToken } from "@/utils";
import { performChatFriendAction } from "@/services";
import { useFriendStoreV3 } from "@/stores";
import ChatDialog from "@/components/ui/ChatDialog";
import { SonnerError, SonnerSuccess } from "@/components/ui/SonnerToast";

const ChatDetailHeader = ({ selectedChat, onBack }) => {
  const isGroup = selectedChat?.type === "group";
  const group = selectedChat?.group;
  const [menuOpen, setMenuOpen] = useState(false);
  const [action, setAction] = useState(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const menuRef = useRef(null);
  const removeFriendLocal = useFriendStoreV3((state) => state.removeFriendLocal);
  // Conversation IDs are not user IDs. Use only the peer's explicit UID.
  const targetUid = selectedChat?.with_user || selectedChat?.friend?.uid;
  const canAct = !isGroup && targetUid && targetUid !== getToken()?.localId;
  const friendName = [selectedChat?.friend?.firstName, selectedChat?.friend?.lastName]
    .filter(Boolean).join(" ") || selectedChat?.friend?.username || "người này";

  useEffect(() => { setMenuOpen(false); setAction(null); }, [selectedChat?.uid]);
  useEffect(() => {
    if (!menuOpen) return;
    const outside = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
    };
    const escape = (event) => { if (event.key === "Escape") setMenuOpen(false); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [menuOpen]);

  const confirmAction = async () => {
    if (!canAct || !action || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await performChatFriendAction(action, targetUid);
      // Local data changes only after the server acknowledges the mutation.
      try { await removeFriendLocal(targetUid); } catch {
        SonnerError("Locket đã xử lý nhưng chưa cập nhật được bộ nhớ trên máy. Hãy tải lại web.");
      }
      SonnerSuccess(action === "block" ? "Đã chặn người dùng" : "Đã xóa bạn");
      setAction(null);
      onBack();
    } catch (error) {
      SonnerError("Không thể hoàn tất thao tác", error?.response?.data?.message || error?.message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--bg-app)]/85 backdrop-blur-md border-b border-[var(--border-subtle)] text-[var(--text-primary)]">
      {/* Left */}
      <div className="flex items-center">
        <button
          onClick={onBack}
          disabled={busy}
          aria-label="Quay lại danh sách tin nhắn"
          className="flex items-center justify-center w-10 h-10 rounded-full bg-[var(--surface-pill)] text-[var(--text-primary)] border border-[var(--border-subtle)] hover:opacity-80 transition cursor-pointer active:scale-95"
        >
          <ChevronLeft size={24} />
        </button>
      </div>

      {/* Center */}
      <div className="flex-1 flex justify-center items-center flex-row gap-3 text-center">
        {isGroup && !group?.image_url ? (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-pill)] text-[var(--accent-primary)]">
            <Users size={20} />
          </div>
        ) : (
          <img
            src={
              isGroup ? group?.image_url : getAvatarSource(selectedChat?.friend)
            }
            alt="avatar"
            onError={handleAvatarError}
            className="w-9 h-9 rounded-full object-cover border border-[var(--border-subtle)]"
          />
        )}
        <h2 className="text-base font-bold truncate text-[var(--text-primary)]">
          {isGroup
            ? group?.name || "Nhóm chat"
            : selectedChat?.friend
            ? friendName
            : "Chi tiết cuộc trò chuyện"}
        </h2>
      </div>

      <div ref={menuRef} className="relative flex w-10 items-center justify-end">
        {canAct && <button type="button" aria-label="Tùy chọn cuộc trò chuyện"
          aria-expanded={menuOpen} aria-haspopup="menu" disabled={busy}
          onClick={() => setMenuOpen((value) => !value)}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-[var(--surface-pill)] text-[var(--text-primary)] border border-[var(--border-subtle)] hover:opacity-80 transition cursor-pointer active:scale-95">
          <Ellipsis size={22} />
        </button>}
        {canAct && menuOpen && <div role="menu" aria-label="Tùy chọn bạn bè"
          className="absolute right-0 top-full z-[90] mt-2 w-44 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-app)] p-2 shadow-xl text-[var(--text-primary)]">
          <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setAction("remove"); }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-[var(--surface-pill)]"><UserMinus size={17} /> Xóa bạn</button>
          <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setAction("block"); }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-error hover:bg-error/10"><Ban size={17} /> Chặn</button>
        </div>}
      </div>
      {action && <ChatDialog title={action === "block" ? "Chặn người dùng?" : "Xóa bạn?"}
        busy={busy} onClose={() => setAction(null)}>
        <p className="mb-5 text-sm">{action === "block"
          ? `Bạn có chắc muốn chặn ${friendName} trên Locket?`
          : `Bạn có chắc muốn xóa ${friendName} khỏi danh sách bạn bè trên Locket?`}</p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setAction(null)}>Hủy</button>
          <button type="button" className="btn btn-error" disabled={busy} onClick={confirmAction}>
            {busy ? "Đang xử lý…" : action === "block" ? "Chặn" : "Xóa bạn"}
          </button>
        </div>
      </ChatDialog>}
    </div>
  );
};

export default ChatDetailHeader;
