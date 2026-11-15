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
      className={`relative flex w-full items-center gap-3 rounded-3xl p-3 text-left shadow-sm transition ${
        unread ? "bg-primary/10" : "bg-base-200"
      }`}
    >
      {group.image_url ? (
        <img
          src={group.image_url}
          alt={group.name || "Nhóm chat"}
          onError={handleAvatarError}
          className={`h-15 w-15 rounded-full border-[3px] object-cover p-0.5 ${
            unread ? "border-amber-400" : "border-gray-300"
          }`}
        />
      ) : (
        <div
          className={`flex h-15 w-15 items-center justify-center rounded-full border-[3px] ${
            unread ? "border-amber-400" : "border-gray-300"
          } bg-base-100 text-primary`}
        >
          <Users size={28} />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className={`truncate text-lg ${unread ? "font-bold" : "font-semibold opacity-60"}`}>
          {group.name || "Nhóm chat"}
          {group.last_updated_at ? ` ~ ${formatTimeAgoV2(Number(group.last_updated_at))}` : ""}
        </p>
        <p className={`truncate pt-1 text-md font-semibold ${unread ? "text-base-content" : "opacity-50"}`}>
          {latestMessageText(group)}
        </p>
      </div>

      {unread > 0 && (
        <span className="mr-8 min-w-5 rounded-full bg-primary px-1.5 py-0.5 text-center text-xs text-primary-content">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
      <ChevronRight className="absolute right-4 top-1/2 h-6 w-6 -translate-y-1/2 opacity-50" />
    </button>
  );
}
