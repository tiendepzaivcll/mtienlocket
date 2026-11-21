import React, { useEffect, useState } from "react";
import { useApp } from "@/context/AppContext";
import HeaderOne from "./Layout/HeaderOne";
import InfoUser from "./Layout/InfoUser";
import SegmentedToggle from "./Layout/SegmentedToggle";
import RollcallsPost from "./Views/RollcallsPage";
import StreakLocket from "./Views/CalenderStreak";
import { useAuthStore, useMomentsStoreV2, useUploadQueueStore } from "@/stores";

const LeftHomeScreen = ({ setIsProfileOpen }) => {
  const { user } = useAuthStore();
  const { navigation } = useApp();
  const { isProfileOpen, profileSection, setProfileSection } = navigation;
  const [posts, setPosts] = useState([]);

  const postedMoments = useUploadQueueStore((s) => s.postedMoments);
  const allMoments = useMomentsStoreV2((s) => s.momentsByUser["all"]?.items || []);
  const fetchMoments = useMomentsStoreV2((s) => s.fetchMoments);

  useEffect(() => {
    if (isProfileOpen && profileSection === "lockets" && user && (!allMoments || allMoments.length === 0)) {
      fetchMoments(user, null);
    }
  }, [isProfileOpen, profileSection, user, allMoments, fetchMoments]);
  // handle toggle bằng true/false
  return (
    <div
      style={{ background: "var(--bg-app)" }}
      className={`fixed inset-0 w-full grid grid-rows-[auto_1fr] z-50 text-[var(--text-primary)] transition-transform duration-500 overflow-hidden ${
        isProfileOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      {/* ==== Header (sticky) ==== */}
      <div
        style={{
          background: "var(--surface-dock)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
        className="relative shadow-md border-b border-[var(--border-subtle)]"
      >
        <HeaderOne setIsProfileOpen={setIsProfileOpen} />
        <InfoUser user={user} />
      </div>

      {/* ==== Nội dung chính ==== */}
      <div className="flex bg-transparent overflow-y-auto">
        {profileSection === "rollcall" && (
          <RollcallsPost
            active={profileSection}
            posts={posts}
            setPosts={setPosts}
            isProfileOpen={isProfileOpen}
          />
        )}
        {profileSection === "lockets" && (
          <StreakLocket recentPosts={postedMoments} allMoments={allMoments} />
        )}
      </div>
      {/* ==== Bottom Segmented Toggle ==== */}
      <div className="fixed z-60 bottom-4 w-full select-none">
        <SegmentedToggle
          active={profileSection}
          setActive={setProfileSection}
        />
      </div>
    </div>
  );
};

export default LeftHomeScreen;
