import React, { useState, useEffect } from "react";
import { SonnerError } from "@/components/ui/SonnerToast";

/**
 * Modal hiển thị khi VIP hết hạn hoặc không có
 */
export const VipExpiryModal = ({ 
  isOpen = false, 
  reason = "VIP_EXPIRED", 
  onConfirm = () => {} 
}) => {
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleLogout = async () => {
    setIsLoading(true);
    onConfirm();
  };

  const getMessage = () => {
    switch (reason) {
      case "VIP_EXPIRED":
        return {
          title: "🔐 Gói VIP Đã Hết Hạn",
          message: "Gói VIP của bạn đã hết hạn. Vui lòng gia hạn để tiếp tục sử dụng các tính năng VIP.",
        };
      case "NO_VIP_SUBSCRIPTION":
        return {
          title: "❌ Không Tìm Thấy Gói VIP",
          message: "Tài khoản của bạn không có gói VIP hoặc không được tìm thấy trong hệ thống.",
        };
      case "VIP_UID_MISMATCH":
        return {
          title: "⚠️ Tài Khoản Không Khớp",
          message: "Locket ID của bạn không khớp với dữ liệu VIP đã lưu. Vui lòng đăng nhập lại bằng tài khoản chính xác.",
        };
      case "VIP_DELETED":
        return {
          title: "🗑️ Gói VIP Đã Bị Xóa",
          message: "Gói VIP của bạn đã bị xóa khỏi hệ thống. Vui lòng liên hệ hỗ trợ để biết thêm chi tiết.",
        };
      default:
        return {
          title: "⚠️ Lỗi Xác Thực",
          message: "Có lỗi xảy ra. Vui lòng đăng nhập lại.",
        };
    }
  };

  const { title, message } = getMessage();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        {/* Header */}
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {title}
          </h2>
        </div>

        {/* Message */}
        <div className="mb-6">
          <p className="text-gray-600 dark:text-gray-300 text-sm">
            {message}
          </p>
        </div>

        {/* Footer */}
        <div className="flex gap-3">
          <button
            onClick={handleLogout}
            disabled={isLoading}
            className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-red-400 text-white font-semibold py-2 px-4 rounded-lg transition"
          >
            {isLoading ? "Đang xử lý..." : "Đăng Xuất"}
          </button>
        </div>

        {/* Note */}
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
          Bạn sẽ được chuyển hướng đến trang đăng nhập
        </p>
      </div>
    </div>
  );
};
