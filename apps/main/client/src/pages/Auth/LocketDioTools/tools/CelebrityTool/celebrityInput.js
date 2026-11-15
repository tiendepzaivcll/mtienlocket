const USERNAME_PATTERN = /^[a-z0-9._-]{1,64}$/i;

export const normalizeCelebrityInput = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  let username = raw;
  const looksLikeUrl =
    /^https?:\/\//i.test(raw) || /^(?:www\.)?locket\.cam\//i.test(raw);

  if (looksLikeUrl) {
    try {
      const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
      if (!["locket.cam", "www.locket.cam"].includes(url.hostname.toLowerCase())) {
        return "";
      }
      username = decodeURIComponent(url.pathname.split("/").filter(Boolean)[0] || "");
    } catch {
      return "";
    }
  } else {
    username = raw.replace(/^@+/, "").split(/[?#]/)[0];
  }

  username = username.replace(/^@+/, "").replace(/\/+$/, "").trim();
  return USERNAME_PATTERN.test(username) ? username.toLowerCase() : "";
};

export const celebrityProfileUrl = (username) =>
  `https://locket.cam/${encodeURIComponent(String(username || "").trim())}`;

export const hasCelebritySlotData = (user) => {
  const friendCount = Number(user?.celebrity_data?.friend_count);
  const maxFriends = Number(user?.celebrity_data?.max_friends);
  return (
    Boolean(user?.uid) &&
    Number.isFinite(friendCount) &&
    friendCount >= 0 &&
    Number.isFinite(maxFriends) &&
    maxFriends > 0
  );
};
