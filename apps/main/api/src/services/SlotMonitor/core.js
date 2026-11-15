const SLOT_STATUS = Object.freeze({
  WATCHING: "WATCHING",
  SLOT_OPEN: "SLOT_OPEN",
  REQUESTED: "REQUESTED",
  FRIENDS: "FRIENDS",
  PAUSED: "PAUSED",
  ERROR: "ERROR",
});

function normalizeUsername(value) {
  return String(value || "")
    .trim()
    .replace(/^@+/, "")
    .split(/[/?#]/)[0]
    .toLowerCase()
    .slice(0, 64);
}

function sanitizeWatchInput(raw = {}) {
  const uid = String(raw.uid || raw.celebUid || "").trim().slice(0, 160);
  const username = normalizeUsername(raw.username);
  if (!uid || !username) return null;

  const friendCount = Math.max(0, Number(raw.friendCount) || 0);
  const maxFriends = Math.max(0, Number(raw.maxFriends) || 0);
  return {
    uid,
    username,
    displayName: String(raw.displayName || username).trim().slice(0, 120),
    avatar: String(raw.avatar || "").trim().slice(0, 1000),
    friendCount,
    maxFriends,
  };
}

function extractCelebritySnapshot(result) {
  const payload = result?.result?.data || result?.data || result;
  const user = payload?.user && typeof payload.user === "object"
    ? payload.user
    : payload;
  const celebrity =
    user?.celebrity_data || payload?.celebrity_data || result?.celebrity_data;
  const friendCount = Number(
    celebrity?.friend_count ?? celebrity?.friendCount,
  );
  const maxFriends = Number(
    celebrity?.max_friends ?? celebrity?.maxFriends,
  );
  if (
    !Number.isFinite(friendCount) ||
    friendCount < 0 ||
    !Number.isFinite(maxFriends) ||
    maxFriends <= 0
  ) {
    const error = new Error("Locket chưa trả về dữ liệu slot hợp lệ.");
    error.code = "CELEBRITY_SNAPSHOT_UNAVAILABLE";
    error.status = 502;
    throw error;
  }

  const relationship = String(
    user?.friendship_status || payload?.friendship_status || "none",
  );
  return {
    friendCount,
    maxFriends,
    availableSlots: Math.max(0, maxFriends - friendCount),
    isFull: friendCount >= maxFriends,
    relationship,
  };
}

function computeTransition(previous = {}, snapshot) {
  const previousFriendCount = Number(previous.friendCount) || 0;
  const previousMaxFriends = Number(previous.maxFriends) || 0;
  const previousAvailable = Math.max(0, previousMaxFriends - previousFriendCount);
  const wasFull =
    typeof previous.lastWasFull === "boolean"
      ? previous.lastWasFull
      : previousMaxFriends > 0 && previousFriendCount >= previousMaxFriends;
  const capacityIncreased =
    snapshot.maxFriends > previousMaxFriends &&
    snapshot.availableSlots > previousAvailable;
  const opened = !snapshot.isFull && (wasFull || capacityIncreased);

  let status = snapshot.isFull ? SLOT_STATUS.WATCHING : SLOT_STATUS.SLOT_OPEN;
  let completed = false;
  if (snapshot.relationship === "friends") {
    status = SLOT_STATUS.FRIENDS;
    completed = true;
  } else if (snapshot.relationship === "outgoing-follow-request") {
    status = SLOT_STATUS.REQUESTED;
    completed = true;
  } else if (snapshot.relationship === "follower-waitlist") {
    // Locket's waitlist means the account is still waiting for capacity.
    // Keep the background watch alive until Locket promotes the relationship
    // to an outgoing request/friend, or the user pauses it explicitly.
    status = SLOT_STATUS.WATCHING;
  }

  return {
    friendCount: snapshot.friendCount,
    maxFriends: snapshot.maxFriends,
    availableSlots: snapshot.availableSlots,
    lastWasFull: snapshot.isFull,
    relationship: snapshot.relationship,
    snapshotSource:
      snapshot.snapshotSource || previous.snapshotSource || "username",
    status,
    opened,
    capacityIncreased,
    completed,
  };
}

function decodeFirebaseUid(idToken) {
  try {
    const encoded = String(idToken || "").split(".")[1];
    if (!encoded) return "";
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    return String(payload.user_id || payload.uid || payload.sub || "");
  } catch {
    return "";
  }
}

module.exports = {
  SLOT_STATUS,
  computeTransition,
  decodeFirebaseUid,
  extractCelebritySnapshot,
  normalizeUsername,
  sanitizeWatchInput,
};
