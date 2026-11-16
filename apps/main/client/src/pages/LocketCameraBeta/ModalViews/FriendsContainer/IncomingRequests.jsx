import React from "react";
import { useFriendRequests } from "./useFriendRequests";
import { FaStarOfLife } from "react-icons/fa";
import {
  AcceptRequestToFriend,
} from "@/services";
import { useApp } from "@/context/AppContext";
import { Check } from "lucide-react";
import { SonnerError, SonnerSuccess } from "@/components/ui/SonnerToast";
import { useFriendStoreV3 } from "@/stores";
import { getAvatarSource, handleAvatarError } from "@/utils/avatar";

const IncomingFriendRequests = () => {
  const { navigation } = useApp();
  const { isFriendsTabOpen } = navigation;
  const { friends, setFriends, nextPageToken, loading, errorMessage,
    showAllFriends, setShowAllFriends, fetchFriendRequests } = useFriendRequests(isFriendsTabOpen, "incoming");
  const addFriendLocal = useFriendStoreV3((s) => s.addFriendLocal);

  const handleAcceptRequest = async (uid) => {
    try {
      const data = await AcceptRequestToFriend(uid);
      if (data) {
        await addFriendLocal(data);
        setFriends((previous) => previous.filter((friend) => friend.uid !== uid));
        // ✅ Hiển thị thông báo
        SonnerSuccess(
          "Thông báo từ MTIEN",
          `Đã chấp nhận ${data.firstName}`
        );
      } else {
        SonnerError(
          "Thông báo từ MTIEN",
          "Không tìm thấy lời mời để chấp nhận."
        );
      }
    } catch (error) {
      console.error("❌ Lỗi khi chấp nhận lời mời:", error.message || error);
      SonnerError("❌ Chấp nhận lời mời thất bại!");
    }
  };

  const visibleFriends = showAllFriends ? friends : friends.slice(0, 3);

  return (
    <div>
      <h2 className="flex flex-row items-center gap-2 text-base-content font-semibold text-md lg:text-xl mb-3">
        <FaStarOfLife size={22} /> Lời mời kết bạn
      </h2>
      <div className="text-xs text-gray-500 mt-1 w-full"></div>

      <button type="button" className="btn btn-xs btn-ghost mb-2" disabled={loading}
        onClick={() => fetchFriendRequests()}>{loading ? "Đang tải…" : "Làm mới yêu cầu"}</button>
      {errorMessage && <p role="alert" className="mb-2 text-sm text-error">{errorMessage}</p>}
      {loading && friends.length === 0 ? (
        <p className="text-center text-gray-400 h-[70px]">Đang tải...</p>
      ) : friends.length === 0 ? (
        <p className="text-center text-gray-400 h-[70px]">
          {errorMessage ? "Chưa xác định được danh sách lời mời." : "Không có lời mời kết bạn."}
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {visibleFriends.map((friend) => (
              <div
                key={friend.uid}
                className="flex items-center gap-3 rounded-md cursor-pointer justify-between"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={getAvatarSource(friend)}
                    alt={`${friend.firstName} ${friend.lastName}`}
                    onError={handleAvatarError}
                    className="w-16 h-16 rounded-full border-[3.5px] p-0.5 border-amber-400 object-cover"
                  />
                  <div>
                    <h2 className="font-medium">
                      {friend.firstName} {friend.lastName}
                    </h2>
                    <p className="text-sm text-gray-500 underline">
                      @{friend.username || "Không có username"}
                    </p>
                  </div>
                </div>
                <button
                  className="btn flex flex-row justify-center bg-yellow-500 text-black p-1 px-3 rounded-full transition shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAcceptRequest(friend.uid);
                  }}
                >
                  <Check className="w-5 h-5" strokeWidth={3} />
                  <span className="text-base font-semibold">Chấp nhận</span>
                </button>
              </div>
            ))}
          </div>

          {(friends.length > 3 || nextPageToken) && (
            <div className="flex items-center gap-4 mt-4">
              <hr className="flex-grow border-t border-base-content" />
              <button
                onClick={async () => {
                  if (!showAllFriends) {
                    setShowAllFriends(true);
                  } else if (nextPageToken) {
                    await fetchFriendRequests(nextPageToken);
                  }
                }}
                className="bg-base-200 hover:bg-base-300 text-base-content font-semibold px-4 py-2 transition-colors rounded-3xl"
              >
                {nextPageToken
                  ? "Xem thêm"
                  : showAllFriends
                  ? "Đã hiện hết"
                  : "Xem thêm"}
              </button>
              <hr className="flex-grow border-t border-base-content" />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default IncomingFriendRequests;
