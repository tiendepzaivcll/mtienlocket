import axios from "axios";
import { CONFIG } from "@/config";

const ADMIN_TOKEN_KEY = "t97_admin_token";

const adminApi = axios.create({
  baseURL: `${CONFIG.api.baseUrl}/admin`,
  timeout: 35000,
});

adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const getAdminToken = () => localStorage.getItem(ADMIN_TOKEN_KEY);
export const getAppCheckSettings = async () => (await adminApi.get("/app-check")).data.data;
export const saveAppCheckSettings = async (data) => (await adminApi.put("/app-check", data)).data.data;
export const checkAppCheckSettings = async () => (await adminApi.post("/app-check/check")).data;
export const getAiFilterSettings = async () => (await adminApi.get("/ai-filter")).data.data;
export const saveAiFilterSettings = async (modelId) => (
  await adminApi.put("/ai-filter", { modelId })
).data;
export const listCaptionPresets = async () => (await adminApi.get("/caption-presets")).data.data || [];
export const saveCaptionPreset = async (data) => (await adminApi.put("/caption-presets", data)).data.data;
export const deleteCaptionPreset = async (sectionId, presetId) => (
  await adminApi.delete(`/caption-presets/${encodeURIComponent(presetId)}`, {
    params: { section: sectionId },
  })
).data.data;

export const adminLogin = async (password) => {
  const res = await adminApi.post("/login", { password });
  const token = res.data?.token;
  if (token) {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
  }
  return res.data;
};

export const adminLogout = () => {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
};

export const listApprovedUsers = async () => {
  const res = await adminApi.get("/approved-users");
  return res.data?.data || [];
};

export const addApprovedUser = async ({
  username,
  note,
  role,
  vipPlanId,
  planDays,
  aiFilterEnabled,
  aiFilterPlanId,
  aiFilterPlanDays,
}) => {
  const res = await adminApi.post("/approved-users", {
    username,
    note,
    role,
    vipPlanId,
    planDays,
    aiFilterEnabled,
    aiFilterPlanId,
    aiFilterPlanDays,
  });
  return res.data?.data;
};

export const updateApprovedUser = async (username, data) => {
  const res = await adminApi.patch(`/approved-users/${encodeURIComponent(username)}`, data);
  return res.data;
};

export const deleteApprovedUser = async (username) => {
  const res = await adminApi.delete(`/approved-users/${encodeURIComponent(username)}`);
  return res.data;
};

export const listAdminNotifications = async () => {
  const response = await adminApi.get("/notifications");
  if (!Array.isArray(response.data?.data)) {
    throw new Error("Máy chủ trả về danh sách thông báo không hợp lệ.");
  }
  return response.data.data;
};

const readAdminNotification = (response) => {
  const item = response.data?.data;
  if (!item || typeof item.id !== "string" || !item.id ||
      typeof item.title !== "string" || typeof item.message !== "string") {
    throw new Error("Máy chủ trả về thông báo không hợp lệ. Hãy tải lại danh sách để kiểm tra.");
  }
  return item;
};

export const createAdminNotification = async (data) => {
  const response = await adminApi.post("/notifications", data);
  return readAdminNotification(response);
};

export const updateAdminNotification = async (id, data) => {
  const response = await adminApi.patch(`/notifications/${encodeURIComponent(id)}`, data);
  return readAdminNotification(response);
};

export const deleteAdminNotification = async (id) => {
  const response = await adminApi.delete(`/notifications/${encodeURIComponent(id)}`);
  return response.data;
};

// === Payment Management ===
export const listPaymentOrders = async () => {
  const res = await adminApi.get("/payment-orders");
  return res.data?.data || [];
};

export const listAdminSubscriptions = async () => {
  const res = await adminApi.get("/subscriptions");
  return res.data?.data || [];
};
