import { useEffect, useMemo, useRef, useState } from "react";
import { CONFIG } from "@/config";
import {
  FindFriendByUserName,
  resolveCelebrityProfile,
  SendRequestToCelebrity,
} from "@/services";
import {
  SonnerError,
  SonnerInfo,
  SonnerSuccess,
} from "@/components/ui/SonnerToast";
import {
  BellRing,
  Clock3,
  LayoutGrid,
  RefreshCcw,
  Search,
  Square,
  UserPlus,
  UsersRound,
  UserX,
} from "lucide-react";
import { PiExport } from "react-icons/pi";
import { useFeatureVisible, useGetCode } from "@/hooks/useFeature";
import { useAuthStore } from "@/stores";
import LockedFeature from "../../Layout/LockedFeature";
import CelebrateItem from "./CelebrateItem";
import SlotMonitorPanel from "./SlotMonitorPanel";
import { CELEBRITY_HAR_SNAPSHOT } from "./celebrityHarSnapshot";
import {
  mergeCelebrityProfiles,
  T97_CELEBRITY_PROFILES,
} from "./celebrityProfiles";

const CACHE_KEY = "celebrity_cache_v8_vietnam";
const AUTO_SCAN_DELAY_MS = 2500;
const AUTO_SCAN_RATE_LIMIT_PAUSE_MS = 20_000;
const SORT_OPTIONS = [
  { value: "default", label: "Mặc định" },
  { value: "name", label: "A-Z" },
  { value: "slots", label: "Còn slot" },
];

const VIETNAMESE_CELEBRITY_USERNAMES = new Set(
  T97_CELEBRITY_PROFILES.map((profile) => profile.username?.toLowerCase()).filter(Boolean),
);

const keepVietnameseCelebrities = (profiles) =>
  profiles.filter((profile) =>
    VIETNAMESE_CELEBRITY_USERNAMES.has(profile?.username?.toLowerCase()),
  );

const createDirectory = () =>
  keepVietnameseCelebrities(
    mergeCelebrityProfiles(T97_CELEBRITY_PROFILES, CELEBRITY_HAR_SNAPSHOT),
  );

const readCache = () => {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (!Array.isArray(cached?.data) || !cached.data.length) return null;
    return cached;
  } catch {
    return null;
  }
};

const writeCache = (data, timestamp = Date.now()) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp }));
  } catch {
    // The live list remains usable when storage is unavailable or full.
  }
};

const normalizeSearchText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const extractCelebrityUsername = (profile) => {
  const raw = String(profile || "").trim();
  if (!raw) return "";

  try {
    const url = new URL(
      /^https?:\/\//i.test(raw)
        ? raw.replace(/^http:\/\//i, "https://")
        : `https://locket.cam/${raw.replace(/^@/, "")}`,
    );
    if (!["locket.cam", "www.locket.cam"].includes(url.hostname)) return "";
    return decodeURIComponent(url.pathname.split("/").filter(Boolean)[0] || "")
      .replace(/^@/, "")
      .trim();
  } catch {
    return raw.replace(/^@/, "").split(/[?#/]/)[0].trim();
  }
};

const findLiveCelebrity = async (profile) => {
  const rawProfile = String(profile || "").trim();
  const username = extractCelebrityUsername(profile);

  if (/^(https?:\/\/)?(www\.)?locket\.cam\//i.test(rawProfile)) {
    try {
      const invitedUser = await resolveCelebrityProfile(rawProfile);
      if (invitedUser?.uid) return invitedUser;
    } catch (error) {
      if (isLookupRateLimited(error)) throw error;
      // Fall back to username lookup when an invite link is temporarily stale.
    }
  }

  if (username) {
    const result = await FindFriendByUserName(username);
    const user = result?.data || (result?.uid ? result : null);
    if (result?.success !== false && user?.uid) return user;
  }

  return resolveCelebrityProfile(profile);
};

const isLookupRateLimited = (error) => {
  const status = Number(error?.response?.status || error?.status);
  const message = String(
    error?.response?.data?.message || error?.message || "",
  ).toLowerCase();
  return (
    status === 429 ||
    status === 503 ||
    message.includes("giới hạn tìm kiếm") ||
    message.includes("too many")
  );
};

const waitForAutoScan = async (milliseconds, shouldStop) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < milliseconds) {
    if (shouldStop()) return false;
    await new Promise((resolve) => window.setTimeout(resolve, 500));
  }
  return true;
};

const displayName = (user) =>
  `${user?.first_name || ""} ${user?.last_name || ""}`.trim() ||
  user?.name ||
  user?.username ||
  "Celebrity";

const isSameCelebrity = (left, right) =>
  Boolean(left?.uid && right?.uid && left.uid === right.uid) ||
  Boolean(
    left?.username &&
      right?.username &&
      left.username.toLowerCase() === right.username.toLowerCase(),
  );

const hasSlotData = (user) => {
  const friendCount = Number(user?.celebrity_data?.friend_count);
  const maxFriends = Number(user?.celebrity_data?.max_friends);
  return Number.isFinite(friendCount) && Number.isFinite(maxFriends) && maxFriends > 0;
};

const relationshipStatus = (user) => user?.friendship_status || "none";
const isFriend = (user) => relationshipStatus(user) === "friends";
const isPending = (user) =>
  relationshipStatus(user) === "outgoing-follow-request";
const isWaitlist = (user) => relationshipStatus(user) === "follower-waitlist";
const isAvailable = (user) =>
  relationshipStatus(user) === "none" &&
  hasSlotData(user) &&
  Number(user.celebrity_data.friend_count) <
    Number(user.celebrity_data.max_friends);
const isFull = (user) =>
  relationshipStatus(user) === "none" &&
  hasSlotData(user) &&
  Number(user.celebrity_data.friend_count) >=
    Number(user.celebrity_data.max_friends);

const mergeLiveProfile = (fallback, live) => ({
  ...fallback,
  ...live,
  uid: live?.uid || fallback.uid,
  username: live?.username || fallback.username,
  first_name: live?.first_name || fallback.first_name || fallback.name,
  last_name: live?.last_name ?? fallback.last_name ?? "",
  profile_picture_url:
    live?.profile_picture_url || fallback.profile_picture_url || "",
  celebrity: live?.celebrity ?? fallback.celebrity ?? true,
  celebrity_data: {
    ...(fallback.celebrity_data || {}),
    ...(live?.celebrity_data || {}),
  },
  friendship_status:
    live?.friendship_status || fallback.friendship_status || "none",
  lookup_failed: false,
  refresh_failed: false,
});

const TAB_OPTIONS = [
  { key: "all", label: "Tất cả", icon: LayoutGrid },
  { key: "hasSlot", label: "Còn slot", icon: UserPlus },
  { key: "noSlot", label: "Hết slot", icon: UserX },
  {
    key: "waitaccept",
    label: "Chờ chấp nhận",
    mobileLabel: "Chờ duyệt",
    icon: Clock3,
  },
  { key: "friends", label: "Bạn bè", icon: UsersRound },
  {
    key: "waitlist",
    label: "Theo dõi slot",
    mobileLabel: "Theo dõi",
    icon: BellRing,
  },
];

export default function CelebrityTool() {
  const isCelebrityFeature = useFeatureVisible("celebrity_tool");
  const codeUser = useGetCode();
  const fetchUserData = useAuthStore((state) => state.fetchUserData);
  const initializedRef = useRef(false);
  const userDetailsRef = useRef([]);
  const stopAutoScanRef = useRef(false);
  const [userDetails, setUserDetails] = useState([]);
  const [refreshingCelebrity, setRefreshingCelebrity] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("default");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoScanning, setAutoScanning] = useState(false);
  const [autoScanProgress, setAutoScanProgress] = useState(null);
  const [slotMonitorOpen, setSlotMonitorOpen] = useState(false);
  const [actionCelebrity, setActionCelebrity] = useState("");

  useEffect(() => {
    userDetailsRef.current = userDetails;
  }, [userDetails]);

  useEffect(
    () => () => {
      stopAutoScanRef.current = true;
    },
    [],
  );

  useEffect(() => {
    if (!isCelebrityFeature || initializedRef.current) return;
    initializedRef.current = true;

    const directory = createDirectory();
    const cached = readCache();
    const list = cached?.data
      ? keepVietnameseCelebrities(mergeCelebrityProfiles(directory, cached.data))
      : directory;

    setUserDetails(list);
    setLastUpdated(cached?.timestamp || null);

  }, [isCelebrityFeature]);

  const handleRefreshCelebrity = async (user) => {
    const profile = user?.url || user?.username;
    const key = user?.uid || user?.username || user?.url;
    if (!profile || !key || refreshingCelebrity) return;

    setRefreshingCelebrity(key);
    try {
      const live = await findLiveCelebrity(profile);
      if (!live?.uid) throw new Error("Locket không trả về UID");

      const updatedUser = mergeLiveProfile(user, live);
      const timestamp = Date.now();
      setUserDetails((current) => {
        const updated = current.map((item) =>
          isSameCelebrity(item, user)
            ? mergeLiveProfile(item, updatedUser)
            : item,
        );
        writeCache(updated, timestamp);
        return updated;
      });
      setLastUpdated(timestamp);
      SonnerSuccess("Cập nhật slot thành công", displayName(updatedUser));
    } catch (error) {
      SonnerError(
        "Không thể làm mới Celebrity",
        error?.response?.data?.message || "Locket chưa trả về dữ liệu mới.",
      );
    } finally {
      setRefreshingCelebrity(null);
    }
  };

  const handleAutoScan = async () => {
    if (autoScanning) {
      stopAutoScanRef.current = true;
      return;
    }

    const candidates = keepVietnameseCelebrities(userDetailsRef.current).filter(
      (user) => user?.username,
    );
    if (!candidates.length) {
      SonnerInfo("Không có Celebrity để quét.");
      return;
    }

    stopAutoScanRef.current = false;
    setAutoScanning(true);
    setAutoScanProgress({ current: 0, total: candidates.length, success: 0, failed: 0 });

    let workingList = userDetailsRef.current;
    let success = 0;
    let failed = 0;

    for (let index = 0; index < candidates.length; index += 1) {
      if (stopAutoScanRef.current) break;

      const user = candidates[index];
      const key = user.uid || user.username || user.url;
      setRefreshingCelebrity(key);

      try {
        let live;
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            live = await findLiveCelebrity(user.url || user.username);
            break;
          } catch (error) {
            if (!isLookupRateLimited(error) || attempt === 1) throw error;

            setAutoScanProgress({
              current: index,
              total: candidates.length,
              success,
              failed,
              paused: true,
            });
            const shouldContinue = await waitForAutoScan(
              AUTO_SCAN_RATE_LIMIT_PAUSE_MS,
              () => stopAutoScanRef.current,
            );
            if (!shouldContinue) break;
          }
        }

        if (stopAutoScanRef.current) break;
        if (!live?.uid) throw new Error("Locket không trả về UID");

        const updatedUser = mergeLiveProfile(user, live);
        workingList = workingList.map((item) =>
          isSameCelebrity(item, user)
            ? mergeLiveProfile(item, updatedUser)
            : item,
        );
        success += 1;
        setUserDetails(workingList);
      } catch {
        failed += 1;
      }

      setAutoScanProgress({
        current: index + 1,
        total: candidates.length,
        success,
        failed,
        paused: false,
      });

      if (index < candidates.length - 1 && !stopAutoScanRef.current) {
        const shouldContinue = await waitForAutoScan(
          AUTO_SCAN_DELAY_MS,
          () => stopAutoScanRef.current,
        );
        if (!shouldContinue) break;
      }
    }

    const timestamp = Date.now();
    writeCache(workingList, timestamp);
    setLastUpdated(timestamp);
    setRefreshingCelebrity(null);
    setAutoScanning(false);

    if (stopAutoScanRef.current) {
      SonnerInfo("Đã dừng tự động quét", `Đã cập nhật ${success} Celebrity.`);
    } else {
      SonnerSuccess(
        "Quét Celebrity hoàn tất",
        failed
          ? `${success} thành công, ${failed} không thể cập nhật.`
          : `Đã cập nhật ${success} Celebrity Việt Nam.`,
      );
    }
  };

  const handleCelebrityAction = async (user, { waitForSlot = false } = {}) => {
    const key = user?.uid || user?.username || user?.url;
    if (!key || actionCelebrity) return;

    setActionCelebrity(key);
    try {
      let liveUser = user;
      if (!liveUser?.uid) {
        liveUser = await findLiveCelebrity(user?.url || user?.username);
      }
      if (!liveUser?.uid) throw new Error("Locket chưa trả về UID của Celebrity.");

      const result = await SendRequestToCelebrity(liveUser.uid, { waitForSlot });
      const friendshipStatus =
        result?.data?.friendship_status ||
        (waitForSlot ? "follower-waitlist" : "outgoing-follow-request");
      const timestamp = Date.now();

      setUserDetails((current) => {
        const updated = current.map((item) =>
          isSameCelebrity(item, user)
            ? mergeLiveProfile(item, {
                ...liveUser,
                friendship_status: friendshipStatus,
              })
            : item,
        );
        writeCache(updated, timestamp);
        return updated;
      });
      setLastUpdated(timestamp);

      if (friendshipStatus === "follower-waitlist") {
        SonnerSuccess("Đã bật báo slot", `@${liveUser.username || user.username}`);
      } else {
        SonnerSuccess("Đã gửi yêu cầu Celebrity", `@${liveUser.username || user.username}`);
      }
    } catch (error) {
      SonnerError(
        waitForSlot ? "Không thể bật báo slot" : "Không thể gửi yêu cầu",
        error?.response?.data?.message || error?.message || "Locket từ chối thao tác.",
      );
    } finally {
      setActionCelebrity("");
    }
  };

  const exportPDF = async () => {
    try {
      const response = await fetch(`${CONFIG.api.exportApi}/generate-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: userDetails }),
      });
      if (!response.ok) throw new Error("Không thể tạo PDF");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "danh_sach_celebrity.pdf";
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      SonnerError("Không thể xuất danh sách PDF.");
    }
  };

  const categorized = useMemo(
    () => ({
      all: userDetails,
      friends: userDetails.filter(isFriend),
      waitaccept: userDetails.filter(isPending),
      waitlist: userDetails.filter(isWaitlist),
      hasSlot: userDetails.filter(isAvailable),
      noSlot: userDetails.filter(isFull),
    }),
    [userDetails],
  );

  const visibleUsers = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query.trim());
    const filtered = categorized[activeTab].filter((user) => {
      if (!normalizedQuery) return true;
      return normalizeSearchText(
        `${displayName(user)} ${user.username || ""} ${user.uid || ""}`,
      ).includes(normalizedQuery);
    });

    if (sort === "name") {
      return [...filtered].sort((a, b) =>
        displayName(a).localeCompare(displayName(b), "vi", {
          sensitivity: "base",
        }),
      );
    }

    if (sort === "slots") {
      return [...filtered].sort((a, b) => {
        const remainingA =
          Number(a?.celebrity_data?.max_friends || 0) -
          Number(a?.celebrity_data?.friend_count || 0);
        const remainingB =
          Number(b?.celebrity_data?.max_friends || 0) -
          Number(b?.celebrity_data?.friend_count || 0);
        return remainingB - remainingA;
      });
    }

    return filtered;
  }, [activeTab, categorized, query, sort]);

  if (!isCelebrityFeature) {
    return (
      <LockedFeature
        toolName="Celebrity Tool"
        price="5000"
        note="LDT1M"
        codeUser={codeUser}
        onReload={fetchUserData}
      />
    );
  }

  return (
    <div className="space-y-3" data-testid="celebrity-tool">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Celebrity Tool</h2>
          <p className="mt-0.5 text-xs opacity-60">
            {lastUpdated
              ? `Cập nhật lúc ${new Date(lastUpdated).toLocaleString("vi-VN")}`
              : `${userDetails.length} tài khoản từ dữ liệu Locket`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSlotMonitorOpen((current) => !current)}
            className={`btn btn-sm rounded-md ${slotMonitorOpen ? "btn-warning" : "btn-ghost"}`}
            aria-expanded={slotMonitorOpen}
          >
            <BellRing className="h-4 w-4" />
            Canh 24/7
          </button>
          <button
            type="button"
            onClick={() => void handleAutoScan()}
            className={`btn btn-sm rounded-md ${autoScanning ? "btn-error" : "btn-success"}`}
            title={autoScanning ? "Dừng tự động quét" : "Tự động quét lần lượt danh sách"}
          >
            {autoScanning ? (
              <Square className="h-3.5 w-3.5" fill="currentColor" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            {autoScanning ? "Dừng quét" : "Auto quét"}
          </button>
          <button
            type="button"
            onClick={exportPDF}
            className="btn btn-sm btn-ghost rounded-md"
            title="Xuất danh sách PDF"
          >
            <PiExport className="h-4 w-4" />
            PDF
          </button>
        </div>
      </div>

      {slotMonitorOpen && <SlotMonitorPanel celebrities={userDetails} />}

      {autoScanProgress && (
        <div className="flex items-center gap-2 rounded-md border border-base-300 bg-base-100 px-3 py-2 text-xs">
          <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-base-300">
            <div
              className="h-full rounded-full bg-success transition-all"
              style={{
                width: `${Math.round((autoScanProgress.current / autoScanProgress.total) * 100)}%`,
              }}
            />
          </div>
          <span className="shrink-0 tabular-nums opacity-70">
            {autoScanProgress.paused
              ? "Đang nghỉ 20 giây"
              : `${autoScanProgress.current}/${autoScanProgress.total}`}
          </span>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_17rem] sm:items-end">
        <label className="block min-w-0">
          <span className="mb-1 block px-0.5 text-[11px] font-semibold uppercase opacity-55">
            Tìm Celebrity
          </span>
          <span className="flex h-11 min-w-0 items-center gap-2 rounded-md border border-base-300 bg-base-100 px-3 transition focus-within:border-primary focus-within:outline focus-within:outline-2 focus-within:outline-primary/15">
            <Search className="h-4 w-4 shrink-0 opacity-45" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tên, username hoặc UID"
              className="h-full min-w-0 grow bg-transparent text-sm outline-none placeholder:opacity-40"
            />
          </span>
        </label>

        <div className="min-w-0">
          <span className="mb-1 block px-0.5 text-[11px] font-semibold uppercase opacity-55">
            Sắp xếp
          </span>
          <div
            className="grid h-11 grid-cols-3 overflow-hidden rounded-md border border-base-300 bg-base-100 p-1"
            role="radiogroup"
            aria-label="Sắp xếp Celebrity"
          >
            {SORT_OPTIONS.map((option) => {
              const isSelected = sort === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setSort(option.value)}
                  className={`rounded px-1 text-xs font-semibold transition ${
                    isSelected
                      ? "bg-primary text-primary-content shadow-sm"
                      : "opacity-55 hover:bg-base-200 hover:opacity-100"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div
        className="grid grid-cols-3 gap-1.5 sm:flex sm:overflow-x-auto sm:pb-1"
        role="tablist"
      >
        {TAB_OPTIONS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.key)}
              className={`flex h-10 min-w-0 items-center justify-center gap-1 rounded-md border px-1.5 text-[11px] font-semibold transition sm:h-9 sm:shrink-0 sm:px-2.5 sm:text-xs ${
                isActive
                  ? "border-primary bg-primary text-primary-content shadow-sm"
                  : "border-base-300 bg-base-200 text-base-content hover:bg-base-300"
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
              <span className="truncate sm:hidden">
                {tab.mobileLabel || tab.label}
              </span>
              <span className="hidden sm:inline">{tab.label}</span>
              <span
                className={`min-w-4 shrink-0 rounded px-1 py-0.5 text-[10px] leading-none tabular-nums ${
                  isActive ? "bg-white/20" : "bg-base-100"
                }`}
              >
                {categorized[tab.key].length}
              </span>
            </button>
          );
        })}
      </div>

      <div className="h-96 overflow-y-auto rounded-md border border-base-300 bg-base-200/30 p-1">
        {visibleUsers.length ? (
          visibleUsers.map((user) => (
            <CelebrateItem
              key={user.uid || user.username || user.url}
              user={user}
              slotdata={user.celebrity_data}
              onAction={handleCelebrityAction}
              onRefresh={handleRefreshCelebrity}
              acting={
                actionCelebrity === (user.uid || user.username || user.url)
              }
              refreshing={
                autoScanning ||
                refreshingCelebrity === (user.uid || user.username || user.url)
              }
            />
          ))
        ) : (
          <div className="grid h-full place-items-center text-sm opacity-60">
            Không có Celebrity phù hợp.
          </div>
        )}
      </div>
    </div>
  );
}
