import React, { useEffect, useRef, useState } from "react";
import { useApp } from "@/context/AppContext";
import HeaderOne from "./Layout/HeaderOne";
import InfoUser from "./Layout/InfoUser";
import SegmentedToggle from "./Layout/SegmentedToggle";
import RollcallsPost from "./Views/RollcallsPage";
import StreakLocket from "./Views/CalenderStreak";
import { useAuthStore, useMomentsStoreV2, useUploadQueueStore } from "@/stores";

const EMPTY_ITEMS = [];

const LeftHomeScreen = ({ setIsProfileOpen }) => {
  const { user } = useAuthStore();
  const { navigation } = useApp();
  const { isProfileOpen, profileSection, setProfileSection } = navigation;
  const [posts, setPosts] = useState([]);

  const postedMoments = useUploadQueueStore((s) => s.postedMoments || EMPTY_ITEMS);
  const userUid = user?.uid || user?.localId;
  const myMoments = useMomentsStoreV2((s) => (userUid ? s.momentsByUser[userUid]?.items : null) || EMPTY_ITEMS);
  const allMoments = useMomentsStoreV2((s) => s.momentsByUser["all"]?.items || EMPTY_ITEMS);
  const isBucketLoading = useMomentsStoreV2((s) => Boolean(userUid && s.momentsByUser[userUid]?.loading));
  const fetchMoments = useMomentsStoreV2((s) => s.fetchMoments);

  const hasFetchedProfileRef = useRef(false);
  useEffect(() => {
    hasFetchedProfileRef.current = false;
  }, [userUid]);

  useEffect(() => {
    if (
      isProfileOpen &&
      profileSection === "lockets" &&
      user &&
      userUid &&
      !isBucketLoading &&
      !hasFetchedProfileRef.current
    ) {
      if (myMoments.length === 0) {
        hasFetchedProfileRef.current = true;
        fetchMoments(user, userUid);
      }
    }
  }, [isProfileOpen, profileSection, user, userUid, myMoments.length, isBucketLoading, fetchMoments]);
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
          <StreakLocket
            recentPosts={postedMoments}
            myMoments={myMoments || []}
            allMoments={allMoments}
          />
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
