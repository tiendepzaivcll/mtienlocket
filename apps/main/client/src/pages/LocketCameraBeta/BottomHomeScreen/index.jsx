import { useEffect, useRef, useState } from "react";
import { useApp } from "@/context/AppContext";
import UploadingQueue from "./MomentsView/UploadingQueue";
import MomentsGrid from "./MomentsView/MomentsGrid";
import QueueViewer from "./MomentsView/QueueViewer";

import { Swiper, SwiperSlide } from "swiper/react";
import { Virtual } from "swiper/modules";
import "swiper/css";
import MomentSlide from "./MomentsView/MomentSlide";
import { useSocket } from "@/context/SocketContext";
import { useAuthStore, useMomentsStoreV2, useViewedMomentsStore } from "@/stores";
import { getToken } from "@/utils";
import { isPhotoUnseen } from "@/utils/moment/unseenMoments";

const EMPTY_ITEMS = [];

const BottomHomeScreen = () => {
  const { navigation, post } = useApp();
  const [swiperRef, setSwiperRef] = useState(null);
  const {
    isHomeOpen,
    isBottomOpen,
    setIsBottomOpen,
    showFlyingEffect,
    flyingEmojis,
    setIsHomeOpen,
    isProfileOpen,
  } = navigation;
  const {
    selectedMoment,
    setSelectedMoment,
    selectedQueue,
    setSelectedQueue,
    selectedFriendUid,
    selectedMomentId,
    setSelectedMomentId,
  } = post;

  const { user, updateLastSeenHistoryAt } = useAuthStore();
  const currentUserId = user?.uid || user?.localId || null;
  const viewedIds = useViewedMomentsStore((s) => s.viewedIds);
  const markViewed = useViewedMomentsStore((s) => s.markViewed);
  const markAllViewed = useViewedMomentsStore((s) => s.markAllViewed);

  const { socket, isConnected } = useSocket();

  const selectedKey = selectedFriendUid ?? "all";

  const bucket = useMomentsStoreV2((s) => s.momentsByUser[selectedKey]);

  const moments = bucket?.items || EMPTY_ITEMS;
  const loading = bucket?.loading || false;
  const hasMore = bucket?.hasMore ?? true;
  const visibleCount = bucket?.visibleCount || 0;

  const {
    fetchMoments,
    loadMoreOlder,
    addNewMoment,
    syncMomentsSnapshot,
    increaseVisibleCount,
    resetVisible,
    markMomentsAsSeen,
  } = useMomentsStoreV2();

  // Quy tắc cập nhật trạng thái "Đã xem" (Mark as seen):
  // Ngay khi user vuốt xuống / bấm vào "Lịch sử" và lướt xem các ảnh mới,
  // hãy cập nhật ngay trạng thái đã xem lên Firebase:
  // - Thêm currentUser.uid vào seenBy của các ảnh hiển thị trên màn hình
  // - Cập nhật lastSeenHistoryAt = serverTimestamp() / Date.now()
  const markedMomentsRef = useRef(new Set());
  const hasUpdatedInitialLastSeenRef = useRef(false);

  useEffect(() => {
    if (!isBottomOpen || !currentUserId || !moments.length) return;

    // Lấy danh sách ảnh đang hiển thị trên màn hình (theo visibleCount hoặc 12 ảnh ban đầu)
    const displayedCount = Math.max(visibleCount || 0, 12);
    const displayedMoments = moments.slice(0, displayedCount);

    // Lọc ra các ảnh do người khác gửi mà user chưa xem
    const unseenDisplayed = displayedMoments.filter(
      (m) =>
        !markedMomentsRef.current.has(m.id) &&
        isPhotoUnseen(m, currentUserId, viewedIds, user?.lastSeenHistoryAt),
    );

    if (unseenDisplayed.length > 0) {
      unseenDisplayed.forEach((m) => markedMomentsRef.current.add(m.id));
      markAllViewed(unseenDisplayed);
      markMomentsAsSeen?.(
        unseenDisplayed.map((m) => m.id),
        currentUserId,
      );
      updateLastSeenHistoryAt?.(Date.now());
    } else if (!user?.lastSeenHistoryAt && !hasUpdatedInitialLastSeenRef.current) {
      hasUpdatedInitialLastSeenRef.current = true;
      updateLastSeenHistoryAt?.(Date.now());
    }
  }, [
    isBottomOpen,
    visibleCount,
    moments,
    currentUserId,
    viewedIds,
    user?.lastSeenHistoryAt,
    markAllViewed,
    markMomentsAsSeen,
    updateLastSeenHistoryAt,
  ]);

  useEffect(() => {
    resetVisible(selectedFriendUid);
  }, [isBottomOpen, isHomeOpen, isProfileOpen, selectedFriendUid]);

  // Fetch initial moments - Dùng ref và currentUserId để không bị re-fetch lặp vô tận khi user object thay đổi tham chiếu
  const hasFetchedBottomMomentsRef = useRef(false);
  useEffect(() => {
    hasFetchedBottomMomentsRef.current = false;
  }, [currentUserId, selectedFriendUid]);

  useEffect(() => {
    if (!user || !currentUserId || hasFetchedBottomMomentsRef.current) return;
    hasFetchedBottomMomentsRef.current = true;
    fetchMoments(user, selectedFriendUid);
  }, [user, currentUserId, selectedFriendUid, fetchMoments]);

  useEffect(() => {
    if (!swiperRef) return;
    if (selectedMomentId == null) return;

    const newIndex = moments.findIndex((m) => m.id === selectedMomentId);

    if (newIndex === -1) return;

    if (newIndex !== selectedMoment) {
      setSelectedMoment(newIndex);
      swiperRef.slideTo(newIndex, 0); // giữ nguyên moment đang xem
    }
  }, [moments, selectedMomentId, swiperRef]);

  const handleClose = () => {
    setSelectedMoment(null);
    setSelectedMomentId(null);
  };

  const { idToken } = getToken();

  // ================= Socket init =================
  useEffect(() => {
    if (!idToken || !socket) return;

    const handleMoments = (data) => {
      if (!data) return;

      // 🧠 Snapshot (xoá / sync)
      if (Array.isArray(data) && data.length > 1) {
        syncMomentsSnapshot(data);
        return;
      }

      // 🧠 Add realtime
      addNewMoment(data);
    };
    // LISTEN
    socket.on("new_on_moments", handleMoments);

    // EMIT để server gửi moments đầu tiên
    socket.emit("on_moments", {
      timestamp: null,
      token: idToken,
      friendId: null,
      limit: 5,
    });
    // console.log(socket._callbacks);

    // CLEANUP — rất quan trọng
    return () => {
      socket.off("new_on_moments", handleMoments); // phải cùng tên event!
    };
  }, [idToken, socket]); // nên thêm socket vào dependency

  // Tính toán selectedAnimate dựa trên selectedMoment và selectedQueue
  const selectedAnimate =
    (selectedMoment !== null && selectedQueue === null) ||
    (selectedMoment === null && selectedQueue !== null);

  return (
    <>
      {/* <FlyingEmojiEffect emoji={flyingEmojis} show={showFlyingEffect} /> */}
      {typeof selectedMoment === "number" ||
      typeof selectedQueue === "number" ? (
        <>
          <div className="fixed z-50 inset-0 w-full flex flex-col justify-center h-full items-center">
            {typeof selectedMoment === "number" && (
              <Swiper
                direction="vertical"
                className="w-full h-full max-w-md aspect-square flex flex-col justify-center items-center"
                modules={[Virtual]}
                onSwiper={setSwiperRef}
                slidesPerView={1}
                initialSlide={selectedMoment}
                virtual
                onSlideChange={(swiper) => {
                  const newIndex = swiper.activeIndex;

                  if (newIndex === selectedMoment) return; // <-- FIX LOOP

                  if (newIndex < 0 || newIndex >= moments.length) return;

                  setSelectedMoment(newIndex);
                  setSelectedMomentId(moments[newIndex]?.id);
                  if (moments[newIndex]) {
                    markViewed(moments[newIndex]);
                    if (currentUserId && moments[newIndex]?.id) {
                      markMomentsAsSeen?.([moments[newIndex].id], currentUserId);
                    }
                    updateLastSeenHistoryAt?.(Date.now());
                  }
                }}
              >
                {moments.map((slideContent, index) => (
                  <SwiperSlide
                    key={slideContent.id}
                    virtualIndex={index}
                    className="h-full flex items-center justify-center"
                  >
                    <div className="w-full h-full pb-26 flex items-center justify-center">
                      <MomentSlide
                        moment={slideContent}
                        me={user}
                        handleClose={handleClose}
                        isActive={index === selectedMoment}
                        className="w-full max-w-3xl"
                      />
                    </div>
                  </SwiperSlide>
                ))}
              </Swiper>
            )}
            {typeof selectedQueue === "number" && <QueueViewer />}
          </div>
        </>
      ) : null}
      <div
        className={`transition-all w-full duration-500 ${
          selectedAnimate
            ? "opacity-0 scale-95 pointer-events-none select-none"
            : "opacity-100 scale-100"
        }`}
      >
        <UploadingQueue />
        <MomentsGrid
          visibleCount={visibleCount}
          increaseVisibleCount={() => increaseVisibleCount(selectedFriendUid)}
          moments={moments}
          loadMoreOlder={loadMoreOlder}
          hasMore={hasMore}
          loading={loading}
        />
      </div>
    </>
  );
};

export default BottomHomeScreen;
