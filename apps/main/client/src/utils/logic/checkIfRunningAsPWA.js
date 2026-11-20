export const checkIfRunningAsPWA = () => {
  if (typeof window === "undefined") return false;
  return Boolean(
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator?.standalone === true || // iOS Safari Add to Home Screen
    document.referrer?.includes("android-app://")
  );
};

export const syncPWAClass = () => {
  if (typeof window === "undefined" || !document?.body) return false;
  const isPWA = checkIfRunningAsPWA();
  document.body.classList.toggle("is-pwa", isPWA);
  return isPWA;
};

export const detectAppEnvironment = () => {
  // Kiểm tra display mode
  if (
    window.matchMedia &&
    window.matchMedia("(display-mode: standalone)").matches
  ) {
    return true;
  }

  // Kiểm tra navigator.standalone cho iOS
  if (window.navigator.standalone === true) {
    return true;
  }

  // Kiểm tra document.referrer cho Android
  if (document.referrer.includes("android-app://")) {
    return true;
  }

  // Kiểm tra user agent cho các trường hợp khác
  const userAgent = window.navigator.userAgent.toLowerCase();
  if (userAgent.includes("wv") || userAgent.includes("webview")) {
    return true;
  }

  return false;
};
