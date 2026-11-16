import { useState, useEffect } from "react";
import * as utils from "@/utils";
import LoadingRing from "@/components/ui/Loading/ring";
import StatusServer from "@/components/ui/StatusServer";
import { useApp } from "@/context/AppContext";
import { Link } from "react-router-dom";
import { SonnerError, SonnerSuccess } from "@/components/ui/SonnerToast";
import { CONFIG } from "@/config";
import MomentStory from "../Home/MomentStory";
import "../Home/mtien-home.css";
import "./styles.css";
import { ensureDBOwner } from "@/cache/configDB";
import { useAuthStore } from "@/stores";
import TurnstileCaptcha from "./TurnstileCaptcha";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, Phone } from "lucide-react";
import { loginWithEmail, loginWithPhone } from "@/services";
import { PhoneInput } from "./PhoneInput";

const Login = () => {
  const initAuth = useAuthStore((s) => s.initAuth);
  const hydrateAuth = useAuthStore((s) => s.hydrateAuth);
  const [captchaToken, setCaptchaToken] = useState(null);
  const [loginMethod, setLoginMethod] = useState("email"); // "email" hoặc "phone"
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    const stored = localStorage.getItem("rememberMe");
    return stored === null ? true : stored === "true";
  });

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
    e.preventDefault();

    if (CONFIG.keys.turnstileKey && !captchaToken) {
      SonnerError("Vui lòng xác minh bạn không phải robot");
      return;
    }

    // Validate
    if (loginMethod === "email") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(identifier)) {
        SonnerError("Email không hợp lệ!");
        return;
      }
    } else {
      const phoneRegex = /^\+[1-9]\d{6,14}$/;
      if (!phoneRegex.test(identifier)) {
        SonnerError("Số điện thoại không hợp lệ!");
        return;
      }
    }
    setIsLoginLoading(true);

    try {
      const res =
        loginMethod === "email"
          ? await loginWithEmail({
              email: identifier,
              password,
              captchaToken,
            })
          : await loginWithPhone({
              phone: identifier,
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
        return;
      }

      SonnerSuccess(
        "Đăng nhập thành công!",
        `Xin chào ${authUser?.displayName || authUser?.username || "người dùng"}!`
      );
    } catch (error) {
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

      // setIdentifier("");
      // setPassword("");
    } finally {
      setIsLoginLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleLoginMethod = () => {
    setLoginMethod(loginMethod === "email" ? "phone" : "email");
    setIdentifier("");
    setPassword("");
  };

  const isActiveLogin =
    isStatusServer !== true ||
    isLoginLoading ||
    (CONFIG.keys.turnstileKey && !captchaToken);

  return (
    <div className="mtien-login">
      <div className="mtien-login-layout mtien-container">
        <section className="mtien-login-aside" aria-label="Khoảnh khắc cùng MTIEN">
          <div className="mtien-eyebrow"><span /> NHỮNG ĐIỀU NHỎ, KẾT NỐI LỚN</div>
          <h2>Một chút hôm nay.<br /><span>Gửi đến người thương.</span></h2>
          <p>Đăng nhập và tiếp tục câu chuyện của bạn.</p>
          <MomentStory compact />
        </section>
        <section className="mtien-login-form-section" aria-labelledby="mtien-login-title">
          <div className="mtien-login-welcome"><img src="/mtien-mark.svg" width="42" height="42" alt="" /><span>GÓC NHỎ CỦA BẠN</span></div>
          <h1 id="mtien-login-title">Chào bạn trở lại.</h1>
          <p className="mtien-login-subtitle">Dùng tài khoản Locket của bạn để tiếp tục.</p>
          <div className="mtien-login-method" role="group" aria-label="Phương thức đăng nhập">
            <button type="button" aria-pressed={loginMethod === "email"} onClick={() => loginMethod !== "email" && toggleLoginMethod()}><Mail size={17} />Email</button>
            <button type="button" aria-pressed={loginMethod === "phone"} onClick={() => loginMethod !== "phone" && toggleLoginMethod()}><Phone size={17} />Số điện thoại</button>
          </div>
          <form onSubmit={handleLogin} className="mtien-login-form">
            <div className="mtien-field">
              <label htmlFor="mtien-identifier">{loginMethod === "email" ? "Email" : "Số điện thoại"}</label>
              {loginMethod === "email" ? (
                <input id="mtien-identifier" name="username" autoComplete="username" type="email" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="ban@example.com" required />
              ) : (
                <PhoneInput id="mtien-identifier" value={identifier} onChange={setIdentifier} />
              )}
            </div>
            <div className="mtien-field">
              <div className="mtien-field-label"><label htmlFor="mtien-password">Mật khẩu</label><Link to="/forgot-password">Quên mật khẩu?</Link></div>
              <div className="mtien-password-wrap">
                <input id="mtien-password" name="password" autoComplete="current-password" type={showPassword ? "text" : "password"} placeholder="Nhập mật khẩu Locket" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button type="button" className="mtien-password-toggle" onClick={togglePasswordVisibility} aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"} aria-pressed={showPassword}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button>
              </div>
            </div>
            <label className="mtien-remember"><input id="rememberMe" type="checkbox" disabled checked={rememberMe} onChange={() => setRememberMe(!rememberMe)} /><span>Ghi nhớ đăng nhập</span></label>
            <TurnstileCaptcha onVerify={setCaptchaToken} />
            <button type="submit" className="mtien-button mtien-button-primary mtien-login-submit" disabled={isActiveLogin}>
              {isLoginLoading ? <><LoadingRing size={18} stroke={3} speed={2} color="#15251b" />Đang đăng nhập...</> : <>Đăng nhập<ArrowRight size={19} /></>}
            </button>
            <div className="mtien-server-status"><StatusServer /></div>
          </form>
          <div className="mtien-login-note"><LockKeyhole size={15} /><p>Đăng nhập bằng tài khoản bạn đang dùng trên ứng dụng Locket.</p></div>
          <div className="mtien-login-links"><Link to="/">Về trang chủ</Link><span>·</span><Link to="/privacy">Quyền riêng tư</Link></div>
        </section>
      </div>
    </div>
  );
};

export default Login;
