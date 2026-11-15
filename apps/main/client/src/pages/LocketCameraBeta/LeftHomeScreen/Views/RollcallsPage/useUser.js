import { useState, useEffect } from "react";
import { fetchUserById } from "@/services";
import { getFriendDetail } from "@/cache/friendsDB";

const userCache = new Map();
const userInflight = new Map();

async function loadUser(uid) {
  if (userCache.has(uid)) return userCache.get(uid);

  const cachedFriend = await getFriendDetail(uid).catch(() => null);
  if (cachedFriend) {
    userCache.set(uid, cachedFriend);
    return cachedFriend;
  }

  if (userInflight.has(uid)) return userInflight.get(uid);

  const request = fetchUserById(uid)
    .then((user) => {
      if (user) userCache.set(uid, user);
      return user || null;
    })
    .finally(() => userInflight.delete(uid));
  userInflight.set(uid, request);
  return request;
}

/**
 * Hook để fetch thông tin user theo uid
 * @param {string} uid 
 * @returns {object|null} user
 */
export function useUser(uid) {
  const [user, setUser] = useState(() => userCache.get(uid) || null);

  useEffect(() => {
    if (!uid) return;

    let mounted = true;

    loadUser(uid)
      .then((loadedUser) => {
        if (mounted && loadedUser) setUser(loadedUser);
      })
      .catch((err) => console.error("Failed to fetch user:", err));

    return () => {
      mounted = false;
    };
  }, [uid]);

  return user;
}
