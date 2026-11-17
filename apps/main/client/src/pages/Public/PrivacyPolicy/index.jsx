import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  Globe,
  Lock,
  Camera,
  Eye,
  Database,
  Cookie,
  UserCheck,
  Mail,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { useAuthStore } from "@/stores";

export default function PrivacyPolicy() {
  const user = useAuthStore((state) => state.user);
  const [lang, setLang] = useState(() => {
    return localStorage.getItem("privacy_lang") || "vi";
  });

  const switchLang = (newLang) => {
    setLang(newLang);
    localStorage.setItem("privacy_lang", newLang);
  };

  const isVi = lang === "vi";

  return (
    <div className="min-h-screen bg-base-100 text-base-content py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation & Language Switcher Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-base-300">
          <Link
            to={user ? "/locket-beta" : "/"}
            className="inline-flex items-center gap-2 text-sm font-medium text-base-content/75 hover:text-primary transition"
          >
            <ArrowLeft size={18} />
            <span>{isVi ? "Quay lại" : "Back"}</span>
          </Link>

          {/* Toggle 2 ngôn ngữ */}
          <div className="inline-flex items-center p-1 bg-base-200 rounded-full border border-base-300 shadow-sm">
            <button
              type="button"
              onClick={() => switchLang("vi")}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold transition ${
                isVi
                  ? "bg-primary text-primary-content shadow-sm"
                  : "text-base-content/70 hover:text-base-content"
              }`}
            >
              <span className="text-sm">🇻🇳</span>
              <span>Tiếng Việt</span>
            </button>
            <button
              type="button"
              onClick={() => switchLang("en")}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold transition ${
                !isVi
                  ? "bg-primary text-primary-content shadow-sm"
                  : "text-base-content/70 hover:text-base-content"
              }`}
            >
              <span className="text-sm">🇺🇸</span>
              <span>English</span>
            </button>
          </div>
        </div>

        {/* Hero Header Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/15 via-base-200 to-base-300/60 border border-primary/20 p-6 sm:p-8 shadow-lg">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary shadow-inner">
              <ShieldCheck size={26} />
            </div>
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-semibold bg-primary/20 text-primary uppercase tracking-wider">
                <Sparkles size={11} />
                {isVi ? "Bảo Mật & Riêng Tư" : "Privacy & Security"}
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1">
                {isVi ? "Chính Sách Bảo Mật" : "Privacy Policy"}
              </h1>
            </div>
          </div>
          <p className="text-sm text-base-content/80 max-w-2xl leading-relaxed">
            {isVi
              ? "Cam kết tôn trọng và bảo vệ tuyệt đối thông tin cá nhân, hình ảnh và khoảnh khắc kết nối của bạn khi trải nghiệm Locket Web."
              : "Our commitment to respecting and strictly protecting your personal data, photos, and private moments when using Locket Web."}
          </p>
          <div className="mt-4 pt-3 border-t border-base-content/10 flex items-center gap-2 text-xs text-base-content/60">
            <Globe size={13} />
            <span>
              {isVi
                ? "Cập nhật lần cuối: Tháng 11, 2026 • Phiên bản 2.5"
                : "Last updated: November 2026 • Version 2.5"}
            </span>
          </div>
        </div>

        {/* Policy Content Sections */}
        {isVi ? (
          /* ================= TIẾNG VIỆT ================= */
          <div className="space-y-6 text-sm leading-relaxed">
            {/* Mục 1 */}
            <div className="bg-base-200/50 rounded-2xl p-6 border border-base-300 shadow-sm space-y-3">
              <div className="flex items-center gap-2.5 text-base font-bold text-primary">
                <Lock size={19} />
                <h2>1. Giới thiệu & Cam kết bảo mật</h2>
              </div>
              <p>
                Chào mừng bạn đến với <strong>LOCKET-PRO</strong>. Chúng tôi hiểu rằng những bức ảnh, video ngắn và tin nhắn bạn chia sẻ qua Locket là những khoảnh khắc quý báu dành riêng cho bạn và bạn bè thân thiết.
              </p>
              <p>
                Chính sách này giải thích minh bạch cách chúng tôi tiếp nhận, xử lý và bảo vệ dữ liệu khi bạn sử dụng dịch vụ trên trình duyệt web và thiết bị di động.
              </p>
            </div>

            {/* Mục 2 */}
            <div className="bg-base-200/50 rounded-2xl p-6 border border-base-300 shadow-sm space-y-3">
              <div className="flex items-center gap-2.5 text-base font-bold text-primary">
                <Database size={19} />
                <h2>2. Thông tin chúng tôi thu thập</h2>
              </div>
              <ul className="space-y-2 list-none pl-1">
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-success shrink-0 mt-0.5" />
                  <span>
                    <strong>Thông tin tài khoản:</strong> Tên hiển thị, username, ảnh đại diện và mã định danh người dùng (UID) để đồng bộ trải nghiệm Locket.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-success shrink-0 mt-0.5" />
                  <span>
                    <strong>Khoảnh khắc (Ảnh & Video):</strong> Các tệp hình ảnh, video bạn chụp hoặc đăng tải để gửi đến danh sách bạn bè đã chọn.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-success shrink-0 mt-0.5" />
                  <span>
                    <strong>Dữ liệu kỹ thuật & thiết bị:</strong> Loại thiết bị, hệ điều hành, khả năng zoom và đèn flash của camera nhằm tối ưu hiển thị khung hình và tốc độ tải.
                  </span>
                </li>
              </ul>
            </div>

            {/* Mục 3 */}
            <div className="bg-base-200/50 rounded-2xl p-6 border border-base-300 shadow-sm space-y-3">
              <div className="flex items-center gap-2.5 text-base font-bold text-primary">
                <Camera size={19} />
                <h2>3. Quyền truy cập thiết bị (Camera & Micro)</h2>
              </div>
              <p>
                Để cung cấp đầy đủ trải nghiệm chụp ảnh, photobooth và quay video Locket:
              </p>
              <ul className="space-y-1.5 list-disc pl-5 text-base-content/85">
                <li>
                  <strong>Quyền Camera:</strong> Chỉ được kích hoạt khi bạn ở giao diện chụp ảnh/video. Ứng dụng không bao giờ truy cập camera ngầm khi bạn rời khỏi trang.
                </li>
                <li>
                  <strong>Quyền Microphone:</strong> Dùng để ghi âm thanh cho video 15s. Bạn hoàn toàn có thể bật/tắt quyền micro bất cứ lúc nào qua nút mic trực tiếp trên màn hình camera.
                </li>
              </ul>
            </div>

            {/* Mục 4 */}
            <div className="bg-base-200/50 rounded-2xl p-6 border border-base-300 shadow-sm space-y-3">
              <div className="flex items-center gap-2.5 text-base font-bold text-primary">
                <Eye size={19} />
                <h2>4. Quyền riêng tư & Quản lý trạng thái xem</h2>
              </div>
              <p>
                Bạn có toàn quyền kiểm soát người nhận cho từng khoảnh khắc (Gửi tất cả, Riêng tư, hoặc chọn từng bạn bè cụ thể).
              </p>
              <p>
                Ngoài ra, tính năng <em>"Trạng thái xem Moments"</em> trong mục Cài đặt cho phép bạn tùy ý bật hoặc tắt việc hiển thị cho người khác biết bạn đã xem ảnh của họ.
              </p>
            </div>

            {/* Mục 5 */}
            <div className="bg-base-200/50 rounded-2xl p-6 border border-base-300 shadow-sm space-y-3">
              <div className="flex items-center gap-2.5 text-base font-bold text-primary">
                <Cookie size={19} />
                <h2>5. Bộ nhớ cục bộ & Lưu trữ phiên (Local Storage)</h2>
              </div>
              <p>
                Chúng tôi sử dụng <code>localStorage</code> và <code>IndexedDB</code> ngay trên trình duyệt của bạn để:
              </p>
              <ul className="space-y-1.5 list-disc pl-5 text-base-content/85">
                <li>Ghi nhớ tùy chọn giao diện, bộ lọc và chủ đề màu sắc bạn yêu thích.</li>
                <li>Lưu bộ đệm tạm thời ảnh và danh sách bạn bè giúp ứng dụng tải nhanh mượt mà.</li>
                <li>
                  Bạn có thể chủ động xóa sạch toàn bộ dữ liệu này bất cứ lúc nào bằng nút <strong>"Xoá toàn bộ dữ liệu trên trình duyệt"</strong> trong menu cài đặt.
                </li>
              </ul>
            </div>

            {/* Mục 6 */}
            <div className="bg-base-200/50 rounded-2xl p-6 border border-base-300 shadow-sm space-y-3">
              <div className="flex items-center gap-2.5 text-base font-bold text-primary">
                <UserCheck size={19} />
                <h2>6. Quyền của bạn & Xóa tài khoản</h2>
              </div>
              <p>
                Bạn sở hữu toàn quyền đối với dữ liệu của mình. Khi đăng xuất, toàn bộ thông tin phiên làm việc cục bộ được xóa ngay lập tức và đưa bạn về màn hình đăng nhập.
              </p>
            </div>

            {/* Mục 7 */}
            <div className="bg-base-200/50 rounded-2xl p-6 border border-base-300 shadow-sm space-y-3">
              <div className="flex items-center gap-2.5 text-base font-bold text-primary">
                <Mail size={19} />
                <h2>7. Liên hệ phản hồi</h2>
              </div>
              <p>
                Nếu bạn có bất kỳ thắc mắc, đề xuất hoặc phản hồi nào liên quan đến quyền riêng tư, vui lòng liên hệ với chúng tôi qua trang{" "}
                <Link to="/contact" className="text-primary font-semibold underline">
                  Liên hệ hỗ trợ
                </Link>
                .
              </p>
            </div>
          </div>
        ) : (
          /* ================= ENGLISH ================= */
          <div className="space-y-6 text-sm leading-relaxed">
            {/* Section 1 */}
            <div className="bg-base-200/50 rounded-2xl p-6 border border-base-300 shadow-sm space-y-3">
              <div className="flex items-center gap-2.5 text-base font-bold text-primary">
                <Lock size={19} />
                <h2>1. Introduction & Privacy Commitment</h2>
              </div>
              <p>
                Welcome to <strong>LOCKET-PRO</strong>. We recognize that the photos, short videos, and messages you share on Locket represent intimate moments intended exclusively for you and your trusted friends.
              </p>
              <p>
                This policy outlines transparently how we collect, process, and safeguard your personal information when using our web application across devices.
              </p>
            </div>

            {/* Section 2 */}
            <div className="bg-base-200/50 rounded-2xl p-6 border border-base-300 shadow-sm space-y-3">
              <div className="flex items-center gap-2.5 text-base font-bold text-primary">
                <Database size={19} />
                <h2>2. Information We Collect</h2>
              </div>
              <ul className="space-y-2 list-none pl-1">
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-success shrink-0 mt-0.5" />
                  <span>
                    <strong>Account Details:</strong> Display name, username, avatar, and user identifier (UID) required to sync your Locket experience.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-success shrink-0 mt-0.5" />
                  <span>
                    <strong>Moments (Photos & Videos):</strong> Media files captured or uploaded by you to share with your designated friends.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-success shrink-0 mt-0.5" />
                  <span>
                    <strong>Device & Technical Data:</strong> Browser environment, camera capabilities (zoom range, hardware flash support) to ensure optimal capture performance.
                  </span>
                </li>
              </ul>
            </div>

            {/* Section 3 */}
            <div className="bg-base-200/50 rounded-2xl p-6 border border-base-300 shadow-sm space-y-3">
              <div className="flex items-center gap-2.5 text-base font-bold text-primary">
                <Camera size={19} />
                <h2>3. Hardware Access (Camera & Microphone)</h2>
              </div>
              <p>
                To provide camera capture, photobooth, and video recording features:
              </p>
              <ul className="space-y-1.5 list-disc pl-5 text-base-content/85">
                <li>
                  <strong>Camera Permission:</strong> Only active when you are on the camera screen. The application never accesses your camera in the background.
                </li>
                <li>
                  <strong>Microphone Permission:</strong> Used to capture clear audio for 15-second videos. You can toggle audio on or off anytime via the mic button on the camera viewfinder.
                </li>
              </ul>
            </div>

            {/* Section 4 */}
            <div className="bg-base-200/50 rounded-2xl p-6 border border-base-300 shadow-sm space-y-3">
              <div className="flex items-center gap-2.5 text-base font-bold text-primary">
                <Eye size={19} />
                <h2>4. Privacy & Read Receipts Control</h2>
              </div>
              <p>
                You retain full control over the recipients of each moment (All friends, Private, or selected individuals).
              </p>
              <p>
                Furthermore, the <em>"Moment Seen Status"</em> toggle in Settings allows you to enable or disable whether other users can see that you have viewed their moments.
              </p>
            </div>

            {/* Section 5 */}
            <div className="bg-base-200/50 rounded-2xl p-6 border border-base-300 shadow-sm space-y-3">
              <div className="flex items-center gap-2.5 text-base font-bold text-primary">
                <Cookie size={19} />
                <h2>5. Local Storage & Session Data</h2>
              </div>
              <p>
                We utilize <code>localStorage</code> and client-side <code>IndexedDB</code> on your device to:
              </p>
              <ul className="space-y-1.5 list-disc pl-5 text-base-content/85">
                <li>Persist your chosen theme, overlay preferences, and flash preferences.</li>
                <li>Cache media thumbnails and friend lists locally for instant loading.</li>
                <li>
                  You can purge all stored browser data at any time via the <strong>"Clear all browser data"</strong> option in your settings sheet.
                </li>
              </ul>
            </div>

            {/* Section 6 */}
            <div className="bg-base-200/50 rounded-2xl p-6 border border-base-300 shadow-sm space-y-3">
              <div className="flex items-center gap-2.5 text-base font-bold text-primary">
                <UserCheck size={19} />
                <h2>6. Your Rights & Logout Behavior</h2>
              </div>
              <p>
                You maintain complete ownership of your data. When logging out, all active session tokens and local credentials are immediately cleared, and you are directed straight to the login screen.
              </p>
            </div>

            {/* Section 7 */}
            <div className="bg-base-200/50 rounded-2xl p-6 border border-base-300 shadow-sm space-y-3">
              <div className="flex items-center gap-2.5 text-base font-bold text-primary">
                <Mail size={19} />
                <h2>7. Contact & Support</h2>
              </div>
              <p>
                If you have questions, feedback, or concerns regarding your privacy, please visit our{" "}
                <Link to="/contact" className="text-primary font-semibold underline">
                  Support & Contact Page
                </Link>
                .
              </p>
            </div>
          </div>
        )}

        {/* Footer info */}
        <div className="text-center pt-4 pb-8 text-xs text-base-content/50">
          <p>© {new Date().getFullYear()} LOCKET-PRO. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
