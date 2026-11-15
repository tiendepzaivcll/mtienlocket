import { useState, useEffect } from "react";

import { useNavigate } from "react-router-dom";
import * as utils from "@/utils";
import LoadingRing from "@/components/ui/Loading/ring";
import StatusServer from "@/components/ui/StatusServer";
import { useApp } from "@/context/AppContext";
import { SonnerError, SonnerSuccess, SonnerInfo } from "@/components/ui/SonnerToast";
import { CONFIG } from "@/config";
import { ensureDBOwner } from "@/cache/configDB";
import { useAuthStore } from "@/stores";
import TurnstileCaptcha from "./TurnstileCaptcha";
import { loginWithEmail } from "@/services";

import { initializeApp } from "firebase/app";

import { getFirestore, doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const PAYOS_BACKEND_URL = import.meta.env.VITE_PAYMENT_API_URL;

const Login = () => {
  const navigate = useNavigate();

  const init = useAuthStore((s) => s.init);
  const hydrate = useAuthStore((s) => s.hydrate);
  
  const [step, setStep] = useState("input_email"); 
  const [isCheckingPlan, setIsCheckingPlan] = useState(false);
  const [isPaying, setIsPaying] = useState(false);

  const [captchaToken, setCaptchaToken] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    const stored = localStorage.getItem("rememberMe");
    return stored === null ? true : stored === "true";
  });

  const { useloading } = useApp();
  const { isStatusServer, isLoginLoading, setIsLoginLoading } = useloading;

  useEffect(() => {
    const checkPaymentReturn = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const paymentStatus = urlParams.get("status"); 
      const payEmail = urlParams.get("email");

      if (paymentStatus === "success" && payEmail) {
        setEmail(payEmail.toLowerCase());
        SonnerSuccess("Thanh toán thành công!", "Tài khoản của bạn đang được hệ thống kích hoạt VIP.");
        setStep("ready_to_login");
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (paymentStatus === "cancel") {
        SonnerError("Đã hủy thanh toán");
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };
    checkPaymentReturn();
  }, []);

  useEffect(() => {
    if (rememberMe) {
      localStorage.setItem("rememberMe", "true");
    } else {
      localStorage.removeItem("rememberMe");
    }
  }, [rememberMe]);

  const handleCheckPackage = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      SonnerError("Email không hợp lệ!");
      return;
    }
    setIsCheckingPlan(true);
    try {
      const normalizedEmail = email.toLowerCase();
      
      // Method 1: Try direct doc ID (new format)
      const docRef = doc(db, "subscriptions", normalizedEmail);
      let docSnap = await getDoc(docRef);
      
      // Method 2: If not found, query by email field (old format compatibility)
      if (!docSnap.exists()) {
        try {
          const q = query(collection(db, "subscriptions"), where("email", "==", normalizedEmail));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            docSnap = querySnapshot.docs[0];
          }
        } catch (queryError) {
          // Silent error handling
        }
      }

      if (docSnap.exists()) {
        const data = docSnap.data();
        
        if (data.expireAt > Date.now()) {
          SonnerSuccess("Email hợp lệ!", "Vui lòng nhập mật khẩu để đăng nhập.");
          setStep("ready_to_login");
        } else {
          SonnerError("Gói đã hết hạn", "Vui lòng gia hạn để tiếp tục sử dụng.");
          setStep("choose_package");
        }
      } else {
        SonnerInfo("Tài khoản chưa có gói", "Vui lòng mua gói để sử dụng.");
        setStep("choose_package");
      }
    } catch (error) {
      SonnerError("Lỗi kiểm tra dữ liệu", "Không thể kết nối đến máy chủ.");
    } finally {
      setIsCheckingPlan(false);
    }
  };

  const handleBuyPackage = async (price, months) => {
    setIsPaying(true);
    try {
      const newOrderCode = Math.floor(100000 + Math.random() * 900000);
      const normalizedEmail = email.toLowerCase();
      const response = await fetch(`${PAYOS_BACKEND_URL}/api/create-payment-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderCode: newOrderCode,
          amount: price,
          description: String(newOrderCode), 
          returnUrl: `${window.location.origin}/login?status=success&email=${normalizedEmail}&months=${months}`,
          cancelUrl: `${window.location.origin}/login?status=cancel`,
          email: normalizedEmail, 
          months: months 
        })
      });
      const data = await response.json();
      if (data && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else if (data.success && data.data && data.data.checkoutUrl) {
        window.location.href = data.data.checkoutUrl;
      } else {
        throw new Error("Không lấy được link thanh toán");
      }
    } catch (error) {
      SonnerError("Lỗi thanh toán", "Vui lòng thử lại sau.");
    } finally {
      setIsPaying(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (CONFIG.keys.turnstileKey && !captchaToken) {
      SonnerError("Vui lòng xác minh bạn không phải robot");
      return;
    }
    
    setIsLoginLoading(true);
    try {
      const res = await loginWithEmail({ email, password, captchaToken });
      if (!res?.data) throw new Error("Server không trả về dữ liệu");

      // 1. Nhét chặt vé vào bộ nhớ
      const { idToken, localId, refreshToken } = res.data;
      localStorage.setItem("idToken", idToken);
      localStorage.setItem("localId", localId);
      try { utils.saveToken({ idToken, localId, refreshToken }, rememberMe); } catch(e){}

      SonnerSuccess("Đăng nhập thành công!", "Đang chuyển đến Locket Camera...");

      // 🚀 2. DÙNG NAVIGATE CHUYỂN TRANG TỨC THÌ (KHÔNG LOAD LẠI TRANG)
      navigate("/locket-beta", { replace: true });

      // Start non-critical background initialization after login succeeds.
      setTimeout(() => {
        try {
          ensureDBOwner(localId);
          init();
          hydrate();
        } catch(e) {}
      }, 500);

    } catch (error) {
      if (error?.status) {
        switch (error.status) {
          case 400: SonnerError("Tài khoản hoặc mật khẩu không đúng!"); break;
          case 401: SonnerError("Phiên đăng nhập đã hết!"); break;
          case 429: SonnerError("Thử sai quá nhiều lần. Vui lòng đợi!"); break;
          case 403: navigate("/login"); break;
          default: SonnerError(error.message || "Đăng nhập thất bại!");
        }
      } else {
        SonnerError("Lỗi kết nối! Vui lòng kiểm tra mạng.");
      }
    } finally {
      setIsLoginLoading(false);
    }
  };

  const togglePasswordVisibility = () => setShowPassword(!showPassword);
  const isActiveLogin = isStatusServer !== true || isLoginLoading || (CONFIG.keys.turnstileKey && !captchaToken);

  return (
    <div className="flex items-center justify-center min-h-screen px-4 py-8 md:py-0">
      <div className="relative w-full max-w-md p-6 md:p-8 shadow-lg overflow-hidden rounded-3xl backdrop-blur-3xl bg-base-100 border border-base-300 text-base-content">
        <h1 className="text-2xl md:text-3xl font-bold text-center mb-8">Đăng Nhập Locket</h1>

          <div className="space-y-4 md:space-y-5">
            <div className="space-y-1">
            <label className="label flex justify-between items-center">
              <span>Email <span className="text-red-500">*</span></span>
              {step !== "input_email" && (
                <button 
                  onClick={() => { setStep("input_email"); setPassword(""); }}
                  className="text-xs text-blue-500 underline hover:text-blue-600"
                >Sửa email</button>
              )}
            </label>
            <input
              type="email"
              value={email}
              disabled={step !== "input_email"}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              className="w-full py-3 md:py-4 rounded-lg input input-ghost border border-base-content transition text-sm md:text-base font-semibold placeholder:font-normal placeholder:italic disabled:opacity-50"
            />
          </div>

          {step === "input_email" && (
            <button
              type="button"
              onClick={handleCheckPackage}
              disabled={isCheckingPlan || !email}
              className="w-full btn btn-primary py-3 text-base md:text-lg font-semibold rounded-lg transition"
            >
              {isCheckingPlan ? <LoadingRing size={20} color="white" /> : "Kiểm tra gói"}
            </button>
          )}

          {step === "choose_package" && (
            <div className="space-y-3 animate-fadeIn">
              <div className="p-3 md:p-4 border-2 border-yellow-400 rounded-xl bg-yellow-50/10 hover:bg-yellow-50/20 transition cursor-pointer"
                   onClick={() => handleBuyPackage(15000, 1)}>
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-base md:text-lg text-yellow-500">Gói 1 Tháng</h3>
                    <p className="text-xs md:text-sm opacity-70 mt-1">Locket 15 giây + Locket Gold</p>
                  </div>
                  <span className="font-extrabold text-lg md:text-xl">15.000đ</span>
                </div>
              </div>

              <div className="p-3 md:p-4 border-2 border-purple-500 rounded-xl bg-purple-50/10 hover:bg-purple-50/20 transition cursor-pointer"
                   onClick={() => handleBuyPackage(30000, 3)}>
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-base md:text-lg text-purple-500">Gói 3 Tháng</h3>
                    <p className="text-xs md:text-sm opacity-70 mt-1">Locket 15 giây + Locket Gold</p>
                  </div>
                  <span className="font-extrabold text-lg md:text-xl">30.000đ</span>
                </div>
              </div>

              {isPaying && <div className="text-center text-xs md:text-sm text-blue-500 mt-2">Đang tạo link thanh toán...</div>}
            </div>
          )}

          {step === "ready_to_login" && (
            <form onSubmit={handleLogin} className="space-y-4 animate-slideUp">
              <div className="space-y-1">
                <label className="label flex gap-1 items-center text-sm md:text-base">Μật khẩu <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="w-full pr-5 rounded-lg input input-ghost border-base-content font-semibold text-sm md:text-base"
                    placeholder="Nhập mật khẩu"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    className="absolute top-1/2 z-10 right-3 transform -translate-y-1/2 text-base-content opacity-70 hover:opacity-100 text-xs md:text-sm"
                  >{showPassword ? "Ẩn" : "Hiện"}</button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="rememberMe"
                  type="checkbox"
                  className="checkbox checkbox-primary checkbox-sm"
                  checked={rememberMe}
                  onChange={() => setRememberMe(!rememberMe)}
                />
                <label htmlFor="rememberMe" className="cursor-pointer select-none text-xs md:text-sm">Ghi nhở đăng nhập</label>
              </div>

              <button
                type="submit"
                className={`w-full btn btn-primary py-3 text-base md:text-lg font-semibold rounded-lg transition flex items-center justify-center gap-2 ${ isActiveLogin ? "opacity-80 cursor-not-allowed" : ""}`}
                disabled={isActiveLogin}
              >
                {isLoginLoading ? <LoadingRing size={20} color="white" /> : "Đăng Nhập"}
              </button>

              <TurnstileCaptcha onVerify={setCaptchaToken} />
            </form>
          )}
          <StatusServer />
        </div>
      </div>
    </div>
  );
};

export default Login;
