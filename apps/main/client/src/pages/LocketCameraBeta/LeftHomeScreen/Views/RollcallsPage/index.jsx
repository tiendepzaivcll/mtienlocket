import React, { useState, useEffect, useCallback, useRef } from "react";
import { getFriendDetail } from "@/cache/friendsDB";
import { getRollcallPosts } from "@/services";
import RollcallCard from "./RollcallCard";
import { getRollcallsByWeek, saveRollcalls } from "@/cache/rollcallDb";
import { getISOWeek, getWeekRange } from "@/utils";
import WeekNavigator from "./WeekNavigator";

function RollcallsPost({ active, posts, setPosts, isProfileOpen }) {
  const { week: currentWeek, year: currentYear } = getISOWeek();

  const [selectedWeek, setSelectedWeek] = useState(currentWeek);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [visibleCount, setVisibleCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const abortRef = useRef(null);

  // reset visible khi đổi tab
  useEffect(() => {
    if (active === "lockets") setVisibleCount(5);
  }, [active]);

  // reset visible khi đổi tuần
  useEffect(() => {
    setVisibleCount(2);
  }, [selectedWeek, selectedYear, isProfileOpen]);

  const fetchPosts = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setLoadError("");

    let cachedPosts = [];
    try {
      cachedPosts = await getRollcallsByWeek(selectedWeek, selectedYear);
      if (!controller.signal.aborted && cachedPosts.length) {
        setPosts(cachedPosts);
      }

      let data;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          data =
            (await getRollcallPosts({
              selectWeek: selectedWeek,
              selectYear: selectedYear,
              signal: controller.signal,
            })) || [];
          break;
        } catch (error) {
          if (controller.signal.aborted) throw error;
          const status = error?.response?.status;
          const retryable = !status || status === 429 || status >= 500;
          if (!retryable || attempt === 2) throw error;
          await new Promise((resolve) =>
            setTimeout(resolve, attempt === 0 ? 500 : 1500),
          );
        }
      }

      if (controller.signal.aborted) return;

      const postsWithUser = await Promise.all(
        data.map(async (post) => {
          const userDetail = await getFriendDetail(post.user);
          return { ...post, userDetail };
        }),
      );

      await saveRollcalls(data, {
        week: selectedWeek,
        year: selectedYear,
      });
      setPosts(postsWithUser);
    } catch (err) {
      if (
        controller.signal.aborted ||
        err?.name === "CanceledError" ||
        err?.code === "ERR_CANCELED"
      ) {
        return;
      }
      console.error("Failed to load rollcall posts:", err);
      if (!cachedPosts.length) {
        setPosts([]);
        setLoadError(
          err?.response?.data?.message ||
            "Không tải được Rollcalls. Vui lòng thử lại.",
        );
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [selectedWeek, selectedYear, setPosts]);

  // 🔥 luôn fetch khi đổi tuần / năm
  useEffect(() => {
    fetchPosts();
    return () => abortRef.current?.abort();
  }, [fetchPosts]);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollTop + clientHeight >= scrollHeight - 10) {
      setVisibleCount((prev) => Math.min(prev + 5, posts.length));
    }
  };

  return (
    <div
      className="h-full p-4 w-full flex flex-col gap-4 overflow-y-auto pb-24"
      onScroll={handleScroll}
    >
      {/* 🔥 Week navigator */}
      <WeekNavigator
        week={selectedWeek}
        year={selectedYear}
        onChange={(w, y) => {
          setSelectedWeek(w);
          setSelectedYear(y);
        }}
      />

      <h2 className="text-xl font-bold">
        Rollcalls – {getWeekRange(selectedWeek, selectedYear)}
      </h2>

      {loading && <div className="opacity-60">Loading...</div>}

      {!loading && loadError && (
        <div className="rounded-xl bg-error/10 p-3 text-sm text-error">
          {loadError}
        </div>
      )}

      {!loading && !loadError && posts.length === 0 && (
        <div className="opacity-60">Tuần này chưa có Rollcall.</div>
      )}

      {!loading &&
        posts
          .slice(0, visibleCount)
          .map((post) => <RollcallCard key={post.uid} post={post} />)}
    </div>
  );
}

export default RollcallsPost;
