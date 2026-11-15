import { BETA_SERVER_HOST } from "@/config/apiConfig";
import api from "@/lib/axios";
import { instanceAuth } from "@/lib/axios.auth";
import { instanceLocketV2 } from "@/lib/axios.locket";
import { instanceMain } from "@/lib/axios.main";
import { ValidateEmailAddress } from "../LocketServices";

//Login
export const loginWithEmail = async ({ email, password, captchaToken }) => {
  try {
    // 🚨 ĐÃ BỊT MẮT TRẠM KIỂM TRA EMAIL (Trị dứt điểm lỗi 401 từ locketcamera.com)
    /*
    const data = await ValidateEmailAddress(email);

    if (data?.result?.status === 601) {
      const err = new Error("Tài khoản với email này không tồn tại!");
      err.status = 404;
      throw err;
    }
    */

    // 👉 CHO XE CHẠY THẲNG VÀO CỔNG ĐĂNG NHẬP CỦA ANH EM MÌNH
    const res = await instanceAuth.post("locket/login", {
      email,
      password,
      captchaToken,
    });

    if (res.data?.success === false) {
      const err = new Error(res.data.message || "Đăng nhập thất bại");
      err.status = res.data.status || 400;
      throw err;
    }

    return res.data;
  } catch (error) {
    // Axios error
    if (error.response) {
      const err = new Error(
        error.response.data?.message ||
          "Đăng nhập thất bại, vui lòng thử lại"
      );
      err.status = error.response.status;
      throw err;
    }

    // Error đã được throw ở trên
    if (error instanceof Error) {
      throw error;
    }

    // Fallback
    throw new Error("Có sự cố khi kết nối đến hệ thống");
  }
};

export const loginWithPhone = async ({ phone, password, captchaToken }) => {
  try {
    const body = {
      phone,
      password,
      captchaToken,
    };
    const res = await instanceAuth.post("locket/loginWithPhoneV2", body);
    // Kiểm tra nếu API trả về lỗi nhưng vẫn có status 200
    if (res.data?.success === false) {
      console.error("Login failed:", res.data.message);
      return null;
    }

    return res.data; // Trả về dữ liệu từ server
  } catch (error) {
    if (error.response && error.response.data?.error) {
      throw error.response.data.error; // ⬅️ Ném lỗi từ `error.response.data.error`
    }
    console.error("❌ Network Error:", error.message);
    throw new Error(
      "Có sự cố khi kết nối đến hệ thống, vui lòng thử lại sau ít phút."
    );
  }
};

export const refreshIdTokenV2 = async () => {
  try {
    const res = await instanceAuth.post("locket/refresh-token");
    // Kiểm tra nếu API trả về lỗi nhưng vẫn có status 200
    if (res.data?.success === false) {
      console.error("Login failed:", res.data.message);
      return null;
    }

    return res.data.idToken; // Trả về dữ liệu từ server
  } catch (error) {
    if (error.response && error.response.data?.error) {
      throw error.response.data.error; // ⬅️ Ném lỗi từ `error.response.data.error`
    }
    console.error("❌ Network Error:", error.message);
    throw new Error(
      "Có sự cố khi kết nối đến hệ thống, vui lòng thử lại sau ít phút."
    );
  }
};

export const refreshIdToken = async (refreshToken) => {
  try {
    const res = await instanceAuth.post(
      "locket/refresh-token",
      { refreshToken },
      { withCredentials: true } // Nhận cookie từ server
    );
    // Kiểm tra nếu API trả về lỗi nhưng vẫn có status 200
    // if (res.data?.success === false) {
    //   console.error("Login failed:", res.data.message);
    //   return null;
    // }

    return res.data.idToken; // Trả về dữ liệu từ server
  } catch (error) {
    if (error.response && error.response.data?.error) {
      throw error.response.data.error; // ⬅️ Ném lỗi từ `error.response.data.error`
    }
    console.error("❌ Network Error:", error.message);
    throw new Error(
      "Có sự cố khi kết nối đến hệ thống, vui lòng thử lại sau ít phút."
    );
  }
};

export const forgotPassword = async (email) => {
  try {
    const body = { email };

    const res = await instanceMain.post(
      `${BETA_SERVER_HOST}/locket/resetPassword`,
      body
    );

    return res.data;
  } catch (error) {
    console.log(error);

    if (error.response && error.response.data?.error) {
      throw error.response.data.error; // ⬅️ Ném lỗi từ `error.response.data.error`
    }
    console.error("❌ Network Error:", error.message);
    throw new Error(
      "Có sự cố khi kết nối đến hệ thống, vui lòng thử lại sau ít phút."
    );
  }
};

//Logout
export const logout = async () => {
  try {
    const response = await instanceAuth.get("locket/logout", {});
    return response.data; // ✅ Trả về dữ liệu từ API (ví dụ: { message: "Đã đăng xuất!" })
  } catch (error) {
    console.error(
      "❌ Lỗi khi đăng xuất:",
      error.response?.data || error.message
    );
    throw error.response?.data || error.message; // ✅ Trả về lỗi nếu có
  }
};

export const GetUserData = async () => {
  try {
    const res = await api.get("/api/me");
    return res.data?.data;
  } catch (error) {
    console.error(
      "❌ Lỗi khi lấy thông tin người dùng:",
      error.response?.data || error.message
    );
    throw error.response?.data || error.message;
  }
};

export const GetUserDataV2 = async () => {
  try {
    const res = await api.get("/api/po");
    return res.data?.data;
  } catch (error) {
    console.error(
      "❌ Lỗi khi lấy thông tin người dùng:",
      error.response?.data || error.message
    );
    throw error.response?.data || error.message;
  }
};

export const GetUserLocket = async () => {
  try {
    const res = await instanceAuth.post("/locket/getInfoUser");
    return res.data?.data;
  } catch (error) {
    console.error(
      "❌ Lỗi khi lấy thông tin người dùng:",
      error.response?.data || error.message
    );
    throw error.response?.data || error.message;
  }
};

/**
 * Check VIP Status - Kiểm tra xem VIP của user còn hạn hay hết rồi
 * @returns {Object} { hasVip, isExpired, expireAt, remainingDays, planDays }
 * @throws {Error} Error object with .code property
 */
export const checkVipStatus = async () => {
  try {
    const res = await instanceMain.get("/api/check-vip");
    const data = res.data?.data;

    if (!data) {
      const error = new Error("Empty response from VIP check");
      error.code = "EMPTY_RESPONSE";
      throw error;
    }

    // Nếu không có VIP, throw error để frontend catch
    if (!data.hasVip) {
      const error = new Error(data.message || "Không có gói VIP");
      error.code = "NO_VIP_SUBSCRIPTION";
      error.data = data;
      throw error;
    }

    return data;
  } catch (error) {
    // Axios error - 403, 500, etc
    if (error.response?.status === 403) {
      const errorData = error.response.data || {};
      const customError = new Error(errorData?.message || "VIP verification failed");
      customError.code = errorData?.code || "VIP_CHECK_FAILED";
      customError.data = errorData;
      console.error("❌ VIP Check 403 Error:", { 
        code: customError.code, 
        message: customError.message 
      });
      throw customError;
    }

    // Network error, timeout, etc - throw error WITHOUT code
    // This signals to store: "couldn't verify, but not a VIP error"
    if (error.response?.status >= 500) {
      const serverError = new Error(`Server error: ${error.response.statusText}`);
      // Do NOT set .code - signal network/server issue
      serverError.isNetworkError = true;
      console.error("❌ VIP Check Server Error:", error.response.status);
      throw serverError;
    }

    // Any other error (network timeout, CORS, etc)
    if (!error.code) {
      const networkError = new Error(
        error.message || "Cannot connect to VIP service"
      );
      networkError.isNetworkError = true;
      console.warn("⚠️ VIP Check Network Error:", error.message);
      throw networkError;
    }

    // Already has .code from earlier logic
    throw error;
  }
};