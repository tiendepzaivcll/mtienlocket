import * as utils from "@/utils";
import api from "@/libs/axios";
import { instanceLocketV2 } from "@/libs/instanceLocket";
import { chunkArray } from "@/helpers/chunkArray";
import { SonnerWarning } from "@/components/ui/SonnerToast";

//lấy toàn bộ danh sách bạn bè (uid, createdAt) từ API
export const getListIdFriends = async () => {
  try {
    const res = await api.post("locket/getAllFriendsV2");

    const allFriends = res?.data?.data || [];

    const cleanedFriends = allFriends.map((friend) => ({
      uid: friend.uid,
      createdAt: friend.createdAt ?? friend.date,
      updatedAt: friend.updatedAt ?? null,
      hidden: friend.hidden ?? false,
      sharedHistoryOn: friend.sharedHistoryOn ?? null,
      isCelebrity: friend.isCelebrity ?? false,
    }));

    return cleanedFriends;
  } catch (err) {
    console.error("❌ Lỗi khi gọi API get-friends:", err);
    return null;
  }
};

export const loadFriendDetailsV3 = async (friends) => {
  if (!friends || friends.length === 0) {
    return []; // Không fetch nếu không có bạn bè
  }

  const batchSize = 50;
  const allResults = [];

  for (let i = 0; i < friends.length; i += batchSize) {
    const batch = friends.slice(i, i + batchSize);

    try {
      const response = await api.post("locket/getFriendProfilesV2", {
        uids: batch.map((friend) => friend?.uid).filter(Boolean),
      });
      const successResults = (response?.data?.data?.users || [])
        .map(utils.normalizeFriendDataV2)
        .filter(Boolean);

      allResults.push(...successResults);

      // Nghỉ một chút nếu còn batch
      if (i + batchSize < friends.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (err) {
      console.error("❌ Lỗi khi xử lý batch:", err);
    }
  }

  return allResults;
};

//fetch dữ liệu chi tiết về user qua uid
export const fetchUser = async (user_uid) => {
  const response = await api.post("locket/getFriendProfilesV2", {
    uids: [user_uid],
  });
  const user = response?.data?.data?.users?.[0] || null;
  return {
    data: {
      result: {
        status: user ? 200 : 404,
        data: user,
      },
    },
  };
};

export const fetchUserV2 = async (user_uid) => {
  // Đợi lấy token & uid
  const body = {
    data: {
      user_uid: user_uid,
    },
  };
  const res = await instanceLocketV2.post("fetchUserV2", body);
  return res?.data?.result?.data;
};
//Tích hợp 2 hàm getListfirend và fetchuser cho thuận tiện việc lấy dữ liệu
export const refreshFriends = async () => {
  try {
    // Lấy danh sách bạn bè (uid, createdAt)
    const friends = await getListIdFriends();
    if (!friends.length) return;

    const { idToken, localId } = utils.getToken() || {};
    if (!idToken || !localId) {
      SonnerWarning("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
      return null;
    }
    const friendDetails = await loadFriendDetailsV3(friends);

    // Lưu thời gian cập nhật
    const updatedAt = new Date().toISOString();
    localStorage.setItem("friendsUpdatedAt", updatedAt);
    return {
      friends,
      friendDetails,
      updatedAt,
    };
  } catch (error) {
    console.error("❌ Lỗi khi làm mới danh sách bạn bè:", error);
    return null;
  }
};

export const getAllRequestFriend = async (pageToken = null, limit = 100) => {
  try {
    const res = await api.post("/locket/getIncomingFriendRequestsV2", {
      pageToken,
      limit,
    });

    const { success, message, data, nextPageToken } = res.data;

    if (!success) {
      return {
        friends: [],
        nextPageToken: null,
        errorMessage: message || "Lỗi khi lấy danh sách lời mời",
      };
    }

    const cleanedFriends = (data || []).map((friend) => ({
      uid: friend.uid,
      createdAt: friend.date,
    }));

    return {
      friends: cleanedFriends,
      nextPageToken: nextPageToken || null,
      errorMessage: null,
    };
  } catch (err) {
    console.error("❌ Lỗi khi gọi API getListRequestFriend:", err);
    throw err;
  }
};

export const getListRequestFriendV2 = async (pageToken = null, limit = 10) => {
  try {
    const res = await api.post("/locket/getIncomingFriendRequestsV2", {
      pageToken,
      limit,
    });

    const { success, message, data, nextPageToken } = res.data;

    if (!success) {
      return {
        friends: [],
        nextPageToken: null,
        errorMessage: message || "Lỗi khi lấy danh sách lời mời",
      };
    }

    const cleanedFriends = (data || []).map((friend) => ({
      uid: friend.uid,
      createdAt: friend.date,
    }));

    return {
      friends: cleanedFriends,
      nextPageToken: nextPageToken || null,
      errorMessage: null,
    };
  } catch (err) {
    console.error("❌ Lỗi khi gọi API getListRequestFriend:", err);

    const errorMessage =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      err.message ||
      "Lỗi không xác định";

    return {
      friends: [],
      nextPageToken: null,
      errorMessage,
    };
  }
};

export const getOutgoingRequestFriend = async (
  pageToken = null,
  limit = 100
) => {
  try {
    const res = await api.post("/locket/getOutgoingFriendRequestsV2", {
      pageToken,
      limit,
    });

    const { success, message, data, nextPageToken } = res.data;

    if (!success) {
      return {
        friends: [],
        nextPageToken: null,
        errorMessage: message || "Lỗi khi lấy danh sách lời mời",
      };
    }

    const cleanedFriends = (data || []).map((friend) => ({
      uid: friend.uid || friend.to,
      createdAt: friend.date,
    }));

    return {
      friends: cleanedFriends,
      nextPageToken: nextPageToken || null,
      errorMessage: null,
    };
  } catch (err) {
    console.error("❌ Lỗi khi gọi API getListRequestFriend:", err);

    const errorMessage =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      err.message ||
      "Lỗi không xác định";

    return {
      friends: [],
      nextPageToken: null,
      errorMessage,
    };
  }
};

export const loadFriendDetails = async (friends) => {
  // Ưu tiên lấy dữ liệu từ localStorage trước
  const savedDetails = localStorage.getItem("friendDetails");

  if (savedDetails) {
    try {
      const parsedDetails = JSON.parse(savedDetails);
      return parsedDetails;
    } catch (error) {
      console.error("❌ Parse friendDetails error:", error);
      // Tiếp tục fetch nếu lỗi
    }
  }

  if (!friends || friends.length === 0) {
    return []; // Không fetch nếu không có bạn bè
  }

  const batchSize = 10;
  const allResults = [];

  for (let i = 0; i < friends.length; i += batchSize) {
    const batch = friends.slice(i, i + batchSize);
    try {
      const results = await Promise.allSettled(
        batch.map((friend) =>
          fetchUser(friend?.uid).then((res) =>
            utils.normalizeFriendData(res.data)
          )
        )
      );

      const successResults = results
        .filter((r) => r.status === "fulfilled" && r.value)
        .map((r) => r.value);

      allResults.push(...successResults);

      if (i + batchSize < friends.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (err) {
      console.error("❌ Lỗi khi xử lý batch:", err);
    }
  }

  try {
    localStorage.setItem("friendDetails", JSON.stringify(allResults));
  } catch (error) {
    console.error("❌ Lỗi khi lưu vào localStorage:", error);
  }

  return allResults;
};

export const loadFriendDetailsV2 = async (friends) => {
  if (!friends || friends.length === 0) {
    return []; // Không fetch nếu không có bạn bè
  }

  const batchSize = 10;
  const allResults = [];

  for (let i = 0; i < friends.length; i += batchSize) {
    const batch = friends.slice(i, i + batchSize);

    try {
      const results = await Promise.allSettled(
        batch.map((friend) =>
          fetchUser(friend?.uid).then((res) =>
            utils.normalizeFriendData(res.data)
          )
        )
      );

      const successResults = results
        .filter((r) => r.status === "fulfilled" && r.value)
        .map((r) => r.value);

      allResults.push(...successResults);

      // Thêm delay nhỏ để tránh spam server nếu quá nhiều user
      if (i + batchSize < friends.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (err) {
      console.error("❌ Lỗi khi xử lý batch:", err);
    }
  }

  return allResults;
};

export const rejectMultipleFriendRequests = async (
  uidList,
  direction = "incoming",
) => {
  const combined = {
    total: 0,
    successCount: 0,
    successUidList: [],
    failures: [],
  };
  for (const uids of chunkArray(uidList, 200)) {
    const response = await api.post("/locket/deleteFriendRequestsV2", {
      uids,
      direction,
    });
    const result = response.data?.data || {};
    combined.total += Number(result.total || uids.length);
    combined.successCount += Number(result.successCount || 0);
    combined.successUidList.push(...(result.successUidList || []));
    combined.failures.push(...(result.failures || []));
  }
  return combined;
};

export const rejectFriendRequests = async (uid, direction = "outgoing") => {
  const response = await api.post("/locket/deleteFriendRequestsV2", {
    uids: [uid],
    direction,
  });
  return response.data?.data;
};

export const removeFriend = async (uid) => {
  try {
    const body = {
      data: {
        user_uid: uid,
      },
    };

    const response = await instanceLocketV2.post("removeFriend", body);
    return response.data?.result?.data?.user_uid;
  } catch (error) {
    console.error("❌ Lỗi khi xoá bạn:", error);
    throw error;
  }
};

// Chat actions use our authenticated backend, including server-managed App Check.
export const performChatFriendAction = async (action, targetUid) => {
  const response = await api.post("locket/friendAction", { action, targetUid });
  if (response.data?.data?.confirmed !== true || response.data.data.uid !== targetUid) {
    throw new Error("Locket chưa xác nhận thao tác.");
  }
  return response.data.data;
};

export const toggleHiddenFriend = async (uid) => {
  const body = {
    data: {
      user_uid: uid,
    },
  };

  const response = await instanceLocketV2.post("toggleFriendHidden", body);

  return {
    success: response.status === 200,
    uid,
  };
};

// Hàm tìm bạn qua username
export const FindFriendByUserName = async (eqfriend) => {
  try {
    const username = String(eqfriend || "").replace(/^@/, "").trim();
    const response = await api.post("locket/getUserByUsername", { username });

    return response.data;
  } catch (error) {
    console.error("❌ Lỗi khi tìm bạn:", error.response?.data || error.message);
    throw error;
  }
};

// Hàm tìm bạn qua username
export const SendRequestToFriend = async (uid) => {
  try {
    const response = await api.post(
      "/locket/sendFriendRequestV2",
      {
        data: { friendUid: uid },
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    const body = response.data || {};
    const result = body.result || body;
    if (body.success === false || result?.success === false || result?.errors?.length) {
      throw new Error(body.message || result?.message || "Locket từ chối lời mời kết bạn");
    }
    return result?.data || body.data || result;
  } catch (error) {
    console.error("❌ Lỗi khi tìm bạn:", error.response?.data || error.message);
    throw error;
  }
};

export const AcceptRequestToFriend = async (uid) => {
  try {
    const body = { data: { user_uid: uid } };

    const response = await instanceLocketV2.post("acceptFriendRequest", body);

    const acceptedUid = response?.data?.result?.data?.user_uid || uid;
    if (!acceptedUid) throw new Error("Không nhận được UID hợp lệ từ server");
    // ✅ Lấy chi tiết user từ API
    const newFriend = await fetchUserV2(acceptedUid);
    // ✅ Chuẩn hoá dữ liệu friend
    const normalized = utils.normalizeFriendDataV2(newFriend);
    // ✅ Trả về kết quả đồng nhất
    return normalized;
  } catch (error) {
    console.error(
      "❌ Lỗi khi chấp nhận lời mời:",
      error.response?.data || error.message
    );
    return null; // fallback an toàn
  }
};
