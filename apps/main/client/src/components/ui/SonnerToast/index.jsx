import { toast } from "sonner";
import { toDisplayMessage } from "@/utils";

// Base toast
function showToast(type, message, body = "", options = {}) {
  const safeMessage = toDisplayMessage(message, "Thông báo");
  const safeBody = toDisplayMessage(body, "");
  const safeOptions = { ...options };

  if (safeOptions.description) {
    safeOptions.description = toDisplayMessage(safeOptions.description, "");
  }

  const baseConfig = {
    position: "top-center",
    richColors: true,
    dismissible: true, // click vào toast sẽ đóng
    duration: 4000,
    description: safeBody || safeOptions.description || undefined, // body sẽ hiển thị dưới message
    closeButton: false,
    ...safeOptions,
  };

  switch (type) {
    case "success":
      toast.success(safeMessage, baseConfig);
      break;
    case "error":
      toast.error(safeMessage, {
        ...baseConfig,
        duration: 5000,
      });
      break;
    case "warning":
      toast.warning(safeMessage, {
        ...baseConfig,
        duration: 3500,
        // closeButton: true,
      });
      break;
    case "info":
      toast.info(safeMessage, {
        ...baseConfig,
        duration: 3000,
      });
      break;
    default:
      toast(safeMessage, baseConfig);
  }
}

// Export helpers
export const SonnerSuccess = (msg, body = "", opt) => showToast("success", msg, body, opt);
export const SonnerError   = (msg, body = "", opt) => showToast("error", msg, body, opt);
export const SonnerWarning = (msg, body = "", opt) => showToast("warning", msg, body, opt);
export const SonnerInfo    = (msg, body = "", opt) => showToast("info", msg, body, opt);
export const SonnerDismiss = (id) => (id !== undefined ? toast.dismiss(id) : toast.dismiss());
export { toast };
