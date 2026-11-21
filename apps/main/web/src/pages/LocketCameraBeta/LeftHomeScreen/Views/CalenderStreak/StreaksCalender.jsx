import React, { useEffect, useMemo, useRef, useState } from "react";
import { MdSlowMotionVideo } from "react-icons/md";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Flame,
  LoaderCircle,
  LockKeyhole,
  Plus,
  X,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { SonnerInfo } from "@/components/ui/SonnerToast";
import {
  useAuthStore,
  useMomentsStoreV2,
  usePostStore,
  useStreakStore,
  useUploadQueueStore,
} from "@/stores";
import { getAllMoments } from "@/cache/momentDB";
import {
  formatRestoreDate,
  getMonthKeysBetween,
  getNextRestoreDate,
  getRestoreAnchorDate,
  getRestoreToday,
} from "@/utils/streakRestoreFlow";
import {
  getVisibleCalendarMonths,
  toCalendarMonthKey,
} from "@/utils/moment/calendarMonths";

// Parse date an toàn, hỗ trợ Date object, timestamp số/chuỗi, Firestore timestamp, ISO 8601, regex định dạng VN
function parseCustomDate(str) {
  if (!str) return null;
  if (str instanceof Date && !isNaN(str.getTime())) return str;

  // Firestore Timestamp object ({ _seconds, _nanoseconds } hoặc toDate())
  if (typeof str === "object") {
    if (typeof str.toDate === "function") {
      try {
        const d = str.toDate();
        if (d instanceof Date && !isNaN(d.getTime())) return d;
      } catch (e) {
        // bỏ qua
      }
    }
    const secs = str._seconds ?? str.seconds;
    if (typeof secs === "number") {
      const nanos = str._nanoseconds ?? str.nanoseconds ?? 0;
      return new Date(secs * 1000 + Math.floor(nanos / 1e6));
    }
  }

  // Timestamp số hoặc chuỗi số
  if (typeof str === "number" || (!isNaN(str) && String(str).trim() !== "")) {
    const num = Number(str);
    if (!isNaN(num)) {
      const ms = num > 0 && num < 1e12 ? num * 1000 : num;
      const d = new Date(ms);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // Chuỗi text
  const cleaned = String(str).replace(",", "").trim();

  // Thử parse mặc định của JS (ISO 8601: 2025-07-30T04:44:00Z)
  const parsed = new Date(cleaned);
  if (!isNaN(parsed.getTime())) return parsed;

  // Regex: HH:mm:ss DD/MM/YYYY hoặc DD/MM/YYYY
  let match;
  const timeDate =
    /^(\d{1,2}):(\d{1,2}):(\d{1,2})\s+(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/;
  const dateOnly = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/;
  const timeOnly = /^(\d{1,2}):(\d{1,2}):(\d{1,2})$/;

  if ((match = cleaned.match(timeDate))) {
    const [, hh, mm, ss, day, month, year] = match.map(Number);
    return new Date(year, month - 1, day, hh, mm, ss);
  }

  if ((match = cleaned.match(dateOnly))) {
    const [, day, month, year] = match.map(Number);
    return new Date(year, month - 1, day);
  }

  if ((match = cleaned.match(timeOnly))) {
    const [, hh, mm, ss] = match.map(Number);
    const today = new Date();
    return new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      hh,
      mm,
      ss
    );
  }

  return null;
}

// Lấy ngày của 1 moment
function getMomentDate(moment) {
  if (!moment) return null;
  const raw =
    moment.createdAt ||
    moment.date ||
    moment.createTime ||
    moment.updateTime ||
    moment.timestamp;
  return parseCustomDate(raw);
}

// Lấy thumbnail URL của moment
function getMomentThumbnail(moment) {
  if (!moment) return null;
  return (
    moment.thumbnail_url ||
    moment.thumbnailUrl ||
    moment.thumbnailCdnUrl ||
    moment.image_url ||
    moment.imageUrl ||
    moment.imageCdnUrl ||
    null
  );
}

// Format YYYY-MM
function getMonthKeyFromCustomDate(str) {
  const d = parseCustomDate(str);
  if (!d) return null;
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`;
}

// Format YYYY-MM-DD
function formatDateToKey(d) {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Lấy ngày cuối tháng
function getLastDayOfMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

// Convert từ yyyymmdd sang Date
function yyyymmddToDate(num) {
  const str = num.toString();
  const year = +str.slice(0, 4);
  const month = +str.slice(4, 6) - 1;
  const day = +str.slice(6, 8);
  return new Date(year, month, day);
}

// Tính ngày bắt đầu streak
function getStreakStartDate(streak) {
  if (!streak || !streak.count || !streak.last_updated_yyyymmdd) return null;
  const lastDate = yyyymmddToDate(streak.last_updated_yyyymmdd);
  const startDate = new Date(lastDate);
  startDate.setDate(startDate.getDate() - (streak.count - 1));
  return startDate;
}

// Format ngày tiếng Việt hiển thị
function formatFullDateVi(date) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return "";
  const d = date.getDate();
  const m = date.getMonth() + 1;
  const y = date.getFullYear();
  return `Ngày ${d} tháng ${m}, ${y}`;
}

// Format giờ:phút
function formatTimeVi(date) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return "";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/* =========================================================================
 * DayMomentsModal: Modal hiển thị ảnh kỷ niệm của ngày khi bấm vào ô ngày
 * ========================================================================= */
const DayMomentsModal = ({ isOpen, dayData, onClose, onGoToHistory }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    setCurrentIndex(0);
  }, [dayData]);

  if (!isOpen || !dayData || !dayData.posts || dayData.posts.length === 0) {
    return null;
  }

  const { day, posts } = dayData;
  const activePost = posts[currentIndex] || posts[0];
  const activeDate = getMomentDate(activePost);
  const mediaUrl =
    activePost?.image_url ||
    activePost?.imageUrl ||
    activePost?.imageCdnUrl ||
    activePost?.thumbnail_url ||
    activePost?.thumbnailUrl ||
    null;
  const isVideo = Boolean(activePost?.video_url || activePost?.videoUrl);
  const videoUrl = activePost?.video_url || activePost?.videoUrl;
  const captionText =
    activePost?.caption ||
    activePost?.captions?.[0]?.text ||
    activePost?.overlays?.text ||
    null;

  const handlePrev = (e) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : posts.length - 1));
  };

  const handleNext = (e) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev < posts.length - 1 ? prev + 1 : 0));
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md transition-all duration-300"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-[28px] bg-neutral-900 border border-white/15 p-4 shadow-2xl text-white flex flex-col gap-3 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow: "0 20px 40px -10px rgba(0, 0, 0, 0.7)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-1">
          <div>
            <h3 className="font-bold text-base text-white">
              {formatFullDateVi(day)}
            </h3>
            <p className="text-xs text-white/60">
              {posts.length > 1
                ? `${currentIndex + 1} / ${posts.length} khoảnh khắc`
                : "1 khoảnh khắc"}
              {activeDate && ` • ${formatTimeVi(activeDate)}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center transition"
            aria-label="Đóng"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Media Preview */}
        <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-black flex items-center justify-center border border-white/10">
          {isVideo ? (
            <video
              src={videoUrl}
              poster={mediaUrl}
              controls
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <img
              src={mediaUrl}
              alt="Khoảnh khắc"
              className="w-full h-full object-cover"
              loading="lazy"
            />
          )}

          {/* Navigation arrows if multiple posts */}
          {posts.length > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrev}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/75 text-white flex items-center justify-center backdrop-blur-sm transition active:scale-90 z-20"
                aria-label="Ảnh trước"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/75 text-white flex items-center justify-center backdrop-blur-sm transition active:scale-90 z-20"
                aria-label="Ảnh sau"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          {/* Caption overlay */}
          {captionText && (
            <div className="absolute bottom-3 inset-x-3 z-20 flex justify-center pointer-events-none">
              <span
                className="px-3 py-1.5 rounded-full bg-black/60 text-white text-xs font-semibold backdrop-blur-md shadow-md max-w-full truncate text-center"
                style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}
              >
                {captionText}
              </span>
            </div>
          )}
        </div>

        {/* Mini thumbnails selector if multiple photos */}
        {posts.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 overflow-x-auto py-1">
            {posts.map((p, idx) => {
              const thumb = getMomentThumbnail(p);
              const isSelected = idx === currentIndex;
              return (
                <button
                  type="button"
                  key={p.id || idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`w-10 h-10 rounded-lg overflow-hidden border-2 transition-all shrink-0 ${
                    isSelected
                      ? "border-yellow-400 scale-105"
                      : "border-transparent opacity-60 hover:opacity-100"
                  }`}
                >
                  <img
                    src={thumb}
                    alt={`Thumb ${idx + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>
              );
            })}
          </div>
        )}

        {/* Go to History Feed Action Button */}
        <button
          type="button"
          onClick={() => onGoToHistory(activePost)}
          className="w-full py-3 px-4 rounded-2xl bg-yellow-400 hover:bg-yellow-300 active:scale-98 text-black font-bold text-sm flex items-center justify-center gap-2 transition shadow-lg cursor-pointer select-none"
        >
          <ExternalLink className="w-4 h-4" />
          <span>Xem trong Lịch sử</span>
        </button>
      </div>
    </div>
  );
};

/* =========================================================================
 * MonthCalendar: Lưới lịch cho từng tháng
 * ========================================================================= */
const MonthCalendar = ({
  monthKey,
  postsInMonth,
  restoreAnchorDate,
  nextRestoreDate,
  pendingRestoreDate,
  confirmedRestoreDate,
  onSelectRestoreDate,
  onOpenDay,
  onTodayClick,
}) => {
  const { streak } = useStreakStore();

  const streakStartDate = getStreakStartDate(streak);

  const [yearStr, monthStr] = monthKey.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr) - 1;

  const startDate = useMemo(() => new Date(year, month, 1), [month, year]);
  const endDate = useMemo(
    () => new Date(year, month, getLastDayOfMonth(year, month)),
    [month, year],
  );

  // Gom bài viết theo ngày YYYY-MM-DD
  const postsByDate = useMemo(() => {
    const map = {};
    postsInMonth.forEach((post) => {
      const d = getMomentDate(post);
      if (!d) return;
      const key = formatDateToKey(d);
      if (!key) return;
      if (!map[key]) map[key] = [];
      map[key].push(post);
    });

    // Sắp xếp bài trong ngày: mới nhất lên đầu để posts[0] làm thumbnail
    Object.keys(map).forEach((key) => {
      map[key].sort((a, b) => {
        const timeA = getMomentDate(a)?.getTime() || 0;
        const timeB = getMomentDate(b)?.getTime() || 0;
        return timeB - timeA;
      });
    });

    return map;
  }, [postsInMonth]);

  // Tạo mảng ngày trong tháng
  const daysArray = useMemo(() => {
    const arr = [];
    let current = new Date(startDate);
    while (current <= endDate) {
      arr.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return arr;
  }, [startDate, endDate]);

  // Tên tháng tiếng Việt
  const monthName = startDate.toLocaleString("vi-VN", {
    month: "long",
    year: "numeric",
  });

  const daysMobile = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  const daysDesktop = [
    "CN",
    "T2",
    "T3",
    "T4",
    "T5",
    "T6",
    "T7",
    "CN",
    "T2",
    "T3",
    "T4",
    "T5",
    "T6",
    "T7",
  ];

  return (
    <div className="mb-8 bg-neutral-900/90 rounded-3xl shadow-lg border border-white/10 overflow-hidden">
      <h2
        className="text-xl font-bold mb-0 w-full rounded-t-3xl bg-neutral-800/80 text-white
               py-3.5 px-6 shadow-md select-none border-b border-white/10 capitalize"
      >
        {monthName}
      </h2>
      <div className="grid grid-cols-7 md:grid-cols-14 gap-1.5 md:gap-3 p-4 sm:p-6">
        {/* Tiêu đề cho mobile (7 cột) */}
        {daysMobile.map((d) => (
          <div
            key={"mobile-" + d}
            className="block text-center font-medium text-xs text-white/50 border-b border-white/10 pb-1.5 md:hidden"
          >
            {d}
          </div>
        ))}

        {/* Tiêu đề cho màn to (14 cột) */}
        {daysDesktop.map((d, i) => (
          <div
            key={"desktop-" + i}
            className="hidden md:block text-center font-medium text-xs text-white/50 border-b border-white/10 pb-1.5"
          >
            {d}
          </div>
        ))}

        {/* Ô trống căn chỉnh ngày đầu tháng */}
        {Array(startDate.getDay())
          .fill(null)
          .map((_, i) => (
            <div key={"empty-" + i} className="aspect-square" />
          ))}

        {/* Các ngày trong tháng */}
        {daysArray.map((day) => {
          const dayKey = formatDateToKey(day);
          const posts = postsByDate[dayKey] || [];
          const hasPhoto = posts.length > 0;
          const latestPhoto = hasPhoto ? posts[0] : null;
          const thumbnailUrl = latestPhoto ? getMomentThumbnail(latestPhoto) : null;

          const dayValue = Number(dayKey.replaceAll("-", ""));
          const todayValue = getRestoreToday();
          const isCurrentDay = dayValue === todayValue;

          // Kiểm tra ngày này có nằm trong streak không
          const isInStreak =
            streakStartDate &&
            day >= streakStartDate &&
            day <= yyyymmddToDate(streak.last_updated_yyyymmdd);

          const isRestoreRange =
            restoreAnchorDate &&
            dayValue > restoreAnchorDate &&
            dayValue <= todayValue;
          const isConfirmedRestore =
            isRestoreRange &&
            confirmedRestoreDate &&
            dayValue <= confirmedRestoreDate;
          const isPendingRestore = pendingRestoreDate === dayValue;
          const canSelectRestore =
            isRestoreRange &&
            !isCurrentDay &&
            nextRestoreDate === dayValue &&
            !pendingRestoreDate;
          const isLockedRestore =
            isRestoreRange &&
            !isCurrentDay &&
            !isConfirmedRestore &&
            !isPendingRestore &&
            !canSelectRestore;

          const restoreTitle = isPendingRestore
            ? `Đang xác nhận ${formatRestoreDate(dayValue)}`
            : canSelectRestore
            ? `Khôi phục chuỗi ngày ${formatRestoreDate(dayValue)}`
            : isLockedRestore
            ? `Hãy khôi phục ${formatRestoreDate(nextRestoreDate)} trước`
            : isCurrentDay
            ? `Hôm nay, ${formatRestoreDate(dayValue)}`
            : null;

          const handleClickCell = () => {
            if (canSelectRestore) {
              onSelectRestoreDate(dayValue);
              return;
            }
            if (hasPhoto) {
              onOpenDay({ day, dayKey, posts });
              return;
            }
            if (isCurrentDay) {
              onTodayClick(dayValue);
            }
          };

          return (
            <button
              type="button"
              key={dayKey}
              data-restore-date={isRestoreRange ? dayValue : undefined}
              disabled={isLockedRestore}
              onClick={handleClickCell}
              className={`aspect-square rounded-[12px] overflow-hidden group relative transition-all duration-200 select-none flex flex-col items-center justify-center ${
                hasPhoto
                  ? isCurrentDay
                    ? "border-[1.5px] border-yellow-400 ring-1 ring-yellow-400/40 cursor-pointer active:scale-95"
                    : "border-[1.5px] border-white/20 hover:border-white/40 cursor-pointer active:scale-95 shadow-sm"
                  : isCurrentDay
                  ? "border-[1.5px] border-yellow-400/80 bg-yellow-400/10 cursor-pointer active:scale-95"
                  : canSelectRestore
                  ? "border-[1.5px] border-amber-400 bg-amber-400/15 ring-2 ring-amber-400/50 cursor-pointer active:scale-95"
                  : isPendingRestore
                  ? "border border-blue-400 bg-blue-400/10"
                  : isLockedRestore
                  ? "border border-white/10 bg-white/[0.02] opacity-40 cursor-not-allowed"
                  : "border border-white/[0.12] bg-white/[0.04]"
              }`}
              title={
                restoreTitle ||
                (hasPhoto
                  ? `${posts.length} khoảnh khắc - Ngày ${day.getDate()}`
                  : dayKey)
              }
              aria-label={
                restoreTitle ||
                (hasPhoto
                  ? `Ngày ${day.getDate()} có ${posts.length} ảnh`
                  : `Ngày ${formatRestoreDate(dayValue)}`)
              }
            >
              {hasPhoto ? (
                <>
                  {/* Ảnh nền phủ kín 100% ô */}
                  <img
                    src={thumbnailUrl}
                    alt={`Ảnh ngày ${day.getDate()}`}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 pointer-events-none"
                    loading="lazy"
                  />

                  {/* Lớp phủ gradient/tối nhẹ phía trên */}
                  <div
                    className="absolute inset-0 pointer-events-none z-10"
                    style={{ background: "rgba(0, 0, 0, 0.22)" }}
                  />

                  {/* Số ngày màu trắng, font-weight: 700, text-shadow */}
                  <span
                    className="relative z-20 text-white font-bold text-xs sm:text-sm select-none"
                    style={{
                      textShadow: "0 1px 3px rgba(0,0,0,0.8)",
                    }}
                  >
                    {day.getDate()}
                  </span>

                  {/* Badge số ảnh nếu > 1 */}
                  {posts.length > 1 && (
                    <span
                      className="absolute top-0.5 right-0.5 z-20 px-1 py-0.2 rounded-full bg-black/50 text-[9px] font-bold text-white/95 backdrop-blur-[2px] leading-tight"
                      style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}
                    >
                      {posts.length}
                    </span>
                  )}

                  {/* Icon video nếu là video */}
                  {latestPhoto?.video_url && (
                    <span className="absolute top-0.5 left-0.5 z-20 p-0.5 rounded-full bg-black/40 text-white/90">
                      <MdSlowMotionVideo className="w-2.5 h-2.5" />
                    </span>
                  )}

                  {/* Badge streak nếu là ngày cuối của streak */}
                  {isInStreak &&
                    day.getTime() ===
                      yyyymmddToDate(streak.last_updated_yyyymmdd).getTime() && (
                      <div className="absolute bg-yellow-400 text-black text-[9px] px-1 font-bold bottom-0 right-0 rounded-tl-sm z-20 leading-tight">
                        {streak?.count}d
                      </div>
                    )}
                </>
              ) : (
                <>
                  {/* Ngày KHÔNG CÓ ảnh: ô nền tối mờ, viền xám mỏng, số xám nhạt */}
                  <span
                    className="relative z-10 text-xs font-semibold select-none"
                    style={{ color: "rgba(255, 255, 255, 0.45)" }}
                  >
                    {day.getDate()}
                  </span>

                  {/* Hôm nay nếu chưa có ảnh: dấu + nhỏ màu vàng */}
                  {isCurrentDay && !canSelectRestore && (
                    <span
                      className="absolute inset-0 flex items-center justify-center text-yellow-400 pointer-events-none select-none"
                      aria-hidden="true"
                    >
                      <Plus className="h-3 w-3 stroke-[2.5]" />
                    </span>
                  )}

                  {/* Trạng thái khôi phục streak */}
                  {canSelectRestore && (
                    <span
                      className="absolute inset-0 flex justify-center items-center text-amber-500 select-none"
                      aria-hidden="true"
                    >
                      <Flame className="h-6 w-6" fill="currentColor" />
                    </span>
                  )}
                  {isPendingRestore && (
                    <span className="absolute inset-0 flex items-center justify-center text-blue-500">
                      <LoaderCircle className="h-5 w-5 animate-spin" />
                    </span>
                  )}
                  {isLockedRestore && (
                    <span className="absolute inset-0 flex items-center justify-center text-white/30">
                      <LockKeyhole className="h-4 w-4" />
                    </span>
                  )}
                  {isConfirmedRestore && (
                    <span className="absolute inset-0 flex items-center justify-center text-yellow-500">
                      <CheckCircle2 className="h-5 w-5" />
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

/* =========================================================================
 * StreaksCalender: Thành phần lịch chuỗi & ảnh kỷ niệm chính
 * ========================================================================= */
const StreaksCalender = ({ recentPosts = [], allMoments = [] }) => {
  const { navigation, camera, post } = useApp();
  const { user } = useAuthStore();
  const streak = useStreakStore((state) => state.streak);
  const restoreFlow = usePostStore((state) => state.restoreFlow);
  const selectRestoreFlowDate = usePostStore(
    (state) => state.selectRestoreFlowDate,
  );
  const setRestoreStreak = usePostStore((state) => state.setRestoreStreak);

  const momentsStoreItems = useMomentsStoreV2(
    (state) => state.momentsByUser["all"]?.items || [],
  );
  const fetchMoments = useMomentsStoreV2((state) => state.fetchMoments);
  const ensureMomentVisible = useMomentsStoreV2(
    (state) => state.ensureMomentVisible,
  );
  const postedMoments = useUploadQueueStore((state) => state.postedMoments || []);

  const [cachedMoments, setCachedMoments] = useState([]);
  const [activeDayModal, setActiveDayModal] = useState(null);

  const today = getRestoreToday();
  const restoreAnchorDate = getRestoreAnchorDate(streak, today);
  const nextRestoreDate = getNextRestoreDate({
    streak,
    confirmedDate: restoreFlow.confirmedDate,
    today,
  });

  // Load moments từ IndexedDB cache để lịch hiển thị tức thì
  useEffect(() => {
    let isMounted = true;
    getAllMoments()
      .then((items) => {
        if (isMounted && Array.isArray(items) && items.length > 0) {
          setCachedMoments(items);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  // Tổng hợp toàn bộ bài viết từ Store, Dexie Cache và Upload Queue
  const allCombinedPosts = useMemo(() => {
    const map = new Map();

    // 1. Moments từ store ("all")
    const storeList = allMoments.length > 0 ? allMoments : momentsStoreItems;
    storeList.forEach((item) => {
      if (item && item.id) map.set(item.id, item);
    });

    // 2. Moments từ IndexedDB cache
    cachedMoments.forEach((item) => {
      if (item && item.id && !map.has(item.id)) {
        map.set(item.id, item);
      }
    });

    // 3. Moments từ upload queue (vừa upload)
    postedMoments.forEach((item) => {
      if (item && (item.id || item.postId)) {
        const id = item.id || item.postId;
        if (!map.has(id)) map.set(id, item);
      }
    });

    // 4. Props recentPosts nếu có bài khác
    recentPosts.forEach((item) => {
      if (item && (item.id || item.postId)) {
        const id = item.id || item.postId;
        if (!map.has(id)) map.set(id, item);
      }
    });

    return Array.from(map.values());
  }, [allMoments, momentsStoreItems, cachedMoments, postedMoments, recentPosts]);

  // Tự động fetch moments nếu danh sách đang rỗng
  useEffect(() => {
    if (user && allCombinedPosts.length === 0) {
      fetchMoments(user, null);
    }
  }, [user, allCombinedPosts.length, fetchMoments]);

  // Nhóm theo từng tháng YYYY-MM
  const postsByMonth = useMemo(() => {
    const map = {};
    allCombinedPosts.forEach((p) => {
      const d = getMomentDate(p);
      if (!d) return;
      const monthKey = `${d.getFullYear()}-${(d.getMonth() + 1)
        .toString()
        .padStart(2, "0")}`;
      if (!map[monthKey]) map[monthKey] = [];
      map[monthKey].push(p);
    });

    if (restoreAnchorDate && restoreAnchorDate < today) {
      getMonthKeysBetween(restoreAnchorDate, today).forEach((monthKey) => {
        if (!map[monthKey]) map[monthKey] = [];
      });
    }

    // Luôn đảm bảo tháng hiện tại có trong danh sách
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${(now.getMonth() + 1)
      .toString()
      .padStart(2, "0")}`;
    if (!map[currentMonthKey]) {
      map[currentMonthKey] = [];
    }

    return map;
  }, [allCombinedPosts, restoreAnchorDate, today]);

  const bucket = useMomentsStoreV2((state) => state.momentsByUser["all"]);
  const loadMoreOlder = useMomentsStoreV2((state) => state.loadMoreOlder);
  const hasMore = bucket?.hasMore ?? true;
  const isLoadingMore = bucket?.isLoadingMore ?? false;

  const topSentinelRef = useRef(null);

  useEffect(() => {
    if (!topSentinelRef.current || !hasMore || isLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMoreOlder(null);
        }
      },
      {
        rootMargin: "300px 0px 0px 0px",
        threshold: 0.1,
      },
    );

    observer.observe(topSentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, loadMoreOlder]);

  const monthsSorted = useMemo(() => {
    const preferredMonthKey = nextRestoreDate
      ? toCalendarMonthKey(yyyymmddToDate(nextRestoreDate))
      : null;
    return getVisibleCalendarMonths(Object.keys(postsByMonth), {
      preferredMonthKey,
      showAll: true,
    });
  }, [nextRestoreDate, postsByMonth]);

  const lastMonthRef = useRef(null);
  const hasScrolledInitial = useRef(false);

  useEffect(() => {
    if (!hasScrolledInitial.current && lastMonthRef.current && monthsSorted.length > 0) {
      hasScrolledInitial.current = true;
      lastMonthRef.current.scrollIntoView({
        behavior: "instant",
        block: "start",
      });
    }
  }, [monthsSorted]);

  // Xử lý chọn ngày khôi phục chuỗi
  const handleSelectRestoreDate = (date) => {
    if (date !== nextRestoreDate || restoreFlow.pendingDate) return;

    const mode = date < today ? "restore" : "normal";
    selectRestoreFlowDate({ date, mode });
    setRestoreStreak(
      mode === "restore"
        ? {
            data: date,
            mode: "restore",
            name: "Khôi phục chuỗi từ lịch Locket",
          }
        : null,
    );

    navigation.setIsProfileOpen(false);
    navigation.setIsHomeOpen(false);
    navigation.setIsBottomOpen(false);
    camera.setCameraActive(true);

    SonnerInfo(
      mode === "restore" ? "Đã chọn ngày khôi phục" : "Đã chọn ngày hôm nay",
      `${formatRestoreDate(date)} • Chụp hoặc tải ảnh/video để tiếp tục.`,
    );
  };

  // Bấm vào hôm nay nếu chưa có ảnh: mở camera
  const handleTodayClick = (dayValue) => {
    if (dayValue === nextRestoreDate) {
      handleSelectRestoreDate(dayValue);
      return;
    }
    navigation.setIsProfileOpen(false);
    navigation.setIsHomeOpen(false);
    navigation.setIsBottomOpen(false);
    camera.setCameraActive(true);
  };

  // Điều hướng tới History Feed và cuộn tới ảnh được chọn
  const handleGoToHistory = (moment) => {
    if (!moment) return;
    setActiveDayModal(null);

    // Đặt filter về 'all'
    post.setSelectedFriendUid(null);

    // Đặt ID moment được chọn
    const momentId = moment.id || moment.postId || moment.canonical_uid;
    post.setSelectedMomentId(momentId);

    // Đảm bảo moment hiển thị trong MomentsGrid bằng cách tăng visibleCount
    const foundIndex = ensureMomentVisible?.(momentId, null);
    if (typeof foundIndex === "number" && foundIndex !== -1) {
      post.setSelectedMoment(foundIndex);
    }

    // Đóng trang cá nhân và mở màn hình Lịch sử
    navigation.setIsProfileOpen(false);
    navigation.setIsHomeOpen(false);
    navigation.setIsBottomOpen(true);

    // Cuộn tới phần tử moment trong grid
    setTimeout(() => {
      const el = document.getElementById(`moment-${momentId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 350);
  };

  return (
    <div>
      {restoreAnchorDate &&
        restoreAnchorDate < today &&
        nextRestoreDate &&
        nextRestoreDate < today && (
          <div className="mx-1 mb-4 rounded-lg border border-amber-400/50 bg-amber-400/10 px-3 py-2 text-sm text-white">
            <div className="flex items-center gap-2 font-semibold">
              <Flame className="h-4 w-4 text-amber-500" fill="currentColor" />
              Khôi phục chuỗi theo thứ tự
            </div>
            <p className="mt-1 opacity-75">
              Cập nhật gần nhất: {formatRestoreDate(restoreAnchorDate)}
            </p>
            <p className="mt-0.5">
              Ngày có thể chọn tiếp theo: {formatRestoreDate(nextRestoreDate)}
            </p>
          </div>
        )}

      {/* Kích hoạt tải thêm tháng cũ khi cuộn lên trên */}
      {hasMore && (
        <div
          ref={topSentinelRef}
          className="py-3 flex flex-col items-center justify-center text-xs text-white/50 select-none"
        >
          {isLoadingMore ? (
            <div className="flex items-center gap-2 py-1 px-3.5 rounded-full bg-white/5 border border-white/10 text-white/80">
              <LoaderCircle className="h-3.5 w-3.5 animate-spin text-yellow-400" />
              <span>Đang tải thêm kỷ niệm các tháng trước...</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => loadMoreOlder(null)}
              className="px-3.5 py-1 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition text-[11px] text-white/70"
            >
              Tải thêm các tháng cũ
            </button>
          )}
        </div>
      )}

      {monthsSorted.map((monthKey, idx) => {
        const isLast = idx === monthsSorted.length - 1;
        return (
          <div key={monthKey} ref={isLast ? lastMonthRef : null}>
            <MonthCalendar
              monthKey={monthKey}
              postsInMonth={postsByMonth[monthKey] || []}
              restoreAnchorDate={restoreAnchorDate}
              nextRestoreDate={nextRestoreDate}
              pendingRestoreDate={restoreFlow.pendingDate}
              confirmedRestoreDate={restoreFlow.confirmedDate}
              onSelectRestoreDate={handleSelectRestoreDate}
              onOpenDay={setActiveDayModal}
              onTodayClick={handleTodayClick}
            />
          </div>
        );
      })}

      {/* Modal chi tiết ảnh kỷ niệm của ngày */}
      <DayMomentsModal
        isOpen={Boolean(activeDayModal)}
        dayData={activeDayModal}
        onClose={() => setActiveDayModal(null)}
        onGoToHistory={handleGoToHistory}
      />
    </div>
  );
};

export default StreaksCalender;
