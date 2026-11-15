import api from "@/libs/axios";

export const resolveCelebrityProfile = async (profile) => {
  const response = await api.post("/locket/resolveCelebrityProfile", {
    data: { profile },
  });
  return response?.data?.data || null;
};

export const SendRequestToCelebrity = async (uid, { waitForSlot = false } = {}) => {
  try {
    const response = await api.post("/locket/sendCelebrityRequestV2", {
      data: { friendUid: uid, waitForSlot },
    });
    return response?.data;
  } catch (error) {
    console.error("❌ Lỗi khi tìm bạn:", error.response?.data || error.message);
    throw error;
  }
};
