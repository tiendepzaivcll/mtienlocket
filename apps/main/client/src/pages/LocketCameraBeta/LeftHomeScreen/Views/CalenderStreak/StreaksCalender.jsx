import { MdSlowMotionVideo } from "react-icons/md";
import { useEffect, useMemo, useRef } from "react";
import {
  CheckCircle2,
  Flame,
  LoaderCircle,
  LockKeyhole,
  Plus,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { SonnerInfo } from "@/components/ui/SonnerToast";
import { usePostStore, useStreakStore } from "@/stores";
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

// Parse date dạng "04:44:00, 30/7/2025"
// Parse date an toàn, hỗ trợ nhiều định dạng
function parseCustomDate(str) {
  if (!str) return null;

  // Nếu là Date object
  if (str instanceof Date && !isNaN(str)) return str;

  // Nếu là timestamp số
  if (!isNaN(str) && String(str).length >= 10) {
    const d = new Date(Number(str));
    if (!isNaN(d)) return d;
  }

  // Xóa dấu phẩy và khoảng trắng dư
  str = String(str).replace(",", "").trim();

  // Thử parse mặc định của JS (hỗ trợ ISO 8601: 2025-07-30T04:44:00Z)
  let d = new Date(str);
  if (!isNaN(d)) return d;

  // Regex: HH:mm:ss DD/MM/YYYY hoặc DD/MM/YYYY
  let match;
  const timeDate =
    /^(\d{1,2}):(\d{1,2}):(\d{1,2})\s+(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/;
  const dateOnly = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/;
  const timeOnly = /^(\d{1,2}):(\d{1,2}):(\d{1,2})$/;

  if ((match = str.match(timeDate))) {
    const [, hh, mm, ss, day, month, year] = match.map(Number);
    return new Date(year, month - 1, day, hh, mm, ss);
  }

  if ((match = str.match(dateOnly))) {
    const [, day, month, year] = match.map(Number);
    return new Date(year, month - 1, day);
  }

  if ((match = str.match(timeOnly))) {
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

  return null; // Không parse được
}

// Tạo key tháng từ chuỗi date
function getMonthKeyFromCustomDate(str) {
  const d = parseCustomDate(str);
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`;
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

const MonthCalendar = ({
  monthKey,
  postsInMonth,
  restoreAnchorDate,
  nextRestoreDate,
  pendingRestoreDate,
  confirmedRestoreDate,
  onSelectRestoreDate,
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

  // Gom bài viết theo ngày
  const postsByDate = useMemo(() => {
    const map = {};
    postsInMonth.forEach((post) => {
      const d = parseCustomDate(post?.createdAt);
      const key = `${d.getFullYear()}-${(d.getMonth() + 1)
        .toString()
        .padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
      if (!map[key]) map[key] = [];
      map[key].push(post);
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

  // Tên tháng đẹp
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
    <div className="mb-8 bg-base-300 rounded-3xl shadow-lg overflow-hidden">
      <h2
        className="text-xl font-bold mb-0 w-full rounded-t-3xl bg-base-100 text-base-content
               py-3 px-6 shadow-md select-none"
      >
        {monthName}
      </h2>
      <div className="grid grid-cols-7 md:grid-cols-14 gap-1 md:gap-3 p-6">
        {/* Tiêu đề cho mobile (7 cột) */}
        {daysMobile.map((d) => (
          <div
            key={"mobile-" + d}
            className="block text-center font-medium text-sm border-b pb-1 md:hidden"
          >
            {d}
          </div>
        ))}

        {/* Tiêu đề cho màn to (14 cột) */}
        {daysDesktop.map((d, i) => (
          <div
            key={"desktop-" + i}
            className="hidden md:block text-center font-medium text-sm border-b pb-1"
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
          const dayKey = `${day.getFullYear()}-${(day.getMonth() + 1)
            .toString()
            .padStart(2, "0")}-${day.getDate().toString().padStart(2, "0")}`;
          const posts = postsByDate[dayKey] || [];
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

          return (
            <button
              type="button"
              key={dayKey}
              data-restore-date={isRestoreRange ? dayValue : undefined}
              disabled={!canSelectRestore}
              onClick={() => onSelectRestoreDate(dayValue)}
              className={`aspect-square rounded-xl border p-1 flex flex-col overflow-hidden group relative transition
                ${
                  isCurrentDay
                    ? "border-yellow-400 border-3 bg-base-100"
                    : isInStreak || isConfirmedRestore
                    ? "border-yellow-400 border-3 bg-base-200"
                    : canSelectRestore
                      ? "border-amber-400 bg-amber-400/15 ring-2 ring-amber-400/50 cursor-pointer active:scale-95"
                      : isPendingRestore
                        ? "border-blue-400 bg-blue-400/10"
                        : isLockedRestore
                          ? "border-base-300 bg-base-200/60 opacity-55"
                          : "border-gray-300 bg-base-100"
                }
              `}
              title={
                restoreTitle ||
                (posts.length > 0 ? posts[0].createdAt : dayKey)
              }
              aria-label={restoreTitle || `Ngày ${formatRestoreDate(dayValue)}`}
            >
              <div className="relative z-10 mb-1 text-center text-xs font-semibold select-none">
                {day.getDate()}
              </div>
              {isCurrentDay && (
                <span
                  className="absolute inset-0 flex items-center justify-center text-green-500 select-none"
                  aria-hidden="true"
                >
                  <Plus className="h-3 w-3 stroke-[2.5]" />
                </span>
              )}
              {canSelectRestore && (
                <span
                  className="absolute inset-0 flex justify-center items-center text-amber-500 select-none"
                  aria-hidden="true"
                >
                  <Flame className="h-7 w-7" fill="currentColor" />
                </span>
              )}
              {isPendingRestore && (
                <span className="absolute inset-0 flex items-center justify-center text-blue-500">
                  <LoaderCircle className="h-6 w-6 animate-spin" />
                </span>
              )}
              {isLockedRestore && (
                <span className="absolute inset-0 flex items-center justify-center text-base-content/40">
                  <LockKeyhole className="h-5 w-5" />
                </span>
              )}
              {isConfirmedRestore && !posts.length && (
                <span className="absolute inset-0 flex items-center justify-center text-yellow-500">
                  <CheckCircle2 className="h-6 w-6" />
                </span>
              )}
              {posts.length === 0 ? (
                <div className="flex-1" />
              ) : (
                <div className="grid grid-cols-2 gap-0.5 flex-1 overflow-hidden">
                  {posts.slice(0, 4).map((item, index) => (
                    <div
                      key={item.id || index + 1}
                      className="relative rounded-md overflow-hidden"
                      title={item.captions?.[0]?.text || item.date}
                    >
                      {item.video_url ? (
                        <>
                          <img
                            src={item.thumbnail_url}
                            alt="video thumbnail"
                            className="object-cover w-full h-full"
                            loading="lazy"
                          />
                          <div className="absolute top-1 right-1 bg-primary/80 rounded-full p-0.5">
                            <MdSlowMotionVideo className="text-white text-xs" />
                          </div>
                        </>
                      ) : (
                        <img
                          src={item.thumbnail_url || item.image_url}
                          alt={item.captions?.[0]?.text || "Image"}
                          className="object-cover w-full h-full"
                          loading="lazy"
                        />
                      )}
                    </div>
                  ))}
                  {isInStreak &&
                    day.getTime() ===
                      yyyymmddToDate(
                        streak.last_updated_yyyymmdd
                      ).getTime() && (
                      <div className="absolute bg-yellow-400 text-black text-[10px] px-1 font-bold bottom-0 right-0 rounded-tl-sm">
                        {streak?.count}
                      </div>
                    )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const StreaksCalender = ({ recentPosts = [] }) => {
  const { navigation, camera } = useApp();
  const streak = useStreakStore((state) => state.streak);
  const restoreFlow = usePostStore((state) => state.restoreFlow);
  const selectRestoreFlowDate = usePostStore(
    (state) => state.selectRestoreFlowDate,
  );
  const setRestoreStreak = usePostStore((state) => state.setRestoreStreak);
  const today = getRestoreToday();
  const restoreAnchorDate = getRestoreAnchorDate(streak, today);
  const nextRestoreDate = getNextRestoreDate({
    streak,
    confirmedDate: restoreFlow.confirmedDate,
    today,
  });

  const postsByMonth = useMemo(() => {
    const map = {};
    recentPosts.forEach((post) => {
      const monthKey = getMonthKeyFromCustomDate(post?.createdAt);
      if (!map[monthKey]) map[monthKey] = [];
      map[monthKey].push(post);
    });

    if (restoreAnchorDate && restoreAnchorDate < today) {
      getMonthKeysBetween(restoreAnchorDate, today).forEach((monthKey) => {
        if (!map[monthKey]) map[monthKey] = [];
      });
    }

    return map;
  }, [recentPosts, restoreAnchorDate, today]);

  const monthsSorted = useMemo(() => {
    const preferredMonthKey = nextRestoreDate
      ? toCalendarMonthKey(yyyymmddToDate(nextRestoreDate))
      : null;
    return getVisibleCalendarMonths(Object.keys(postsByMonth), {
      preferredMonthKey,
    });
  }, [nextRestoreDate, postsByMonth]);

  const lastMonthRef = useRef(null);

  useEffect(() => {
    if (lastMonthRef.current) {
      lastMonthRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [monthsSorted]);

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

  return (
    <div>
      {restoreAnchorDate &&
        restoreAnchorDate < today &&
        nextRestoreDate &&
        nextRestoreDate < today && (
        <div className="mx-1 mb-4 rounded-lg border border-amber-400/50 bg-amber-400/10 px-3 py-2 text-sm">
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
            />
          </div>
        );
      })}
    </div>
  );
};

export default StreaksCalender;
