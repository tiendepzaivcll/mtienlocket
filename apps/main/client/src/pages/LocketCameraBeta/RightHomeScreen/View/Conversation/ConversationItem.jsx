import { formatTimeAgoV2 } from "@/utils";
import { ChevronRight } from "lucide-react";
import { useFriendStoreV3 } from "@/stores";
import { getAvatarSource, handleAvatarError } from "@/utils/avatar";

// ================= Component: ConversationItem =================
export const ConversationItem = ({ msg, onSelect }) => {
  const friendMap = useFriendStoreV3((s) => s.friendDetailsMap);

  // 🔹 Lookup O(1)
  const friendDetail = friendMap?.[msg.with_user] ?? null;
  const isUnread = msg.isRead === false;

  return (
    <div
      onClick={() =>
        onSelect({
          uid: msg.uid,
          type: "direct",
          with_user: msg.with_user,
          isRead: msg.isRead,
          friend: friendDetail || null,
        })
      }
      className={`relative w-full flex items-center gap-3.5 p-3.5 rounded-3xl shadow-sm border border-[var(--border-subtle)] bg-[var(--surface-card)] cursor-pointer transition active:scale-[0.99]`}
    >
      {/* Avatar */}
      {friendDetail ? (
        <img
          src={getAvatarSource(friendDetail)}
          alt={friendDetail?.firstName || "user"}
          onError={handleAvatarError}
          className={`w-14 h-14 rounded-full p-0.5 object-cover transition-all duration-200 shrink-0
            ${
              isUnread
                ? "border-[2.5px] border-[var(--accent-primary)]"
                : "border-[2.5px] border-[var(--border-subtle)]"
            }`}
        />
      ) : (
        <div className="w-14 h-14 rounded-full bg-[var(--border-subtle)] animate-pulse shrink-0" />
      )}

      {/* Nội dung */}
      <div className="flex-1 min-w-0 pr-6">
        <p
          className={`text-base truncate text-[var(--text-primary)] ${
            isUnread ? "font-bold" : "font-semibold opacity-90"
          }`}
        >
          {friendDetail?.firstName} {friendDetail?.lastName} ~{" "}
          {formatTimeAgoV2(Number(msg.latestMessage?.createdAt))}
        </p>
        <p
          className={`text-sm truncate pt-0.5 text-[var(--text-secondary)] ${
            isUnread ? "font-medium" : "opacity-80"
          }`}
        >
          {msg.latestMessage?.replyMoment
            ? "Đã trả lời Locket của bạn!"
            : msg.latestMessage?.body || ""}
        </p>
      </div>

      {/* Chevron */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2">
        <ChevronRight className="w-5 h-5 text-[var(--text-secondary)]" />
      </div>
    </div>
  );
};
