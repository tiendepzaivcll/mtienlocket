import { useSearchParams } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { usePostStore } from "@/stores";
import { PHOTOBOOTH_FRAMES } from "@/data/photoboothFrames";

// Both camera and Filter Studio use the same draft guards and URL selection.
export function useCameraCaptureMode() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { post, camera, useloading } = useApp();
  const hasRestoreSelection = usePostStore((state) => Boolean(state.restoreFlow.selectedDate));
  const mediaIsLocked = Boolean(
    post.selectedFile || post.imageToCrop || post.videoCrop ||
    typeof post.selectedQueue === "number" || post.selectedQueue || hasRestoreSelection ||
    camera.isHolding || useloading.sendLoading || useloading.uploadLoading || useloading.isAiGenerating
  );
  const selectedFrameId = PHOTOBOOTH_FRAMES.some((frame) => frame.id === searchParams.get("frame"))
    ? searchParams.get("frame") : "none";
  const showPhotobooth = searchParams.get("camera") === "photobooth" && !mediaIsLocked;
  const chooseCaptureMode = (photobooth, frameId = "none") => {
    if (mediaIsLocked) return false;
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
  return { showPhotobooth, selectedFrameId, mediaIsLocked, chooseCaptureMode };
}
