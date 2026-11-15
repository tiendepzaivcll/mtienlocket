import { BETA_SERVER_HOST } from "@/config/apiConfig";
import api from "@/libs/axios";
import { instanceAuth } from "@/libs/instanceAuth";
import { instanceLocketV2 } from "@/libs/instanceLocket";
import { instanceMain } from "@/libs/instanceMain";
//Login
export const loginWithEmail = async ({ email, password, captchaToken }) => {
  try {
    const res = await instanceAuth.post("locket/login", {
      email,
      password,
      captchaToken,
    });

    // Kiểm tra nếu API trả về lỗi nhưng vẫn có status 200
    if (res.data?.success === false) {
      console.error("Login failed:", res.data.message);
      return null;
    }

    return res.data; // Trả về dữ liệu từ server
  } catch (error) {
    if (error.response) {
      const err = new Error(
        error.response.data?.message ||
          error.response.data?.error ||
          "Đăng nhập thất bại"
      );
      err.status = error.response.status;
      throw err;
    }
    if (error.response && error.response.data?.error) {
      throw error.response.data.error; // ⬅️ Ném lỗi từ `error.response.data.error`
    }
    console.error("❌ Network Error:", error.message);
    throw new Error(
      "Có sự cố khi kết nối đến hệ thống, vui lòng thử lại sau ít phút."
    );
  }
};

export const loginWithPhone = async ({ phone, password, captchaToken }) => {
  try {
    const body = {
      email: phone,
      password,
      captchaToken,
    };
    const res = await instanceAuth.post("locket/login", body);
    // Kiểm tra nếu API trả về lỗi nhưng vẫn có status 200
    if (res.data?.success === false) {
      console.error("Login failed:", res.data.message);
      return null;
    }

    return res.data; // Trả về dữ liệu từ server
  } catch (error) {
    if (error.response) {
      const err = new Error(
        error.response.data?.message ||
          error.response.data?.error ||
          "Đăng nhập thất bại"
      );
      err.status = error.response.status;
      throw err;
    }
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
    const res = await api.get("/api/cn");
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
    const res = await instanceAuth.post("locket/getInfoUser");
    return res.data?.data;
  } catch (error) {
    console.error(
      "❌ Lỗi khi lấy thông tin người dùng:",
      error.response?.data || error.message
    );
    throw error.response?.data || error.message;
  }
};

export const checkAccessApproval = async () => {
  try {
    const res = await api.get("/api/check-access");
    return res.data?.data;
  } catch (error) {
    const err = new Error(
      error.response?.data?.message ||
        error.response?.data?.error ||
        "Tài khoản chưa được phê duyệt",
    );
    err.status = error.response?.status;
    err.code = error.response?.data?.code;
    err.data = error.response?.data?.data;
    throw err;
  }
};
