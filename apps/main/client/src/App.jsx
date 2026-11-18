import React, { Suspense, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
  Navigate,
  useNavigate,
} from "react-router-dom";

import { publicRoutes, authRoutes, locketRoutes } from "./routes";
import { ThemeProvider } from "./context/ThemeContext";
import { AppProvider } from "./context/AppContext";
import getLayout from "./layouts";
import NotFoundPage from "./components/pages/NotFoundPage";
import { Toaster } from "sonner";
import { SocketProvider } from "./context/SocketContext";
import {
  useAuthStore,
  useStreakStore,
  useUploadQueueStore,
  useOverlayStore,
  useFriendStoreV3,
  useMessagesStore,
  useMomentsStoreV2,
  useGroupMessagesStore,
} from "./stores";
import { showDevWarning } from "./utils/logging/devConsole";
import LoadingPageMain from "./components/pages/LoadPageMain";
import LayoutWithSidebar from "./layouts/baseLayout";
import VipRequired from "./components/pages/VipRequired";
import { CONTACT_CONFIG } from "@/config";

const allRoutes = [...publicRoutes, ...authRoutes, ...locketRoutes];
const privateRoutes = [...authRoutes, ...locketRoutes];
const sharedPublicPaths = ["/", "/home", "/privacy", "/admin", "/contact", "/download", "/newsfeed", "/pricing", "/pay", "/payment/result"];

function App() {
  return (
    <ThemeProvider>
      <SocketProvider>
        <AppProvider>
          <Router>
            <AppContent />
          </Router>
          <Toaster />
        </AppProvider>
      </SocketProvider>
    </ThemeProvider>
  );
}

function AppContent() {
  const navigate = useNavigate();
  const {
    loading,
    isAuth,
    user,
    accessDenied,
    clearAccessDenied,
    accessRole,
    setAccessRole,
    refreshAccessRole,
    hydrateAuth,
    initAuth,
  } = useAuthStore();
  const syncStreak = useStreakStore((s) => s.syncStreak);
  const fetchCaptionOverlays = useOverlayStore((s) => s.fetchCaptionOverlays);
  const hydrateUploadQueue = useUploadQueueStore((s) => s.hydrateUploadQueue);
  const resumeRecoverableUploads = useUploadQueueStore(
    (s) => s.resumeRecoverableUploads,
  );
  const loadFriendsV3 = useFriendStoreV3((s) => s.loadFriends);
  const refreshLoadedMoments = useMomentsStoreV2(
    (s) => s.refreshLoadedMoments,
  );
  const fetchConversations = useMessagesStore((s) => s.fetchConversations);
  const refreshRecentMessageThreads = useMessagesStore(
    (s) => s.refreshRecentMessageThreads,
  );
  const fetchGroups = useGroupMessagesStore((s) => s.fetchGroups);

  const location = useLocation();

  function setMeta(selector, content) {
    let el = document.querySelector(selector);
    if (el) el.setAttribute("content", content);
  }
  useEffect(() => {
    import("./styles/animation.css");
    hydrateAuth();
    initAuth();
    showDevWarning();
  }, [hydrateAuth, initAuth]);

  useEffect(() => {
    if (accessRole === "vip") {
      fetchCaptionOverlays();
    }
  }, [accessRole, fetchCaptionOverlays]);

  useEffect(() => {
    const shouldOpenCelebrityTool =
      accessRole === "celebrity" &&
      (location.pathname === "/login" || location.pathname === "/locket-beta");

    if (!loading && isAuth && shouldOpenCelebrityTool) {
      navigate("/tools#celebrity", { replace: true });
    } else if (!loading && isAuth && location.pathname === "/login") {
      navigate(accessRole === "celebrity" ? "/tools#celebrity" : "/locket-beta", {
        replace: true,
      });
    }
  }, [accessRole, isAuth, loading, location.pathname, navigate]);

  useEffect(() => {
    const handleRoleChange = (event) => {
      if (event.detail?.role) setAccessRole(event.detail.role);
    };
    window.addEventListener("t97:access-role-changed", handleRoleChange);
    return () =>
      window.removeEventListener("t97:access-role-changed", handleRoleChange);
  }, [setAccessRole]);

  useEffect(() => {
    if (!isAuth) return undefined;

    const refreshRole = () => refreshAccessRole();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refreshRole();
    };
    const intervalId = window.setInterval(refreshRole, 30_000);

    window.addEventListener("focus", refreshRole);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshRole);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isAuth, refreshAccessRole]);

  useEffect(() => {
    if (accessDenied && location.pathname !== "/login") {
      navigate("/login", { replace: true });
    }
  }, [accessDenied, location.pathname, navigate]);

  useEffect(() => {
    if (user && (accessRole === "vip" || accessRole === "free")) {
      // loadFriendsV2();
      loadFriendsV3();
      syncStreak();
      hydrateUploadQueue();
    }
  }, [accessRole, hydrateUploadQueue, loadFriendsV3, syncStreak, user]);

  useEffect(() => {
    if (!user || (accessRole !== "vip" && accessRole !== "free")) return undefined;

    let lastRecoverySyncAt = 0;
    const recover = () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      const now = Date.now();
      if (now - lastRecoverySyncAt < 12_000) return;
      lastRecoverySyncAt = now;
      void Promise.allSettled([
        resumeRecoverableUploads(),
        loadFriendsV3(),
        syncStreak(),
        refreshLoadedMoments(),
        fetchConversations(),
        refreshRecentMessageThreads(),
        fetchGroups(),
      ]);
    };

    const recoverWhenVisible = () => {
      if (document.visibilityState === "visible") recover();
    };

    window.addEventListener("t97:network-recovered", recover);
    window.addEventListener("t97:realtime-recovered", recover);
    document.addEventListener("visibilitychange", recoverWhenVisible);
    return () => {
      window.removeEventListener("t97:network-recovered", recover);
      window.removeEventListener("t97:realtime-recovered", recover);
      document.removeEventListener("visibilitychange", recoverWhenVisible);
    };
  }, [
    accessRole,
    fetchConversations,
    fetchGroups,
    loadFriendsV3,
    refreshLoadedMoments,
    refreshRecentMessageThreads,
    resumeRecoverableUploads,
    syncStreak,
    user,
  ]);

  useEffect(() => {
    const r = allRoutes.find((route) => route.path === location.pathname);
    document.title = r?.title || "LOCKET-PRO";

    const url = window.location.origin + location.pathname;
    (
      document.querySelector("link[rel='canonical']") ||
      document.head.appendChild(
        Object.assign(document.createElement("link"), { rel: "canonical" }),
      )
    ).href = url;

    setMeta("meta[property='og:title']", document.title);
    setMeta("meta[property='og:url']", url);
    setMeta("meta[name='twitter:title']", document.title);
  }, [location.pathname]);

  // if (loading) return <LoadingPageMain isLoading={true} />;

  return (
    <>
      <Suspense fallback={<LoadingPageMain isLoading={true} />}>
        <Routes>
          {(isAuth
            ? [
                ...privateRoutes,
                ...publicRoutes.filter(
                  (route) =>
                    sharedPublicPaths.includes(route.path) &&
                    !privateRoutes.some((pr) => pr.path === route.path),
                ),
              ]
            : publicRoutes
          ).map(
            (route) => {
              const { path } = route;
              const Layout = getLayout(path);
              const celebrityCanAccess = path === "/tools" || sharedPublicPaths.includes(path);
              const redirectCelebrityCamera =
                accessRole === "celebrity" && path === "/locket-beta";
              return (
                <Route
                  key={path}
                  path={path}
                  element={
                    redirectCelebrityCamera ? (
                      <Navigate to="/tools#celebrity" replace />
                    ) : (
                      <LayoutWithSidebar Layout={Layout}>
                        {isAuth && accessRole === "celebrity" && !celebrityCanAccess ? (
                          <VipRequired />
                        ) : (
                          React.createElement(route.component)
                        )}
                      </LayoutWithSidebar>
                    )
                  }
                />
              );
            },
          )}

          {/* Điều hướng khi chưa đăng nhập cố vào route cần auth */}
          {!loading &&
            !isAuth &&
            privateRoutes.map(({ path }) => (
              <Route
                key={path}
                path={path}
                element={<Navigate to="/login" replace />}
              />
            ))}

          {/* Điều hướng ngược lại khi đã đăng nhập mà cố vào public route */}
          {!loading &&
            isAuth &&
            publicRoutes
              .filter(({ path }) => !sharedPublicPaths.includes(path))
              .map(({ path }) => (
                <Route
                  key={path}
                  path={path}
                  element={
                    <Navigate
                      to={
                        accessRole === "celebrity"
                          ? "/tools#celebrity"
                          : "/locket-beta"
                      }
                      replace
                    />
                  }
                />
              ))}

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
      {accessDenied && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-base-300 bg-base-100 p-5 text-base-content shadow-2xl">
            <h2 className="text-xl font-bold">Cần admin phê duyệt</h2>
            <p className="mt-2 text-sm opacity-80">
              Tài khoản
              {accessDenied.username ? ` @${accessDenied.username}` : ""} chưa
              nằm trong danh sách được phép sử dụng web. Hệ thống đã tự đăng
              xuất tài khoản này.
            </p>
            <div className="mt-4 rounded-xl bg-base-200 p-3 text-sm">
              Liên hệ admin:
              <div className="mt-2 flex flex-col gap-2">
                <a className="break-all font-semibold text-primary underline" href={`mailto:${CONTACT_CONFIG.supportEmail}`}>
                  {CONTACT_CONFIG.supportEmail}
                </a>
                <a className="font-semibold text-primary underline" href={CONTACT_CONFIG.zaloUrl} target="_blank" rel="noopener noreferrer">
                  Zalo: {CONTACT_CONFIG.supportNumber}
                </a>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary mt-5 w-full"
              onClick={clearAccessDenied}
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}
      <LoadingPageMain isLoading={loading} />
    </>
  );
}

export default App;
