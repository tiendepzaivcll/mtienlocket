import React from "react";
import { TbMoodCrazyHappy } from "react-icons/tb";
import { RiEmotionHappyLine } from "react-icons/ri";
import { useApp } from "@/context/AppContext";
import { getMaxUploads } from "@/hooks/useFeature";

const MediaSizeInfo = () => {
  const { post } = useApp();
  const { preview, isSizeMedia, imageToCrop, selectedFile } = post;
  const { maxImageSizeMB, maxVideoSizeMB } = getMaxUploads();
  
  // Show size if preview exists OR if file is being processed (imageToCrop or selectedFile)
  const hasMedia = preview?.type || imageToCrop || selectedFile;
  const isImage = preview?.type === "image" || (imageToCrop && !preview?.type) || (selectedFile && selectedFile.type?.startsWith("image/"));
  const isVideo = preview?.type === "video" || (selectedFile && selectedFile.type?.startsWith("video/"));
  
  // Convert to number for proper comparison
  const size = isSizeMedia ? parseFloat(isSizeMedia) : 0;
  const isTooBig = isImage
    ? size > maxImageSizeMB
    : isVideo
    ? size > maxVideoSizeMB
    : false;
  const colorClass = isTooBig ? "text-red-500" : "text-green-500";

  return (
    <div className="transition-opacity duration-300 ease-in-out py-2">
      {hasMedia && isSizeMedia ? (
        <div className={`text-sm flex items-center justify-center gap-1.5 ${colorClass}`}>
          Dung lượng {isImage ? "ảnh" : "video"} là{" "}
          <span className="font-semibold underline">{isSizeMedia} MB</span>
          {isTooBig ? (
            <TbMoodCrazyHappy className="text-lg" />
          ) : (
            <RiEmotionHappyLine className="text-lg" />
          )}
        </div>
      ) : null}
    </div>
  );
};

export default MediaSizeInfo;
