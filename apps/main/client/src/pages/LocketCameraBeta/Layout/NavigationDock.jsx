import { useApp } from "@/context/AppContext";

const CalendarIcon = () => (
  <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
    <path
      d="M10.4 0C13.76 0 15.44 0 16.724.654C17.853 1.23 18.77 2.147 19.346 3.276C20 4.56 20 6.24 20 9.6V10.4C20 13.76 20 15.44 19.346 16.724C18.77 17.853 17.853 18.77 16.724 19.346C15.44 20 13.76 20 10.4 20H9.6C6.24 20 4.56 20 3.276 19.346C2.147 18.77 1.23 17.853.654 16.724C0 15.44 0 13.76 0 10.4V9.6C0 6.24 0 4.56.654 3.276C1.23 2.147 2.147 1.23 3.276.654C4.56 0 6.24 0 9.6 0H10.4ZM5 13C4.628 13 4.442 13 4.29 13.045C3.931 13.15 3.65 13.431 3.545 13.79C3.5 13.942 3.5 14.128 3.5 14.5C3.5 14.872 3.5 15.058 3.545 15.21C3.65 15.569 3.931 15.85 4.29 15.955C4.442 16 4.628 16 5 16C5.372 16 5.558 16 5.71 15.955C6.069 15.85 6.35 15.569 6.455 15.21C6.5 15.058 6.5 14.872 6.5 14.5C6.5 14.128 6.5 13.942 6.455 13.79C6.35 13.431 6.069 13.15 5.71 13.045C5.558 13 5.372 13 5 13ZM10 13C9.628 13 9.442 13 9.29 13.045C8.931 13.15 8.65 13.431 8.545 13.79C8.5 13.942 8.5 14.128 8.5 14.5C8.5 14.872 8.5 15.058 8.545 15.21C8.65 15.569 8.931 15.85 9.29 15.955C9.442 16 9.628 16 10 16C10.372 16 10.558 16 10.71 15.955C11.069 15.85 11.35 15.569 11.455 15.21C11.5 15.058 11.5 14.872 11.5 14.5C11.5 14.128 11.5 13.942 11.455 13.79C11.35 13.431 11.069 13.15 10.71 13.045C10.558 13 10.372 13 10 13ZM15 13C14.628 13 14.442 13 14.29 13.045C13.931 13.15 13.65 13.431 13.545 13.79C13.5 13.942 13.5 14.128 13.5 14.5C13.5 14.872 13.5 15.058 13.545 15.21C13.65 15.569 13.931 15.85 14.29 15.955C14.442 16 14.628 16 15 16C15.372 16 15.558 16 15.71 15.955C16.069 15.85 16.35 15.569 16.455 15.21C16.5 15.058 16.5 14.872 16.5 14.5C16.5 14.128 16.5 13.942 16.455 13.79C16.35 13.431 16.069 13.15 15.71 13.045C15.558 13 15.372 13 15 13ZM5 8C4.628 8 4.442 8 4.29 8.045C3.931 8.15 3.65 8.431 3.545 8.79C3.5 8.942 3.5 9.128 3.5 9.5C3.5 9.872 3.5 10.058 3.545 10.21C3.65 10.569 3.931 10.85 4.29 10.955C4.442 11 4.628 11 5 11C5.372 11 5.558 11 5.71 10.955C6.069 10.85 6.35 10.569 6.455 10.21C6.5 10.058 6.5 9.872 6.5 9.5C6.5 9.128 6.5 8.942 6.455 8.79C6.35 8.431 6.069 8.15 5.71 8.045C5.558 8 5.372 8 5 8ZM10 8C9.628 8 9.442 8 9.29 8.045C8.931 8.15 8.65 8.431 8.545 8.79C8.5 8.942 8.5 9.128 8.5 9.5C8.5 9.872 8.5 10.058 8.545 10.21C8.65 10.569 8.931 10.85 9.29 10.955C9.442 11 9.628 11 10 11C10.372 11 10.558 11 10.71 10.955C11.069 10.85 11.35 10.569 11.455 10.21C11.5 10.058 11.5 9.872 11.5 9.5C11.5 9.128 11.5 8.942 11.455 8.79C11.35 8.431 11.069 8.15 10.71 8.045C10.558 8 10.372 8 10 8ZM15 8C14.628 8 14.442 8 14.29 8.045C13.931 8.15 13.65 8.431 13.545 8.79C13.5 8.942 13.5 9.128 13.5 9.5C13.5 9.872 13.5 10.058 13.545 10.21C13.65 10.569 13.931 10.85 14.29 10.955C14.442 11 14.628 11 15 11C15.372 11 15.558 11 15.71 10.955C16.069 10.85 16.35 10.569 16.455 10.21C16.5 10.058 16.5 9.872 16.5 9.5C16.5 9.128 16.5 8.942 16.455 8.79C16.35 8.431 16.069 8.15 15.71 8.045C15.558 8 15.372 8 15 8ZM8 3C7.448 3 7 3.448 7 4C7 4.552 7.448 5 8 5H12C12.552 5 13 4.552 13 4C13 3.448 12.552 3 12 3H8Z"
      fill="currentColor"
    />
  </svg>
);

const HomeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
    <path
      d="M8.519.201a5.5 5.5 0 0 1 2.962 0c1.099.304 2.09 1.097 4.072 2.682l1.111.888c1.225.981 1.838 1.471 2.278 2.08.391.538.682 1.143.859 1.785C20 8.36 20 9.144 20 10.713v2.328c0 2.24 0 3.36-.436 4.216a4 4 0 0 1-1.748 1.748c-.855.436-1.975.435-4.215.435a.6.6 0 0 1-.601-.6v-6.8c0-.56 0-.84-.109-1.054a1 1 0 0 0-.437-.437c-.214-.109-.494-.109-1.054-.109H8.6c-.56 0-.84 0-1.054.109a1 1 0 0 0-.437.437C7 11.2 7 11.48 7 12.04v6.801a.6.6 0 0 1-.6.599c-2.24 0-3.36.001-4.215-.435a4 4 0 0 1-1.748-1.748C.001 16.401 0 15.281 0 13.041v-2.328C0 9.144.001 8.36.2 7.636a5.5 5.5 0 0 1 .858-1.785c.441-.609 1.053-1.1 2.278-2.08l1.111-.888C6.429 1.298 7.42.505 8.519.201Z"
      fill="currentColor"
    />
  </svg>
);

const MessageIcon = () => (
  <svg width="22" height="22" viewBox="0 0 21 20" fill="none">
    <path
      d="M.242 9.968C.242 4.434 4.823 0 10.41 0s10.169 4.434 10.169 9.968c0 5.533-4.582 9.967-10.169 9.967a10.3 10.3 0 0 1-4.337-.95l-3.597.947c-1.638.431-3.021-1.27-2.263-2.786a6.6 6.6 0 0 0 .66-3.411 4 4 0 0 0-.16-.759 9.8 9.8 0 0 1-.471-3.008Z"
      fill="currentColor"
    />
  </svg>
);

const items = [
  { id: "calendar", label: "Lịch", icon: <CalendarIcon /> },
  { id: "home", label: "Home", icon: <HomeIcon /> },
  { id: "messages", label: "Tin nhắn", icon: <MessageIcon /> },
];

const activeOffset = {
  calendar: "calc(-50% - 62px)",
  home: "-50%",
  messages: "calc(-50% + 62px)",
};

export default function NavigationDock({ hidden = false }) {
  const { navigation, post } = useApp();
  const {
    isHomeOpen,
    isChatDetailOpen,
    isSidebarOpen,
    isFriendsTabOpen,
    isOptionModalOpen,
    isFilterOpen,
    isAiFilterOpen,
    isProfileOpen,
    profileSection,
    setProfileSection,
    setIsHomeOpen,
    setIsProfileOpen,
    isBottomOpen,
    setIsBottomOpen,
    setFriendHistoryOpen,
    isSettingTabOpen,
  } = navigation;
  const {
    selectedMoment,
    selectedMomentId,
    setSelectedMoment,
    setSelectedMomentId,
    setSelectedQueue,
    setSelectedQueueId,
  } = post;
  // The Moment screen opens before an individual Moment is selected. Keep the
  // center action in capture mode throughout both the feed and its viewer.
  const isViewingMoment =
    !isHomeOpen && !isProfileOpen && (isBottomOpen ||
    typeof selectedMoment === "number" ||
    Boolean(selectedMomentId));

  const activeId = isViewingMoment
    ? "home"
    : isProfileOpen
      ? "calendar"
      : isHomeOpen
        ? "messages"
        : "home";

  const clearMomentSelection = () => {
    setSelectedMoment(null);
    setSelectedMomentId(null);
    setSelectedQueue(null);
    setSelectedQueueId(null);
  };

  const select = (id) => {
    setFriendHistoryOpen(false);
    clearMomentSelection();

    if (id === "calendar") {
      setProfileSection("lockets");
      setIsHomeOpen(false);
      setIsBottomOpen(false);
      setIsProfileOpen(true);
      return;
    }

    if (id === "messages") {
      setIsProfileOpen(false);
      setIsBottomOpen(false);
      setIsHomeOpen(true);
      return;
    }

    setIsProfileOpen(false);
    setIsHomeOpen(false);
    setIsBottomOpen(false);
  };

  const modalOpen =
    isSidebarOpen ||
    isFriendsTabOpen ||
    isOptionModalOpen ||
    isFilterOpen ||
    isAiFilterOpen ||
    isSettingTabOpen ||
    post.showEmojiPicker;
  if (hidden || isChatDetailOpen || modalOpen || (isProfileOpen && profileSection === "rollcall")) return null;

  return (
    <nav
      aria-label="Điều hướng chính"
      data-center-mode={isViewingMoment ? "capture" : "home"}
      className={`pointer-events-none fixed inset-x-0 flex w-full items-center justify-center ${
        isViewingMoment ? "z-80" : "z-60"
      }`}
      style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <div className="pointer-events-auto relative flex w-fit items-center gap-1 rounded-full bg-base-300/80 p-0.5 shadow-md backdrop-blur-md border border-base-content/10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 z-0 rounded-full bg-base-100 shadow-sm px-8.5 py-6 transition-[transform,opacity] duration-300 border border-base-content/10"
          style={{
            opacity: isViewingMoment ? 0 : 1,
            transform: `translate(${activeOffset[activeId]}, -50%) scale(${isViewingMoment ? 0.7 : 1})`,
          }}
        />

        {items.map(({ id, label, icon }) => {
          const active = id === activeId;

          if (id === "home") {
            return (
              <button
                key={id}
                type="button"
                aria-label={isViewingMoment ? "Trở về camera" : label}
                aria-current={active ? "page" : undefined}
                onClick={() => select(id)}
                className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-transform duration-300 ease-out active:scale-95"
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-0 flex items-center justify-center text-primary transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                  style={{
                    opacity: isViewingMoment ? 0 : 1,
                    transform: isViewingMoment
                      ? "scale(0.35) rotate(90deg)"
                      : "scale(1) rotate(0deg)",
                  }}
                >
                  {icon}
                </span>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute flex h-9 w-9 items-center justify-center rounded-full ring-4 ring-primary bg-base-100/10 shadow-sm transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                  style={{
                    opacity: isViewingMoment ? 1 : 0,
                    transform: isViewingMoment
                      ? "scale(1) rotate(0deg)"
                      : "scale(0.35) rotate(-90deg)",
                  }}
                >
                  <span className="h-8 w-8 rounded-full border border-base-300 bg-base-100 transition-transform duration-300" />
                </span>
              </button>
            );
          }

          return (
            <button
              key={id}
              type="button"
              aria-label={label}
              aria-current={active ? "page" : undefined}
              onClick={() => select(id)}
              className={`relative z-10 flex items-center justify-center rounded-full px-6 py-3.5 transition-colors duration-300 ease-out active:scale-95 ${
                active ? "text-primary" : "text-base-content/50"
              }`}
            >
              {icon}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
