import { useSearchParams, useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { usePostStore, useAuthStore } from "@/stores";
import { PHOTOBOOTH_FRAMES } from "@/data/photoboothFrames";
import { SonnerWarning } from "@/components/ui/SonnerToast";

// Both camera and Filter Studio use the same draft guards and URL selection.
export function useCameraCaptureMode() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { post, camera, useloading } = useApp();
  const accessRole = useAuthStore((state) => state.accessRole);
  const isVip = accessRole === "vip";
  const hasRestoreSelection = usePostStore((state) => Boolean(state.restoreFlow.selectedDate));
  const mediaIsLocked = Boolean(
    post.selectedFile || post.imageToCrop || post.videoCrop ||
    typeof post.selectedQueue === "number" || post.selectedQueue || hasRestoreSelection ||
    camera.isHolding || useloading.sendLoading || useloading.uploadLoading || useloading.isAiGenerating
  );
  const selectedFrameId = PHOTOBOOTH_FRAMES.some((frame) => frame.id === searchParams.get("frame"))
    ? searchParams.get("frame") : "none";
  // Photobooth chỉ dành cho VIP
  const showPhotobooth = isVip && searchParams.get("camera") === "photobooth" && !mediaIsLocked;
  const chooseCaptureMode = (photobooth, frameId = "none") => {
    if (mediaIsLocked) return false;
    if (photobooth && !isVip) {
      SonnerWarning("Photobooth là tính năng VIP. Nâng cấp để sử dụng!");
      navigate("/pricing");
      return false;
    }
    const next = new URLSearchParams(searchParams);
    if (photobooth) {
      next.set("camera", "photobooth");
      next.set("frame", PHOTOBOOTH_FRAMES.some((frame) => frame.id === frameId) ? frameId : "none");
    } else {
      next.delete("camera");
      next.delete("frame");
    }
    setSearchParams(next, { replace: true });
    return true;
  };
  return { showPhotobooth, selectedFrameId, mediaIsLocked, chooseCaptureMode, isVip };
}
