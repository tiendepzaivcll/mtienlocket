import React from "react";
import { useApp } from "@/context/AppContext";
import { useCameraCaptureMode } from "@/hooks/useCameraCaptureMode";
import { usePhotoboothStore } from "@/stores";
import { X } from "lucide-react";
import UploadFile from "./CameraControls/UploadFile";
import CameraButton from "./CameraControls/CameraButton";
import CameraToggle from "./CameraControls/CameraToggle";

import SendButton from "./MediaControls/SendButton";
import DelButton from "./MediaControls/DelButton";
import OverlayButton from "./MediaControls/OverlayButton";
import GenerateAiButton from "./MediaControls/GenerateAiButton";

const ActionControls = () => {
  const { post } = useApp();
  const { selectedFile, selectedAiFilter } = post;
  const { showPhotobooth, chooseCaptureMode } = useCameraCaptureMode();
  const clearPhotos = usePhotoboothStore((state) => state.clearPhotos);

  const hasFile = !!selectedFile;
  const shouldGenerateAiImage =
    Boolean(selectedAiFilter) && selectedFile?.type?.startsWith("image/");

  const baseBtn =
    "transition-all duration-300 ease-in-out transform active:scale-95";

  const showClass = "opacity-100 scale-100";
  const hideClass = "opacity-0 pointer-events-none absolute";

  const hideMainClass = "opacity-0 scale-75 pointer-events-none absolute";

  const handleCancelPhotobooth = () => {
    clearPhotos();
    chooseCaptureMode(false);
  };

  return (
    <div className="relative flex justify-between items-center w-full px-0">
      {/* SLOT 1 */}
      <div className="relative flex items-center justify-center w-[44px] h-[44px]">
        {showPhotobooth && !hasFile ? (
          <button
            type="button"
            onClick={handleCancelPhotobooth}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface-pill)] text-[var(--text-primary)] border border-[var(--border-subtle)] shadow-lg backdrop-blur-md transition active:scale-90 hover:opacity-80"
            aria-label="Thoát Photobooth"
            title="Thoát Photobooth"
          >
            <X size={24} />
          </button>
        ) : (
          <>
            {/* Upload */}
            <div className={`${baseBtn} ${!hasFile ? showClass : hideClass}`}>
              <UploadFile />
            </div>

            {/* Delete */}
            <div className={`${baseBtn} ${hasFile ? showClass : hideClass}`}>
              <DelButton />
            </div>
          </>
        )}
      </div>

      {/* SLOT 2 (Center main button) */}
      <div className="relative flex items-center justify-center">
        {/* Camera */}
        <div className={`${baseBtn} ${!hasFile ? showClass : hideMainClass}`}>
          <CameraButton />
        </div>

        {/* Send */}
        <div className={`${baseBtn} ${hasFile ? showClass : hideMainClass}`}>
          {shouldGenerateAiImage ? <GenerateAiButton /> : <SendButton />}
        </div>
      </div>

      {/* SLOT 3 */}
      <div className="relative flex items-center justify-center w-[44px] h-[44px]">
        {/* Toggle camera */}
        <div className={`${baseBtn} ${!hasFile ? showClass : hideClass}`}>
          <CameraToggle />
        </div>

        {/* Overlay */}
        <div className={`${baseBtn} ${hasFile ? showClass : hideClass}`}>
          <OverlayButton />
        </div>
      </div>
    </div>
  );
};

export default ActionControls;
