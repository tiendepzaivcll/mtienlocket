import React, { lazy, Suspense } from "react";
import { useApp } from "@/context/AppContext";
import { CalendarClock, LoaderCircle, X } from "lucide-react";
import { usePostStore } from "@/stores";
import { formatRestoreDate } from "@/utils/streakRestoreFlow";

import HeaderHome from "./Layout/HeaderHome";
import BottomMenu from "../BottomHomeScreen/Layout/BottomMenu";
import HistoryArrow from "./Layout/HistoryButton";
import ActionControls from "./ActionControls";
import MediaPreview from "./Layout/MediaPreview";
import MediaSizeInfo from "@/components/ui/MediaSizeInfo/index.jsx";

const BottomHomeScreen = lazy(() => import("../BottomHomeScreen"));
const SelectFriendsList = lazy(() => import("./Layout/SelectFriends"));

const RestoreFlowBanner = () => {
  const restoreFlow = usePostStore((state) => state.restoreFlow);
  const clearSelection = usePostStore(
    (state) => state.clearRestoreFlowSelection,
  );

  if (!restoreFlow.selectedDate) return null;

  const isPending = restoreFlow.status === "pending";
  const isFailed = restoreFlow.status === "failed";
  const isRestore = restoreFlow.mode === "restore";

  return (
    <div
      data-testid="restore-flow-banner"
      className={`absolute top-16 z-40 flex max-w-[90%] items-center gap-2 rounded-lg border bg-base-100/90 px-3 py-2 text-sm shadow-md backdrop-blur-xl ${
        isFailed ? "border-error/60" : "border-amber-300/60"
      }`}
      title={isFailed ? restoreFlow.error || "Khôi phục chưa thành công" : undefined}
    >
      {isPending ? (
        <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-blue-500" />
      ) : (
        <CalendarClock className="h-4 w-4 shrink-0 text-amber-500" />
      )}
      <span className="font-medium">
        {isPending
          ? "Đang xác nhận"
          : isFailed
            ? "Thử lại ngày"
          : isRestore
            ? "Khôi phục"
            : "Đăng moment"}{" "}
        {formatRestoreDate(restoreFlow.selectedDate)}
      </span>
      {!isPending && (
        <button
          type="button"
          onClick={clearSelection}
          className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-base-300"
          title="Huỷ ngày đã chọn"
          aria-label="Huỷ ngày đã chọn"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

export default function MainHomeScreen() {
  const { navigation, post } = useApp();

  const {
    isHomeOpen,
    isProfileOpen,
    isBottomOpen,
    setIsProfileOpen,
    setIsBottomOpen,
    setFriendsTabOpen,
    setIsSidebarOpen,
    setOptionModalOpen,
    isFriendHistoryOpen,
    setFriendHistoryOpen,
  } = navigation;
  const { selectedFile } = post;

  return (
    <>
      <div
        className={`relative transition-all duration-500 flex flex-col justify-center items-center w-full h-[100vh] text-base-content ${
          isProfileOpen
            ? "translate-x-full"
            : isHomeOpen
            ? "-translate-x-full"
            : "translate-x-0"
        }`}
      >
        <HeaderHome
          setIsProfileOpen={setIsProfileOpen}
          setFriendsTabOpen={setFriendsTabOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          isBottomOpen={isBottomOpen}
          setFriendHistoryOpen={setFriendHistoryOpen}
          isFriendHistoryOpen={isFriendHistoryOpen}
          selectedFile={selectedFile}
        />
        <RestoreFlowBanner />
        <div
          className={`w-full h-full flex flex-1 flex-col transition-all duration-500 justify-center items-center ${
            isBottomOpen ? "translate-x-0" : "fixed translate-y-full"
          }`}
        >
          <div className="w-full h-full overflow-y-auto">
            <div className="h-16" />
            <Suspense fallback={null}>
              <BottomHomeScreen />
            </Suspense>
          </div>
          {/* Click để đóng lịch sử */}
          <BottomMenu setOptionModalOpen={setOptionModalOpen} />
        </div>
        <div
          className={`w-full h-full flex flex-col transition-all duration-500 justify-evenly items-center ${
            isBottomOpen ? "fixed -translate-y-full" : "translate-x-0"
          }`}
        >
          <div className="h-10" />
          <MediaPreview />
          <MediaSizeInfo />
          <ActionControls />
          {/* Click để mở lịch sử */}
          <div className="relative w-full">
            {/* SelectFriendsList */}
            <div
              className={`
              transition-all duration-300
              ${
                selectedFile
                  ? "opacity-100 visible"
                  : "opacity-0 invisible hidden"
              }
            `}
            >
              <Suspense fallback={null}>
                <SelectFriendsList />
              </Suspense>
            </div>

            {/* HistoryArrow */}
            <div
              className={`
              pb-16 transition-all duration-300
              ${
                !selectedFile
                  ? "opacity-100 visible"
                  : "opacity-0 invisible hidden"
              }
            `}
            >
              <HistoryArrow setIsBottomOpen={setIsBottomOpen} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
