import { useState, useEffect, useRef } from "react";
import * as utils from "@/utils";
import LoadingRing from "@/components/ui/Loading/ring";
import StatusServer from "@/components/ui/StatusServer";
import { useApp } from "@/context/AppContext";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { SonnerError, SonnerSuccess, SonnerDismiss, toast } from "@/components/ui/SonnerToast";
import { CONFIG } from "@/config";
import MomentStory from "../Home/MomentStory";
import "../Home/mtien-home.css";
import "./styles.css";
import { ensureDBOwner } from "@/cache/configDB";
import { useAuthStore } from "@/stores";
import TurnstileCaptcha from "./TurnstileCaptcha";
import { ArrowRight, Eye, EyeOff, LockKeyhole, X } from "lucide-react";
import { loginWithEmail } from "@/services";
import { saveCurrentAccountToPool } from "@/utils/auth/accountManager";

const Login = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isAddAccount = location.search.includes("mode=add_account");
  const initAuth = useAuthStore((s) => s.initAuth);
  const hydrateAuth = useAuthStore((s) => s.hydrateAuth);
  const accessRole = useAuthStore((s) => s.accessRole);
  const [captchaToken, setCaptchaToken] = useState(null);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    const stored = localStorage.getItem("rememberMe");
    return stored === null ? true : stored === "true";
  });

  const isSubmittingRef = useRef(false);
  const hasSucceededRef = useRef(false);

  const { useloading } = useApp();
  const { isStatusServer, isLoginLoading, setIsLoginLoading } = useloading;

  useEffect(() => {
    if (rememberMe) {
      localStorage.setItem("rememberMe", "true");
    } else {
      localStorage.removeItem("rememberMe");
    }
  }, [rememberMe]);

  const handleLogin = async (e) => {
    e?.preventDefault?.();

    // 1. Chống bấm đúp / gửi 2 request cùng lúc (Prevent Double Submit)
    if (isLoginLoading || isSubmittingRef.current || hasSucceededRef.current) {
      return;
    }
    isSubmittingRef.current = true;

    if (CONFIG.keys.turnstileKey && !captchaToken) {
      SonnerError("Vui lòng xác minh bạn không phải robot");
      isSubmittingRef.current = false;
      return;
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(identifier.trim())) {
      SonnerError("Email không hợp lệ!");
      isSubmittingRef.current = false;
      return;
    }

    setIsLoginLoading(true);

    try {
      const res = await loginWithEmail({
        email: identifier.trim(),
        password,
        captchaToken,
      });

      if (!res?.data) throw new Error("Server không trả về dữ liệu");

      const { idToken, localId, refreshToken } = res.data;

      utils.clearUserCache();
      utils.removeUser();
      utils.saveToken({ idToken, localId, refreshToken }, rememberMe);
      await ensureDBOwner(localId);

      const authUser = await initAuth({ force: true });
      hydrateAuth();

      if (!authUser) {
        isSubmittingRef.current = false;
        return;
      }

      try {
        saveCurrentAccountToPool(authUser, { idToken, localId, refreshToken });
      } catch (poolErr) {
        console.warn("Could not save to accounts pool", poolErr);
      }

      // Đánh dấu đã thành công để chặn mọi lỗi phát sinh sau đó
      hasSucceededRef.current = true;

      // 2. Dọn sạch mọi toast lỗi cũ trước khi hiện toast thành công
      try {
        SonnerDismiss();
        toast?.dismiss?.();
      } catch (dismissErr) {
        console.warn("Could not dismiss toasts:", dismissErr);
      }

      SonnerSuccess(
        isAddAccount ? "Đã thêm tài khoản thành công!" : "Đăng nhập thành công!",
        `Xin chào ${authUser?.displayName || authUser?.username || "người dùng"}! LOCKET-PRO · Admin MTIEN.`
      );

      const currentAccessRole = useAuthStore.getState().accessRole || accessRole;
      navigate(currentAccessRole === "celebrity" ? "/tools#celebrity" : "/locket-beta", {
        replace: true,
      });
    } catch (error) {
      // Nếu request đã thành công trước đó thì tuyệt đối không hiển thị thông báo lỗi
      if (hasSucceededRef.current) {
        return;
      }

      // Bỏ qua lỗi AbortError / Canceled
      const isAbortError =
        error?.name === "AbortError" ||
        error?.code === "ERR_CANCELED" ||
        error?.code === "ECONNABORTED" ||
        error?.message === "canceled" ||
        error?.message?.toLowerCase?.()?.includes("abort");

      if (isAbortError) {
        return;
      }

      if (error?.status) {
        switch (error.status) {
          case 400:
            SonnerError("Tài khoản hoặc mật khẩu không đúng!");
            break;
          case 401:
            SonnerError("Phiên đăng nhập đã hết. Vui lòng đăng nhập lại!");
            break;
          case 429:
            SonnerError("Bạn nhập sai quá nhiều lần. Vui lòng thử lại sau!");
            break;
          case 403:
            SonnerError("Bạn không có quyền truy cập.");
            window.location.href = "/login";
            break;
          case 500:
            SonnerError("Lỗi hệ thống, vui lòng thử lại sau!");
            break;
          default:
            SonnerError(error.message || "Đăng nhập thất bại!");
        }
      } else {
        SonnerError("Lỗi kết nối! Vui lòng kiểm tra mạng.");
      }
    } finally {
      setIsLoginLoading(false);
      isSubmittingRef.current = false;
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const isActiveLogin =
    isStatusServer !== true ||
    isLoginLoading ||
    (CONFIG.keys.turnstileKey && !captchaToken);

  return (
    <div className="mtien-login">
      {/* Nút đóng X rõ ràng để quay lại camera */}
      <button
        type="button"
        onClick={() => {
          if (window.history.length > 1) {
            navigate(-1);
          } else {
            navigate("/locket-beta");
          }
        }}
        className="fixed top-4 right-4 z-50 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white border border-white/15 shadow-lg transition cursor-pointer"
        style={{
          top: "calc(env(safe-area-inset-top) + 14px)",
          right: "16px",
        }}
        aria-label="Đóng và quay lại"
        title="Quay lại"
      >
        <X size={20} strokeWidth={2.4} />
      </button>

      <div className="mtien-login-layout mtien-container">
        <section className="mtien-login-aside" aria-label="Khoảnh khắc cùng LOCKET-PRO">
          <div className="mtien-eyebrow"><span /> NHỮNG ĐIỀU NHỎ, KẾT NỐI LỚN</div>
          <h2>Một chút hôm nay.<br /><span>Gửi đến người thương.</span></h2>
          <p>Đăng nhập và tiếp tục câu chuyện của bạn.</p>
          <MomentStory compact />
        </section>
        <section className="mtien-login-form-section" aria-labelledby="mtien-login-title">
          <div className="mtien-login-welcome"><img src="/locket-pro-icon-192x192.png" width="42" height="42" alt="" /><div className="locket-pro-login-brand"><strong>LOCKET-PRO</strong><span>Quản trị bởi <b>MTIEN</b></span></div></div>
          <h1 id="mtien-login-title">
            {isAddAccount ? "Thêm tài khoản mới." : "Chào bạn trở lại."}
          </h1>
          <p className="mtien-login-subtitle">
            {isAddAccount
              ? "Nhập email & mật khẩu tài khoản khác. Tài khoản hiện tại vẫn được lưu trên máy."
              : "Dùng email tài khoản Locket của bạn để tiếp tục."}
          </p>
          {isAddAccount && (
            <button
              type="button"
              onClick={() => navigate("/locket-beta")}
              className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 transition"
            >
              ← Quay lại camera Locket
            </button>
          )}
          <form onSubmit={handleLogin} className="mtien-login-form">
            <div className="mtien-field">
              <label htmlFor="mtien-identifier">Email Locket</label>
              <input id="mtien-identifier" name="username" autoComplete="username" type="email" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="ban@example.com" required />
            </div>
            <div className="mtien-field">
              <div className="mtien-field-label"><label htmlFor="mtien-password">Mật khẩu</label></div>
              <div className="mtien-password-wrap">
                <input id="mtien-password" name="password" autoComplete="current-password" type={showPassword ? "text" : "password"} placeholder="Nhập mật khẩu Locket" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button type="button" className="mtien-password-toggle" onClick={togglePasswordVisibility} aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"} aria-pressed={showPassword}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button>
              </div>
            </div>
            <label className="mtien-remember"><input id="rememberMe" type="checkbox" disabled checked={rememberMe} onChange={() => setRememberMe(!rememberMe)} /><span>Ghi nhớ đăng nhập</span></label>
            <TurnstileCaptcha onVerify={setCaptchaToken} />
            <button
              type="submit"
              className="mtien-login-submit w-full py-3.5 rounded-xl font-bold text-base text-white flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "var(--shutter-gradient, linear-gradient(135deg, #FFB800, #FF7A00))",
              }}
              disabled={isActiveLogin || isLoginLoading || isSubmittingRef.current}
            >
              {isLoginLoading ? (
                <>
                  <LoadingRing size={18} stroke={3} speed={2} color="#ffffff" />
                  <span>Đang đăng nhập...</span>
                </>
              ) : (
                <>
                  <span>Đăng nhập</span>
                  <ArrowRight size={19} className="shrink-0" />
                </>
              )}
            </button>
            <div className="mtien-server-status"><StatusServer /></div>
          </form>
          <div className="mtien-login-note"><LockKeyhole size={15} /><p>Đăng nhập bằng tài khoản bạn đang dùng trên ứng dụng Locket. Website được quản trị bởi <strong>MTIEN</strong>.</p></div>
          <div className="mtien-login-links"><Link to="/">Về trang chủ</Link><span>·</span><Link to="/privacy">Quyền riêng tư</Link></div>
        </section>
      </div>
    </div>
  );
};

export default Login;
