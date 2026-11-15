export const reconcileFriendDetails = (localDetails = [], apiFriends = []) => {
  const activeFriendIds = new Set(
    apiFriends.map((friend) => friend?.uid).filter(Boolean),
  );

  return localDetails.filter(
    (friend) => friend?.uid && activeFriendIds.has(friend.uid),
  );
};

export const getMissingFriendDetails = (details = [], apiFriends = []) => {
  const detailedFriendIds = new Set(
    details.map((friend) => friend?.uid).filter(Boolean),
  );

  return apiFriends.filter(
    (friend) => friend?.uid && !detailedFriendIds.has(friend.uid),
  );
};

export const mergeUniqueFriendDetails = (...detailGroups) => {
  const detailsByUid = new Map();

  for (const friend of detailGroups.flat()) {
    if (friend?.uid) detailsByUid.set(friend.uid, friend);
  }

  return [...detailsByUid.values()];
};
