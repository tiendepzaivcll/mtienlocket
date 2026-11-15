import { PUBLIC_API } from "@/config/apiConfig";
import { instanceBaseData } from "@/lib/axios.data";

/**
 * Lấy danh sách hoặc chi tiết bài viết.
 * @param {string} [slug] - slug của bài viết (nếu có).
 */
export const getListNewFeeds = async (slug) => {
  try {
    const url = slug ? `${PUBLIC_API.feeds}?slug=${slug}` : PUBLIC_API.feeds;
    const res = await instanceBaseData.get(url);

    if (!res?.data) {
      console.error("❌ Không có dữ liệu hợp lệ", res?.data);
      return slug ? null : []; // Chi tiết thì null, danh sách thì mảng rỗng
    }

    if (!slug && Array.isArray(res.data)) {
      return [...res.data].sort(
        (a, b) => new Date(b.published_at) - new Date(a.published_at)
      );
    }

    return res.data;
  } catch (error) {
    console.error("🚨 Lỗi khi gọi API getListNewFeeds:", error.message);
    return slug ? null : [];
  }
};

export const getListDonates = async () => {
  try {
    const res = await instanceBaseData.get(PUBLIC_API.donations);
    return res.data || [];
  } catch (error) {
    console.error("🚨 Lỗi khi gọi API getListDonates:", error.message);
    return [];
  }
};

export const getListIncidents = async () => {
  try {
    const res = await instanceBaseData.get(PUBLIC_API.incidents);
    return res.data || [];
  } catch (error) {
    console.error("🚨 Lỗi khi gọi API getListIncidents:", error.message);
    return [];
  }
};

export const getAllTimelines = async () => {
  try {
    const res = await instanceBaseData.get(PUBLIC_API.timelines);
    return res.data || [];
  } catch (error) {
    console.error("🚨 Lỗi khi gọi API getAllTimelines:", error.message);
    return [];
  }
};

export const getAllFrameCamera = async () => {
  try {
    const res = await instanceBaseData.get(PUBLIC_API.frames);
    return res.data || [];
  } catch (error) {
    console.error("🚨 Lỗi khi gọi API getAllFrameCamera:", error.message);
    return [];
  }
};

export const getAllBackgroundCamera = async () => {
  try {
    const res = await instanceBaseData.get(PUBLIC_API.backgroundList);
    return res.data || [];
  } catch (error) {
    console.error("🚨 Lỗi khi gọi API getAllBackgroundCamera:", error.message);
    return [];
  }
};

export const getListCelebrity = async () => {
  try {
    const res = await instanceBaseData.get(PUBLIC_API.celebrates);
    return res.data || [];
  } catch (error) {
    console.error("🚨 Lỗi khi gọi API getListCelebrity:", error.message);
    return [];
  }
};

export const getNotifications = async () => {
  try {
    const res = await instanceBaseData.get(PUBLIC_API.notifications);
    return res.data || []; // Fix trả về data thay vì nguyên cục response
  } catch (error) {
    console.error("🚨 Lỗi khi gọi API getNotifications:", error.message);
    return [];
  }
};

export const GetListInfoPlans = async () => {
  try {
    const response = await instanceBaseData.get(PUBLIC_API.plans);
    return response.data || [];
  } catch (error) {
    console.error("🚨 Error fetching upload stats:", error);
    return [];
  }
};

export const GetInfoPlanWithId = async (planId) => {
  try {
    const url = `${PUBLIC_API.plans}/${planId}`;
    const response = await instanceBaseData.get(url);
    return response.data;
  } catch (error) {
    console.error("🚨 Lỗi khi gọi API GetInfoPlanWithId:", error);
    return null; // Trả về 1 object chi tiết nên lỗi thì return null
  }
};

// 🚀 ĐÂY LÀ CHỖ CHỐT HẠ BỆNH CŨ (Trị dứt điểm lỗi Cannot read properties of null)
export const getAllOverlayCaption = async () => {
  try {
    const res = await instanceBaseData.get(PUBLIC_API.themes);
    if (!res?.data) {
      console.error("❌ Không có dữ liệu hợp lệ", res?.data);
      return []; // Tuyệt đối không return null ở đây
    }
    // Trả về data, nếu API bọc thêm 1 lớp data nữa thì lấy res.data.data
    return res.data?.data || res.data || []; 
  } catch (error) {
    console.error("🚨 Lỗi khi gọi API getAllOverlayCaption:", error.message);
    return []; // Lỗi 404 cũng trả mảng rỗng cho App.jsx sống sót
  }
};

export const getAllCollections = async () => {
  try {
    const res = await instanceBaseData.get(PUBLIC_API.collection);
    if (!res?.data) {
      console.error("❌ Không có dữ liệu hợp lệ", res?.data);
      return [];
    }
    return res.data;
  } catch (error) {
    console.error("🚨 Lỗi khi gọi API getAllCollections:", error.message);
    return [];
  }
};