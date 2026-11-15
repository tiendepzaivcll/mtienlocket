import { useCallback, useEffect, useRef, useState } from "react";
import { getListRequestFriendV2, getOutgoingRequestFriend, loadFriendDetailsV3 } from "@/services";
import { getToken } from "@/utils";
import { mergeRequestProfiles } from "@/utils/friendRequestProfiles";

export function useFriendRequests(open, direction) {
  const localId = getToken()?.localId;
  const [friends, setFriends] = useState([]);
  const [nextPageToken, setNextPageToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [showAllFriends, setShowAllFriends] = useState(false);
  const generation = useRef(0);
  const account = useRef(localId);

  const fetchFriendRequests = useCallback(async (pageToken = null) => {
    const requestId = ++generation.current;
    if (!localId) { setLoading(false); return; }
    setLoading(true);
    setErrorMessage(null);
    try {
      const result = await (direction === "incoming" ? getListRequestFriendV2 : getOutgoingRequestFriend)(pageToken);
      if (requestId !== generation.current) return;
      if (result.errorMessage) throw new Error(String(result.errorMessage));
      const requests = result.friends || [];
      // Show the actual request even when its profile cannot be fetched.
      setFriends((previous) => mergeRequestProfiles(pageToken ? [...previous, ...requests] : requests, previous));
      setNextPageToken(result.nextPageToken || null);
      const profiles = await loadFriendDetailsV3(requests);
      if (requestId !== generation.current) return;
      setFriends((previous) => mergeRequestProfiles(previous, [...previous, ...profiles]));
    } catch (error) {
      if (requestId === generation.current) setErrorMessage(error.message || "Chưa tải được yêu cầu kết bạn.");
    } finally {
      if (requestId === generation.current) setLoading(false);
    }
  }, [direction, localId]);

  useEffect(() => {
    if (account.current !== localId) { setFriends([]); account.current = localId; }
    if (open) { setShowAllFriends(false); fetchFriendRequests(); }
    else setLoading(false);
    return () => { generation.current += 1; };
  }, [open, localId, fetchFriendRequests]);

  return { friends, setFriends, nextPageToken, loading, errorMessage,
    showAllFriends, setShowAllFriends, fetchFriendRequests };
}
