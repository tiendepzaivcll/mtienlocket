import { useState } from "react";
import NormalItemFriend from "./NormalItemFriend";
import { FaSearchPlus } from "react-icons/fa";
import SearchInput from "@/components/ui/Input/SearchInput";
import CelebItemFriend from "./CelebItemFriend";
import {
  SonnerInfo,
  SonnerSuccess,
  SonnerWarning,
} from "@/components/ui/SonnerToast";
import {
  FindFriendByUserName,
  SendRequestToCelebrity,
  SendRequestToFriend,
} from "@/services";
import BouncyLoader from "@/components/ui/Loading/Bouncy";
import { getToken, isCelebrityProfile } from "@/utils";

const FindFriend = () => {
  const [loading, setLoading] = useState(false);
  const [searchTermFind, setSearchTermFind] = useState("");
  const [foundUser, setFoundUser] = useState(null);
  const [isFocusedFind, setIsFocusedFind] = useState(null);

  const handleFindFriend = async (username) => {
    if (!username) return;

    try {
      setLoading(true);
      const result = await FindFriendByUserName(username);
      const user = result?.data || (result?.uid ? result : null);

      if (result?.success === true && user) {
        setFoundUser(user);
      } else {
        setFoundUser(null);
        SonnerInfo("Người dùng không tồn tại");
      }
    } catch (error) {
      console.error("❌ Lỗi khi tìm bạn:", error);
      setFoundUser(null);
      SonnerInfo(
        error?.response?.data?.message ||
          error.message ||
          "Người dùng không tồn tại",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAddFriend = async () => {
    if (!foundUser) return;

    const uid = String(foundUser?.uid || foundUser?.user_uid || "").trim();
    if (uid && uid === String(getToken()?.localId || "").trim()) {
      SonnerInfo("Đây là tài khoản đang đăng nhập của bạn.");
      return;
    }

    try {
      setLoading(true);

      if (isCelebrityProfile(foundUser)) {
        await SendRequestToCelebrity(foundUser.uid);
        SonnerSuccess("Gửi lời mời thành công!");

        // 👉 fetch lại để cập nhật friendship_status mới
        await handleFindFriend(searchTermFind);
      } else {
        if (!uid) throw new Error("Hồ sơ không có UID hợp lệ");
        await SendRequestToFriend(uid);
        SonnerSuccess("Gửi lời mời kết bạn thành công!");
        await handleFindFriend(searchTermFind);
      }
    } catch (error) {
      console.error("❌ Lỗi gửi yêu cầu:", error);
      SonnerWarning(
        error?.response?.data?.message ||
          error?.response?.data?.error?.message ||
          error.message ||
          "Gửi yêu cầu thất bại",
      );
    } finally {
      setLoading(false);
    }
  };

  const isCelebrity = isCelebrityProfile(foundUser);
  const foundUid = String(foundUser?.uid || foundUser?.user_uid || "").trim();
  const isSelf = Boolean(
    foundUid && foundUid === String(getToken()?.localId || "").trim(),
  );

  return (
    <div>
      <h2 className="flex items-center gap-2 text-md font-semibold mb-1">
        <FaSearchPlus size={22} /> Tìm kiếm ai đó?
      </h2>

      <form
        className="flex gap-2 items-center"
        onSubmit={(event) => {
          event.preventDefault();
          void handleFindFriend(searchTermFind);
        }}
      >
        <SearchInput
          searchTerm={searchTermFind}
          setSearchTerm={setSearchTermFind}
          isFocused={isFocusedFind}
          setIsFocused={setIsFocusedFind}
          placeholder="Thêm một người bạn mới..."
        />

        {searchTermFind && (
          <button
            type="submit"
            disabled={loading}
            className="btn btn-base-200 text-base flex items-center gap-2 rounded-full"
          >
            {loading ? (
              <>
                <BouncyLoader size={25} color="orange"/> Đợi tí
              </>
            ) : (
              "Tìm kiếm"
            )}
          </button>
        )}
      </form>

      <div className="w-full flex justify-center mt-2">
        {foundUser ? (
          isCelebrity ? (
            <CelebItemFriend
              friend={foundUser}
              handleAddFriend={handleAddFriend}
              loading={loading}
              isSelf={isSelf}
            />
          ) : (
            <NormalItemFriend
              friend={foundUser}
              handleAddFriend={handleAddFriend}
              loading={loading}
              isSelf={isSelf}
            />
          )
        ) : (
          <p className="text-gray-400 h-[70px] text-center">
            {loading ? "Đang tìm..." : "Không tìm thấy người dùng nào"}
          </p>
        )}
      </div>
    </div>
  );
};

export default FindFriend;
