import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BellRing,
  Bot,
  LoaderCircle,
  Pause,
  Play,
  RefreshCcw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  addSlotWatch,
  checkSlotWatchNow,
  enableSlotMonitorSession,
  FindFriendByUserName,
  getSlotMonitorConfig,
  getSlotWatches,
  removeSlotWatch,
  resolveCelebrityProfile,
  updateSlotWatch,
} from "@/services";
import { getToken } from "@/utils";
import {
  SonnerError,
  SonnerInfo,
  SonnerSuccess,
} from "@/components/ui/SonnerToast";
import {
  celebrityProfileUrl,
  hasCelebritySlotData,
  normalizeCelebrityInput,
} from "./celebrityInput";

const errorMessage = (error) =>
  error?.response?.data?.message || error?.message || "Không thể cập nhật Slot Monitor.";

const watchFromCelebrity = (user) => ({
  uid: user?.uid,
  username: user?.username,
  displayName:
    `${user?.first_name || ""} ${user?.last_name || ""}`.trim() ||
    user?.name ||
    user?.username,
  avatar: user?.profile_picture_url || "",
  friendCount: Number(user?.celebrity_data?.friend_count) || 0,
  maxFriends: Number(user?.celebrity_data?.max_friends) || 0,
});

const statusText = (watch) => {
  if (watch.status === "FRIENDS") return "Đã là bạn bè";
  if (watch.status === "REQUESTED") return "Đã gửi yêu cầu";
  if (watch.status === "ERROR") return "Lần kiểm tra gần nhất lỗi";
  if (watch.relationship === "follower-waitlist") return "Đang chờ slot trên Locket";
  if (watch.status === "SLOT_OPEN") return `Còn ${watch.availableSlots || 0} slot`;
  if (!watch.enabled) return "Đã tạm dừng";
  return "Đang canh";
};

export default function SlotMonitorPanel({ celebrities = [] }) {
  const selectable = useMemo(
    () => celebrities.filter((user) => user?.username),
    [celebrities],
  );
  const [config, setConfig] = useState(null);
  const [watches, setWatches] = useState([]);
  const [watchInput, setWatchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [nextConfig, nextWatches] = await Promise.all([
        getSlotMonitorConfig(),
        getSlotWatches(),
      ]);
      setConfig(nextConfig);
      setWatches(nextWatches);
    } catch (error) {
      SonnerError("Không tải được Slot Monitor", errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const enableSession = async () => {
    const refreshToken = getToken()?.refreshToken;
    if (!refreshToken) {
      SonnerInfo("Phiên đăng nhập không có refresh token. Hãy đăng nhập lại.");
      return;
    }
    setBusyKey("session");
    try {
      const nextConfig = await enableSlotMonitorSession(refreshToken);
      setConfig({ ...nextConfig, sessionConfigured: true });
      SonnerSuccess("Đã nạp phiên nền", "Refresh token được mã hóa trước khi lưu Firestore.");
    } catch (error) {
      SonnerError("Không thể nạp phiên nền", errorMessage(error));
    } finally {
      setBusyKey("");
    }
  };

  const addWatch = async () => {
    const username = normalizeCelebrityInput(watchInput);
    if (!username) {
      SonnerInfo("Nhập username hoặc link locket.cam hợp lệ.");
      return;
    }

    const knownUser = selectable.find(
      (item) => item.username?.toLowerCase() === username,
    );
    const profileUrl = celebrityProfileUrl(username);
    const inputIsLink = /^(?:https?:\/\/)?(?:www\.)?locket\.cam\//i.test(
      watchInput.trim(),
    );

    setBusyKey("add");
    try {
      let liveUser = null;

      if (inputIsLink) {
        try {
          liveUser = await resolveCelebrityProfile(profileUrl);
        } catch {
          liveUser = null;
        }
      }

      if (!hasCelebritySlotData(liveUser)) {
        try {
          const lookup = await FindFriendByUserName(username);
          liveUser = lookup?.data || (lookup?.uid ? lookup : null);
        } catch {
          liveUser = null;
        }
      }

      if (!hasCelebritySlotData(liveUser)) {
        liveUser = await resolveCelebrityProfile(profileUrl);
      }

      if (!hasCelebritySlotData(liveUser)) {
        throw new Error("Không tìm thấy Celebrity hoặc tài khoản chưa có dữ liệu slot.");
      }

      const saved = await addSlotWatch(
        watchFromCelebrity({ ...(knownUser || {}), ...liveUser, username }),
      );
      setWatches((current) => [
        ...current.filter((watch) => watch.uid !== saved.uid),
        saved,
      ]);
      setWatchInput("");
      SonnerSuccess("Đã thêm vào Slot Monitor", `@${saved.username}`);
    } catch (error) {
      SonnerError("Không thể thêm Celebrity", errorMessage(error));
    } finally {
      setBusyKey("");
    }
  };

  const patchWatch = async (watch, patch) => {
    if (patch.autoRequestEnabled === true) {
      if (!config?.sessionConfigured) {
        SonnerInfo("Hãy nạp phiên nền trước khi bật tự gửi yêu cầu.");
        return;
      }
      if (
        !window.confirm(
          `Bật tự gửi yêu cầu cho @${watch.username}? Hệ thống sẽ gửi thật ngay khi phát hiện slot.`,
        )
      ) return;
    }
    setBusyKey(`${watch.uid}:patch`);
    try {
      const updated = await updateSlotWatch(watch.uid, patch);
      setWatches((current) =>
        current.map((item) => (item.uid === watch.uid ? updated : item)),
      );
    } catch (error) {
      SonnerError("Không thể cập nhật", errorMessage(error));
    } finally {
      setBusyKey("");
    }
  };

  const checkNow = async (watch) => {
    setBusyKey(`${watch.uid}:check`);
    try {
      const result = await checkSlotWatchNow(watch.uid);
      setWatches((current) =>
        current.map((item) => (item.uid === watch.uid ? result.watch : item)),
      );
      if (result.autoRequest?.success) {
        SonnerSuccess("Đã gửi yêu cầu Celebrity", `@${watch.username}`);
      } else {
        SonnerSuccess("Đã kiểm tra slot", statusText(result.watch));
      }
    } catch (error) {
      SonnerError("Kiểm tra slot thất bại", errorMessage(error));
      void reload();
    } finally {
      setBusyKey("");
    }
  };

  const removeWatch = async (watch) => {
    setBusyKey(`${watch.uid}:remove`);
    try {
      await removeSlotWatch(watch.uid);
      setWatches((current) => current.filter((item) => item.uid !== watch.uid));
    } catch (error) {
      SonnerError("Không thể bỏ theo dõi", errorMessage(error));
    } finally {
      setBusyKey("");
    }
  };

  if (loading) {
    return (
      <div className="flex h-24 items-center justify-center border-y border-base-300">
        <LoaderCircle className="h-5 w-5 animate-spin opacity-60" />
      </div>
    );
  }

  return (
    <section className="space-y-3 border-y border-base-300 py-3" data-testid="slot-monitor-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <BellRing className="h-4 w-4 text-warning" /> Slot Monitor 24/7
          </h3>
          <p className="mt-0.5 text-xs opacity-60">
            Firestore · {config?.workerEnabled ? "worker đang bật" : "worker local đang tắt an toàn"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void enableSession()}
          disabled={!config?.enabled || busyKey === "session"}
          className="btn btn-sm btn-outline rounded-md"
        >
          {busyKey === "session" ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <ShieldCheck className="h-4 w-4" />
          )}
          {config?.sessionConfigured ? "Nạp lại phiên" : "Nạp phiên nền"}
        </button>
      </div>

      {!config?.enabled && (
        <div className="rounded-md border border-warning/35 bg-warning/10 px-3 py-2 text-xs">
          Backend chưa kết nối được Firebase Admin/Firestore.
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <div className="min-w-0">
          <input
            type="text"
            value={watchInput}
            onChange={(event) => setWatchInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && watchInput.trim() && busyKey !== "add") {
                event.preventDefault();
                void addWatch();
              }
            }}
            list="slot-monitor-celebrities"
            placeholder="Username hoặc link locket.cam"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="input input-bordered h-10 min-h-10 w-full rounded-md text-sm"
          />
          <datalist id="slot-monitor-celebrities">
          {selectable.map((user) => (
            <option
              key={user.uid || user.username}
              value={user.username}
              label={`@${user.username}`}
            />
          ))}
          </datalist>
        </div>
        <button
          type="button"
          onClick={() => void addWatch()}
          disabled={!watchInput.trim() || busyKey === "add"}
          className="btn btn-sm btn-primary h-10 min-h-10 rounded-md"
        >
          {busyKey === "add" && <LoaderCircle className="h-4 w-4 animate-spin" />}
          Thêm canh
        </button>
      </div>
      <p className="-mt-1 text-[11px] opacity-55">
        Hỗ trợ username, @username hoặc link https://locket.cam/username.
      </p>

      {!watches.length ? (
        <p className="rounded-md bg-base-200 px-3 py-4 text-center text-xs opacity-60">
          Chưa có Celebrity nào trong danh sách canh.
        </p>
      ) : (
        <div className="divide-y divide-base-300 rounded-md border border-base-300">
          {watches.map((watch) => {
            const checking = busyKey === `${watch.uid}:check`;
            return (
              <article key={watch.uid} className="space-y-2 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">@{watch.username}</p>
                    <p className="truncate text-[11px] opacity-60">
                      {statusText(watch)}
                      {watch.lastCheckedAt
                        ? ` · ${new Date(watch.lastCheckedAt).toLocaleTimeString("vi-VN")}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      className="btn btn-square btn-ghost h-8 min-h-8 w-8 min-w-8"
                      onClick={() => void checkNow(watch)}
                      disabled={Boolean(busyKey)}
                      title="Kiểm tra ngay"
                    >
                      <RefreshCcw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-square btn-ghost h-8 min-h-8 w-8 min-w-8 text-error"
                      onClick={() => void removeWatch(watch)}
                      disabled={Boolean(busyKey)}
                      title="Bỏ theo dõi"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      className="toggle toggle-success toggle-xs"
                      checked={watch.enabled}
                      onChange={() => void patchWatch(watch, { enabled: !watch.enabled })}
                      disabled={Boolean(busyKey)}
                    />
                    {watch.enabled ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                    Canh nền
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      className="toggle toggle-warning toggle-xs"
                      checked={watch.autoRequestEnabled}
                      onChange={() =>
                        void patchWatch(watch, {
                          autoRequestEnabled: !watch.autoRequestEnabled,
                        })
                      }
                      disabled={Boolean(busyKey) || !watch.enabled}
                    />
                    <Bot className="h-3.5 w-3.5" /> Tự gửi yêu cầu
                  </label>
                </div>
                {watch.lastError && (
                  <p className="text-[11px] text-error">{watch.lastError}</p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
