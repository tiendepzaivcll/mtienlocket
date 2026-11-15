import { useState } from "react";
import ChatDialog from "@/components/ui/ChatDialog";
import { allEmojis } from "@/constants/emojis";
import { isSingleEmoji } from "@/utils/chatEmoji";

export default function ChatEmojiPicker({ busy, selectedEmoji, onSelect, onClose }) {
  const [custom, setCustom] = useState("");
  return <ChatDialog title="Chọn cảm xúc" onClose={onClose} busy={busy}>
    <form className="mb-4 flex gap-2" onSubmit={(event) => {
      event.preventDefault();
      if (!busy && isSingleEmoji(custom)) onSelect(custom.trim());
    }}>
      <input aria-label="Nhập một emoji khác" placeholder="Nhập emoji từ bàn phím…"
        className="input input-bordered min-w-0 flex-1" value={custom}
        maxLength={64} disabled={busy} onChange={(event) => setCustom(event.target.value)} />
      <button className="btn btn-primary" disabled={busy || !isSingleEmoji(custom.trim())}>Thả</button>
    </form>
    <div className="grid grid-cols-6 gap-1" aria-label="Các emoji">
      {[...new Set(allEmojis)].map((emoji) => <button key={emoji} type="button"
        aria-label={`Thả ${emoji}`} aria-pressed={selectedEmoji === emoji}
        disabled={busy} onClick={() => onSelect(emoji)}
        className={`h-11 rounded-xl text-2xl hover:bg-base-200 ${selectedEmoji === emoji ? "bg-primary/20" : ""}`}>{emoji}</button>)}
    </div>
    <p className="mt-3 text-xs opacity-60">Chọn lại cảm xúc hiện tại để gỡ.</p>
  </ChatDialog>;
}
