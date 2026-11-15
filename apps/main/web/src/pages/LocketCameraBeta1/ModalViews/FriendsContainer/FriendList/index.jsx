import SearchInput from "@/components/ui/Input/SearchInput";
import LoadingRing from "@/components/ui/Loading/ring";
import {
  SonnerError,
  SonnerSuccess,
  SonnerWarning,
} from "@/components/ui/SonnerToast";
import { removeFriend, toggleHiddenFriend } from "@/services";
import { RefreshCcw } from "lucide-react";
import { useState, useEffect } from "react";
import { FaUserFriends } from "react-icons/fa";
import FriendItem from "./FriendItem";

const FriendList = ({
  friendList,
  loading,
  loadFriends,
  removeFriendLocal,
  hiddenUserState,
  showAllFriends,
  setShowAllFriends,
}) => {
  const [lastUpdated, setLastUpdated] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFocused, setIsFocused] = useState(null);

  // 🚀 THẦN CHÚ AUTO LOAD: Tự động chạy âm thầm khi Web vừa khởi động
  useEffect(() => {
    // Nếu danh sách trống thì mới auto load để tránh spam API
    if (friendList.length === 0) {
      loadFriends();
    }
  }, []); // Ngoặc vuông rỗng đảm bảo nó chỉ tự chạy 1 lần duy nhất lúc mới vào trang

  // Manual refresh remains available when background sync is delayed.
  const handleRefreshFriends = async () => {
    try {
      await loadFriends();

      const updatedAt = new Date().toISOString();
      localStorage.setItem("friendsUpdatedAt", updatedAt);
      setLastUpdated(updatedAt);

      SonnerSuccess("Cập nhật thành công", "Đã làm mới danh sách bạn bè!");
    } catch (error) {
      console.error("❌ Lỗi khi làm mới bạn bè:", error);
      SonnerError("Có lỗi xảy ra khi làm mới danh sách.");
    }
  };

  const handleDeleteFriend = async (uid) => {
    try {
      const result = await removeFriend(uid);
      if (result === uid) {
        removeFriendLocal(uid);
        // ✅ update DB + localStorage
        SonnerSuccess("Đã xoá bạn thành công.");
      } else {
        SonnerWarning("Vui lòng thử lại sau!");
      }
    } catch (error) {
      console.error("❌ Lỗi khi xoá bạn:", error);
      SonnerError("Có lỗi xảy ra khi xoá bạn.");
    }
  };

  const handleHiddenFriend = async (relation, uid) => {
    if (!relation) return;

    const prevHidden = relation.hidden ?? false;

    hiddenUserState(uid, !prevHidden);

    try {
      const res = await toggleHiddenFriend(uid);
      if (!res?.success) throw new Error();
      SonnerSuccess("Đã cập nhật trạng thái!");
    } catch {
      hiddenUserState(uid, prevHidden);
      SonnerError("Không thể cập nhật trạng thái");
    }
  };

  // Filter bạn bè theo tên hoặc username
  const filteredFriends = friendList.filter((friend) => {
    const fullName = `${friend.firstName} ${friend.lastName}`.toLowerCase();
    const username = (friend.username || "").toLowerCase();
    const term = searchTerm.toLowerCase();
    return fullName.includes(term) || username.includes(term);
  });

  const visibleFriends = showAllFriends
    ? filteredFriends
    : filteredFriends.slice(0, 3);

  return (
    <div>
      <h1 className="flex items-center gap-2 font-semibold text-md mb-1">
        <FaUserFriends size={25} className="scale-x-[-1]" /> Bạn bè của bạn
      </h1>

      {/* Search + refresh */}
      <div className="flex gap-2 items-center mt-2">
        <SearchInput
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          isFocused={isFocused}
          setIsFocused={setIsFocused}
          placeholder="Tìm kiếm bạn bè..."
        />
        <button
          className={`btn btn-base-200 text-sm flex items-center gap-2 ${
            loading ? "opacity-50 cursor-not-allowed" : ""
          }`}
          onClick={handleRefreshFriends}
          disabled={loading}
        >
          {loading ? (
            <>
              <LoadingRing size={20} stroke={2} />
              <span>Đang làm mới...</span>
            </>
          ) : (
            <>
              <RefreshCcw className="w-5 h-5" />
              <span>Làm mới</span>
            </>
          )}
        </button>
      </div>

      {/* Last updated */}
      {lastUpdated && (
        <p className="text-xs text-gray-500 mt-1">
          Cập nhật lần cuối: {new Date(lastUpdated).toLocaleString("vi-VN")}
        </p>
      )}

      {/* List */}
      <div className="mt-4">
        {filteredFriends.length === 0 && (
          <p className="text-gray-400 text-center mt-10">
            Không có bạn bè để hiển thị
          </p>
        )}

        {visibleFriends.map((friend) => (
          <FriendItem
            key={friend.uid}
            friend={friend}
            onDelete={handleDeleteFriend}
            onHidden={handleHiddenFriend}
          />
        ))}

        {filteredFriends.length > 3 && (
          <div className="flex items-center gap-4 mt-4">
            <hr className="flex-grow border-t border-base-content" />
            <button
              onClick={() => setShowAllFriends(!showAllFriends)}
              className="bg-base-200 hover:bg-base-300 text-base-content font-semibold px-4 py-2 rounded-3xl"
            >
              {showAllFriends ? "Thu gọn" : "Xem thêm"}
            </button>
            <hr className="flex-grow border-t border-base-content" />
          </div>
        )}
      </div>
    </div>
  );
};

export default FriendList;
