import api from "@/libs/axios";

const dataOf = (response) => response?.data?.data;

export const getSlotMonitorConfig = async () =>
  dataOf(await api.get("/api/slot-monitor/config"));

export const getSlotWatches = async () =>
  dataOf(await api.get("/api/slot-monitor/watches")) || [];

export const enableSlotMonitorSession = async (refreshToken) =>
  dataOf(await api.post("/api/slot-monitor/enable", { refreshToken }));

export const addSlotWatch = async (watch) =>
  dataOf(await api.post("/api/slot-monitor/watch", { watch }));

export const updateSlotWatch = async (uid, patch) =>
  dataOf(await api.patch(`/api/slot-monitor/watch/${encodeURIComponent(uid)}`, patch));

export const removeSlotWatch = async (uid) =>
  api.delete(`/api/slot-monitor/watch/${encodeURIComponent(uid)}`);

export const checkSlotWatchNow = async (uid) => {
  const response = await api.post(
    `/api/slot-monitor/check/${encodeURIComponent(uid)}`,
  );
  return {
    watch: response?.data?.data,
    autoRequest: response?.data?.autoRequest,
  };
};
