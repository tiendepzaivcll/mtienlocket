import api from "@/lib/axios";

export const GetAllMoments = async ({ timestamp = null, friendId = null, limit = 60 }) => {
  try {
    const res = await api.post("/locket/getMomentV2", {
      timestamp: timestamp,
      friendId: friendId,
      limit: limit,
    });
    
    // 🚀 CHỐT HẠ: Phải trả về nguyên cục res.data (gồm cả data ảnh VÀ nextPageToken)
    if (!res?.data) {
      return { data: [], nextPageToken: null };
    }
    return res.data; 

  } catch (err) {
    console.warn("Failed", err);
    // 🚀 KHIÊN CHỐNG SẬP: Lỗi thì cũng phải trả về đúng format Object để Store không bị "mù"
    return { data: [], nextPageToken: null }; 
  }
};

export const GetInfoMoment = async (idMoment) => {
  try {
    const res = await api.post("/locket/getInfoMomentV2", {
      pageToken: null,
      // 🚀 FIX 1: Phải đổi thành momentId để khớp với Backend
      momentId: idMoment, 
      limit: null,
    });
    
    // 🚀 FIX 2: Backend trả về trực tiếp object ở res.data
    return res.data; 

  } catch (err) {
    console.warn("❌ React Failed", err);
    // 🚀 FIX 3: KHIÊN CHỐNG SẬP - Trả về object rỗng nếu API tạch
    return {}; 
  }
};