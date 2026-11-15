// src/store/friend/friend.sync.js
import {
  getFriendIds,
  getAllFriendDetails,
  setFriendIds,
  setFriendDetailsBulk,
  removeFriendToCache,
} from "@/cache/friendsDB";
import { addRemovedFriend } from "@/cache/diaryDB";
import { getListIdFriends, loadFriendDetailsV3 } from "@/services";
import { diffFriendIds } from "./diffFriendIds";
import {
  getMissingFriendDetails,
  mergeUniqueFriendDetails,
  reconcileFriendDetails,
} from "./friendSyncPolicy";

export const syncFriendsWithServer = async () => {
  let localDetails = await getAllFriendDetails();

  // [{ uid, hidden, sharedHistoryOn, isCelebrity, createdAt, updatedAt }]
  const apiFriends = await getListIdFriends();

  // null means the request failed: keep the offline cache intact.
  if (apiFriends === null) {
    return {
      details: localDetails,
      friendRelationsMap: {},
    };
  }

  // 👉 build friendRelationsMap full data
  const friendRelationsMap = Object.fromEntries(
    apiFriends.map((f) => [
      f.uid,
      {
        hidden: f.hidden ?? false,
        sharedHistoryOn: f.sharedHistoryOn ?? null,
        isCelebrity: f.isCelebrity ?? false,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
      },
    ])
  );

  const cachedIds = await getFriendIds();
  const { removedIds } = diffFriendIds(apiFriends, cachedIds);

  // REMOVE
  if (removedIds.length > 0) {
    for (const f of removedIds) {
      await removeFriendToCache(f.uid);
      await addRemovedFriend(f.uid);
    }

    const removedSet = new Set(removedIds.map((f) => f.uid));

    localDetails = localDetails.filter(
      (f) => !removedSet.has(f.uid)
    );

    // remove khỏi relation map luôn cho sạch
    for (const uid of removedSet) {
      delete friendRelationsMap[uid];
    }
  }

  // The server list is authoritative. This also removes orphan detail records
  // that are no longer represented in friendIds (the old 63-vs-59 bug).
  localDetails = reconcileFriendDetails(localDetails, apiFriends);

  // Retry every missing detail, not only newly-added IDs. A previous failed
  // profile request must not leave an ID permanently without its details.
  const missingDetails = getMissingFriendDetails(localDetails, apiFriends);
  if (missingDetails.length > 0) {
    const newDetails = await loadFriendDetailsV3(missingDetails);
    if (newDetails?.length > 0) {
      localDetails = mergeUniqueFriendDetails(localDetails, newDetails);
    }
  }

  // Replace both tables even when the authoritative list is empty.
  await setFriendIds(apiFriends);
  await setFriendDetailsBulk(localDetails);

  return {
    details: localDetails,
    friendRelationsMap,
  };
};
