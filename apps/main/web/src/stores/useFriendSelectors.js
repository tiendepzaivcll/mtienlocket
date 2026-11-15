import { useMemo } from "react";
import { useFriendStoreV3 } from "./useFriendStoreV3";

export const useFriendObjects = () => {
  const friendList = useFriendStoreV3((s) => s.friendList || []);
  const friendDetailsMap = useFriendStoreV3((s) => s.friendDetailsMap || {});
  const friendRelationsMap = useFriendStoreV3((s) => s.friendRelationsMap || {});

  return useMemo(() => {
    return friendList.map((item) => {
      // Handle both cases: item can be a full object or just a uid string
      const uid = typeof item === 'string' ? item : item?.uid;
      if (!uid) return null;

      return {
        uid,
        ...(typeof item === 'object' ? item : {}),
        ...friendDetailsMap[uid],
        relation: friendRelationsMap[uid] || {},
      };
    }).filter(Boolean); // Remove null entries
  }, [friendList, friendDetailsMap, friendRelationsMap]);
};

export const useFriendList = () => {
  const friendList = useFriendStoreV3((s) => s.friendList || []);
  return useMemo(() => {
    return friendList.map((item) => typeof item === 'string' ? item : item?.uid).filter(Boolean);
  }, [friendList]);
};

export const useFriendInfo = (uid) =>
  useFriendStoreV3((s) => s.friendDetailsMap?.[uid]);

export const useFriendRelation = (uid) =>
  useFriendStoreV3((s) => s.friendRelationsMap?.[uid]);

export const useFriendDetailsMap = () =>
  useFriendStoreV3((s) => s.friendDetailsMap || {});

export const useNormalFriendIds = () => {
  const friendIds = useFriendList();
  const friendDetailsMap = useFriendDetailsMap();

  return useMemo(() => {
    return friendIds.filter((uid) => {
      const info = friendDetailsMap[uid];
      return !info?.isCelebrity;
    });
  }, [friendIds, friendDetailsMap]);
};
