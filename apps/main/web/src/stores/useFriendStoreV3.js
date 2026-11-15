import { useFriendStoreV2 } from "./friendStore";

// Thiết lập alias cho useFriendStoreV2 để đồng bộ với các component hiện có
export const useFriendStoreV3 = (selector) => {
  if (!selector) return useFriendStoreV2();
  return useFriendStoreV2(selector);
};
