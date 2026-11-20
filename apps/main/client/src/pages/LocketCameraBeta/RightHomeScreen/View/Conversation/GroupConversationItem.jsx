import { ChevronRight, Users } from "lucide-react";
import { formatTimeAgoV2 } from "@/utils";
import { handleAvatarError } from "@/utils/avatar";

const latestMessageText = (group) => {
  const latest = group?.latest_message;
  if (!latest) return "Chưa có tin nhắn";
  if (latest.content?.content) return latest.content.content;
  if (latest.content?.type === "moment") return "Đã gửi một Locket";
  return "Nhóm vừa được cập nhật";
};

export function GroupConversationItem({ group, onSelect }) {
  const unread = Number(group?.unread_count || 0);

  return (
    <button
      type="button"
      onClick={() =>
        onSelect({
          uid: group.id,
          type: "group",
          group,
          isRead: unread === 0,
        })
      }
      className={`relative flex w-full items-center gap-3.5 rounded-3xl p-3.5 text-left shadow-sm border border-[var(--border-subtle)] bg-[var(--surface-card)] transition active:scale-[0.99]`}
    >
      {group.image_url ? (
        <img
          src={group.image_url}
          alt={group.name || "Nhóm chat"}
          onError={handleAvatarError}
          className={`h-14 w-14 rounded-full border-[2.5px] object-cover p-0.5 shrink-0 ${
            unread ? "border-[var(--accent-primary)]" : "border-[var(--border-subtle)]"
          }`}
        />
      ) : (
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-full border-[2.5px] shrink-0 ${
            unread ? "border-[var(--accent-primary)]" : "border-[var(--border-subtle)]"
          } bg-[var(--surface-pill)] text-[var(--accent-primary)]`}
        >
          <Users size={26} />
        </div>
      )}

      <div className="min-w-0 flex-1 pr-6">
        <p className={`truncate text-base text-[var(--text-primary)] ${unread ? "font-bold" : "font-semibold opacity-90"}`}>
          {group.name || "Nhóm chat"}
          {group.last_updated_at ? ` ~ ${formatTimeAgoV2(Number(group.last_updated_at))}` : ""}
        </p>
        <p className={`truncate pt-0.5 text-sm text-[var(--text-secondary)] ${unread ? "font-medium" : "opacity-80"}`}>
          {latestMessageText(group)}
        </p>
      </div>

      {unread > 0 && (
        <span className="mr-8 min-w-5 rounded-full bg-[var(--accent-primary)] px-1.5 py-0.5 text-center text-xs font-bold text-primary-content">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
      <ChevronRight className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--text-secondary)]" />
    </button>
  );
}
