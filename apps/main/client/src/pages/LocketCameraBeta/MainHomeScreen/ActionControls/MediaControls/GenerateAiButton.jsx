import { LoaderCircle } from "lucide-react";
import { useApp } from "@/context/AppContext.jsx";
import {
  aiImageResultToFile,
  generateAiFilteredImage,
} from "@/services";
import {
  SonnerError,
  SonnerSuccess,
  SonnerWarning,
} from "@/components/ui/SonnerToast";
import { useAuthStore } from "@/stores";
import AiSparkleIcon from "./AiSparkleIcon.jsx";

const errorMessage = (error) =>
  error?.response?.data?.message ||
  error?.response?.data?.error?.message ||
  error?.message ||
  "Không thể tạo ảnh AI.";

const GenerateAiButton = () => {
  const { post, useloading } = useApp();
  const accessRole = useAuthStore((state) => state.accessRole);
  const aiCredits = useAuthStore((state) => state.aiCredits);
  const decrementAiCredit = useAuthStore((state) => state.decrementAiCredit);

  const isVip = accessRole === "vip" || accessRole === "celebrity";

  const {
    selectedFile,
    selectedAiFilter,
    setSelectedAiFilter,
    setSelectedFile,
    setPreview,
    setSizeMedia,
  } = post;
  const {
    uploadLoading,
    setUploadLoading,
    isAiGenerating,
    setIsAiGenerating,
  } = useloading;

  const generate = async () => {
    if (!isVip) {
      setSelectedAiFilter(null);
      SonnerWarning("Cần nâng cấp VIP", "Tính năng AI Filter chỉ dành cho thành viên VIP.");
      return;
    }
    if ((aiCredits || 0) <= 0) {
      setSelectedAiFilter(null);
      SonnerWarning("Hết lượt tạo ảnh AI", "Vui lòng nạp thêm gói tại trang Nâng cấp để tiếp tục!");
      return;
    }
    if (!selectedFile?.type?.startsWith("image/")) {
      SonnerError("AI Filter chỉ hỗ trợ ảnh.");
      return;
    }
    if (!selectedAiFilter?.filter_id) {
      SonnerError("Bạn chưa chọn filter.");
      return;
    }

    setIsAiGenerating(true);
    setUploadLoading(true);
    try {
      const result = await generateAiFilteredImage(
        selectedFile,
        selectedAiFilter.filter_id,
      );
      const generatedFile = await aiImageResultToFile(result);
      const previewUrl = URL.createObjectURL(generatedFile);

      setSelectedFile(generatedFile);
      setPreview({ type: "image", data: previewUrl });
      setSizeMedia((generatedFile.size / (1024 * 1024)).toFixed(2));
      setSelectedAiFilter(null);

      const serverRemaining =
        typeof result?.remainingCredits === "number"
          ? result.remainingCredits
          : Math.max(0, (aiCredits || 1) - 1);

      useAuthStore.getState().setAiCredits(serverRemaining);
      SonnerSuccess("Tạo ảnh AI thành công!", `Còn lại ${serverRemaining} lượt.`);
    } catch (error) {
      if (error?.response?.data?.code === "AI_FILTER_OUT_OF_CREDITS") {
        setSelectedAiFilter(null);
        SonnerWarning("Hết lượt tạo ảnh AI", "Vui lòng nạp thêm gói tại trang Nâng cấp!");
        return;
      }
      if (error?.response?.data?.code === "AI_FILTER_VIP_REQUIRED") {
        setSelectedAiFilter(null);
        SonnerWarning("Cần nâng cấp VIP", "Tính năng AI Filter chỉ dành cho thành viên VIP.");
        return;
      }
      SonnerError("Tạo ảnh AI thất bại", errorMessage(error));
    } finally {
      setUploadLoading(false);
      setIsAiGenerating(false);
    }
  };

  return (
    <button
      type="button"
      onClick={generate}
      disabled={uploadLoading || isAiGenerating}
      aria-label="Tạo ảnh AI Filter"
      className="group relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-base-300/50 text-base-content backdrop-blur-4xl outline-base-300 transition-all duration-300 ease-out hover:scale-105 hover:border-white/40 hover:bg-base-300/70 active:scale-95 disabled:cursor-wait disabled:text-amber-500 disabled:opacity-80"
    >
      {isAiGenerating ? (
        <LoaderCircle
          size={36}
          strokeWidth={2}
          className="animate-spin text-amber-400"
          aria-hidden="true"
        />
      ) : (
        <AiSparkleIcon />
      )}
    </button>
  );
};

export default GenerateAiButton;
