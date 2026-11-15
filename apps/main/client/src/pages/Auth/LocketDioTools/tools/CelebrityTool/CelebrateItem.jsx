import { useState } from "react";
import {
  Bell,
  Check,
  Clock3,
  Copy,
  Plus,
  RefreshCcw,
  Sparkles,
} from "lucide-react";
import { SonnerSuccess } from "@/components/ui/SonnerToast";
import { getAvatarSource, handleAvatarError } from "@/utils/avatar";

const numberFormatter = new Intl.NumberFormat("vi-VN");

const getDisplayName = (user) =>
  `${user?.first_name || ""} ${user?.last_name || ""}`.trim() ||
  user?.name ||
  user?.username ||
  "Celebrity";

export default function CelebrateItem({
  user,
  slotdata,
  onAction,
  onRefresh,
  refreshing = false,
  acting = false,
}) {
  const [cacheBuster] = useState(() => Date.now());
  const displayName = getDisplayName(user);
  const friendCount = Number(slotdata?.friend_count);
  const maxFriends = Number(slotdata?.max_friends);
  const hasSlotData =
    Number.isFinite(friendCount) &&
    Number.isFinite(maxFriends) &&
    maxFriends > 0;
  const remaining = hasSlotData ? Math.max(0, maxFriends - friendCount) : null;
  const percent = hasSlotData
    ? Math.min(100, Math.max(0, (friendCount / maxFriends) * 100))
    : 0;
  const status = user?.friendship_status || "none";
  const profileUrl = user?.username
    ? `https://locket.cam/${user.username}`
    : user?.url || "";
  const canSendRequest = Boolean(profileUrl) && status === "none" && remaining > 0;
  const cacheBustedProfileUrl = profileUrl
    ? `${profileUrl}${profileUrl.includes("?") ? "&" : "?"}_=${cacheBuster}`
    : "";

  const copyProfile = async () => {
    if (!cacheBustedProfileUrl) return;
    await navigator.clipboard.writeText(cacheBustedProfileUrl);
    SonnerSuccess("Đã sao chép profile", cacheBustedProfileUrl);
  };

  const renderAction = () => {
    if (status === "friends") {
      return (
        <span className="inline-flex h-8 items-center gap-1 rounded-md bg-success/15 px-2 text-xs font-semibold text-success">
          <Check className="h-4 w-4" /> Bạn bè
        </span>
      );
    }

    if (status === "outgoing-follow-request") {
      return (
        <span className="inline-flex h-8 items-center gap-1 rounded-md bg-primary/15 px-2 text-xs font-semibold text-primary">
          <Clock3 className="h-4 w-4" /> Đã gửi
        </span>
      );
    }

    if (status === "follower-waitlist") {
      return (
        <span className="inline-flex h-8 items-center gap-1 rounded-md bg-warning/15 px-2 text-xs font-semibold text-warning">
          <Bell className="h-4 w-4" /> Chờ slot
        </span>
      );
    }

    if (!profileUrl) {
      return (
        <span className="inline-flex h-8 items-center rounded-md bg-base-300 px-2 text-xs opacity-60">
          Chưa có link
        </span>
      );
    }

    if (!hasSlotData) {
      return (
        <span className="inline-flex h-8 items-center rounded-md bg-base-300 px-2 text-xs opacity-60">
          Chưa có dữ liệu
        </span>
      );
    }

    if (!canSendRequest) {
      return (
        <button
          type="button"
          onClick={() => onAction?.(user, { waitForSlot: true })}
          disabled={acting}
          className="btn btn-sm btn-warning h-8 min-h-8 rounded-md px-2 text-xs"
          title="Bật thông báo chờ slot trực tiếp"
          aria-label={`Bật thông báo chờ slot của ${displayName}`}
        >
          {acting ? (
            <RefreshCcw className="h-4 w-4 animate-spin" />
          ) : (
            <Bell className="h-4 w-4" />
          )}
          Báo slot
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={() => onAction?.(user, { waitForSlot: false })}
        disabled={acting}
        className="btn btn-sm btn-info h-8 min-h-8 rounded-md px-2"
        title="Gửi yêu cầu trực tiếp"
      >
        {acting ? (
          <RefreshCcw className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        Gửi
      </button>
    );
  };

  return (
    <article className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-2 border-b border-base-300 px-2 py-2.5 last:border-b-0">
      <div className="relative h-12 w-12">
        <img
          src={getAvatarSource(user)}
          alt={displayName}
          className="h-12 w-12 rounded-full border-[3px] border-amber-400 object-cover"
          loading="lazy"
          onError={handleAvatarError}
        />
        <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full bg-amber-400 text-black ring-2 ring-base-100">
          <Sparkles className="h-3 w-3" fill="currentColor" />
        </span>
      </div>

      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1">
          <h3 className="truncate text-sm font-semibold">{displayName}</h3>
          {profileUrl && (
            <button
              type="button"
              onClick={copyProfile}
              className="btn btn-ghost btn-xs h-6 min-h-6 w-6 shrink-0 rounded-md p-0"
              title="Sao chép link profile"
              aria-label={`Sao chép profile ${displayName}`}
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {cacheBustedProfileUrl ? (
          <a
            href={cacheBustedProfileUrl}
            target="_blank"
            rel="noreferrer"
            className="block truncate text-xs text-primary hover:underline"
          >
            @{user?.username || "không có username"}
          </a>
        ) : (
          <p className="truncate text-xs opacity-60">@không có username</p>
        )}

        {hasSlotData && (
          <div className="mt-1.5 flex items-center gap-2">
            <div
              className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-base-300"
              role="progressbar"
              aria-label={`Bạn bè của ${displayName}`}
              aria-valuemin="0"
              aria-valuemax={maxFriends}
              aria-valuenow={friendCount}
            >
              <div
                className={`h-full rounded-full ${remaining ? "bg-info" : "bg-error"}`}
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="shrink-0 text-[11px] tabular-nums opacity-65">
              {numberFormatter.format(friendCount)}/{numberFormatter.format(maxFriends)}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={() => onRefresh?.(user)}
          disabled={refreshing || acting || !user?.username}
          className="btn btn-square btn-ghost h-8 min-h-8 w-8 min-w-8 rounded-md"
          title={`Làm mới dữ liệu ${displayName}`}
          aria-label={`Làm mới dữ liệu ${displayName}`}
        >
          <RefreshCcw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>
        {renderAction()}
      </div>
    </article>
  );
}
