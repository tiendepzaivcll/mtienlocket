import { CONFIG } from "@/config";
import { useAuthStore } from "@/stores/AuthStore";

export const FULL_ACCESS_LIMITS = {
  maxImageSizeMB: 1024,
  maxVideoSizeMB: 1024,
  storage_limit_mb: -1,
  video_record_max_length: CONFIG.app.camera.limits.maxRecordTime,
};

export const useFeatureVisible = (feature) => {
  const accessRole = useAuthStore((state) => state.accessRole);
  return accessRole === "vip" || feature === "celebrity_tool";
};

export const useGetCode = () => "T97-FULL";

export const getMaxUploads = () => ({
  maxImageSizeMB: FULL_ACCESS_LIMITS.maxImageSizeMB,
  maxVideoSizeMB: FULL_ACCESS_LIMITS.maxVideoSizeMB,
  storage_limit_mb: FULL_ACCESS_LIMITS.storage_limit_mb,
});

export const getVideoRecordLimit = () =>
  FULL_ACCESS_LIMITS.video_record_max_length;
