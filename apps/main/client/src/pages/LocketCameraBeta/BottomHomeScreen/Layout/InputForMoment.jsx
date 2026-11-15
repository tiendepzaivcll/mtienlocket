import { useState, useEffect, useRef, useContext } from "react";
import { ArrowUp, SmilePlus } from "lucide-react";
import clsx from "clsx";
import { useApp } from "@/context/AppContext";
import {
  GetInfoMoment,
  GetViewsMoment,
  MarkReactionAsViewed,
  SendMessageMoment,
  SendReactMoment,
} from "@/services";
import { getMomentById } from "@/cache/momentDB";
import { SonnerError, SonnerSuccess } from "@/components/ui/SonnerToast";
import { getFriendDetail } from "@/cache/friendsDB";
import { fetchUserV2 } from "@/services/LocketDioServices/FriendsServices";
import ActivitySection from "../Modal/ActivityViews/ActivityModal";
import { markMomentViewedOnce } from "@/cache/viewedMomentDB";
import { useAuthStore } from "@/stores";
import { normalizeFriendDataV2, normalizeTimestampMillis } from "@/utils";

const getActivityUserId = (item = {}) =>
  item?.user ||
  item?.user_uid ||
  item?.viewer_uid ||
  item?.uid ||
  item?.user_id ||
  item?.localId ||
  item?.id ||
  null;

const getActivityTime = (item = {}) =>
  normalizeActivityTime(
    item?.viewed_at ||
      item?.viewedAt ||
      item?.created_at ||
      item?.createdAt ||
      item?.timestamp ||
      item?.date ||
      null,
  );

const getReactionTime = (reaction = {}) =>
  normalizeActivityTime(
    reaction?.createdAt ||
      reaction?.created_at ||
      reaction?.updatedAt ||
      reaction?.updated_at ||
      reaction?.date ||
      reaction?.timestamp ||
      null
  );

const normalizeActivityTime = (value) => {
  return normalizeTimestampMillis(value);
};

const getReactionEmoji = (reaction = {}) =>
  reaction?.emoji || reaction?.string || reaction?.reaction || reaction?.value || null;

const normalizeActivityReactions = (reactions) => {
  if (Array.isArray(reactions)) return reactions;

  if (reactions && typeof reactions === "object") {
    return Object.entries(reactions).map(([uid, reaction]) => ({
      ...(reaction && typeof reaction === "object" ? reaction : {}),
      user:
        reaction?.user ||
        reaction?.user_uid ||
        reaction?.uid ||
        reaction?.user_id ||
        uid,
      emoji:
        reaction?.emoji ||
        reaction?.reaction ||
        reaction?.value ||
        (typeof reaction === "string" ? reaction : null),
      reaction:
        reaction?.reaction ||
        reaction?.emoji ||
        reaction?.value ||
        (typeof reaction === "string" ? reaction : null),
    }));
  }

  return [];
};

const getReactionKey = (reaction = {}, index = 0) =>
  reaction.id ||
  `${getActivityUserId(reaction) || `anonymous:${index}`}:${getReactionEmoji(reaction) || ""}:${getTimeValue(getReactionTime(reaction)) || "no-time"}`;

const mergeActivityReactions = (...reactionGroups) => {
  const map = new Map();

  reactionGroups
    .flatMap((group) => normalizeActivityReactions(group))
    .forEach((reaction, index) => {
      const key = getReactionKey(reaction, index);
      if (!map.has(key)) map.set(key, reaction);
    });

  return Array.from(map.values());
};

const getLatestReactionsByUser = (reactions = [], allowedEmojis = null) => {
  const map = new Map();
  let anonymousIndex = 0;

  normalizeActivityReactions(reactions).forEach((reaction) => {
    const emoji = getReactionEmoji(reaction);
    if (!emoji) return;
    if (allowedEmojis && !allowedEmojis.includes(emoji)) return;

    const uid = getActivityUserId(reaction) || `anonymous:${anonymousIndex++}`;
    const current = map.get(uid);
    const currentTime = getTimeValue(getReactionTime(current));
    const nextTime = getTimeValue(getReactionTime(reaction));

    if (!current || nextTime >= currentTime) {
      map.set(uid, {
        ...reaction,
        user: uid,
        emoji,
        reaction: reaction.reaction || emoji,
      });
    }
  });

  return map;
};

const getLatestNonPollReactionsByUser = (reactions = [], pollEmojis = null) => {
  const pollEmojiList = pollEmojis ? [pollEmojis.left, pollEmojis.right] : [];
  const map = new Map();
  let anonymousIndex = 0;

  normalizeActivityReactions(reactions).forEach((reaction) => {
    const emoji = getReactionEmoji(reaction);
    if (!emoji || pollEmojiList.includes(emoji)) return;

    const uid = getActivityUserId(reaction) || `anonymous:${anonymousIndex++}`;
    const current = map.get(uid);
    const currentTime = getTimeValue(getReactionTime(current));
    const nextTime = getTimeValue(getReactionTime(reaction));

    if (!current || nextTime >= currentTime) {
      map.set(uid, {
        ...reaction,
        user: uid,
        emoji,
        reaction: reaction.reaction || emoji,
      });
    }
  });

  return map;
};

const shortenUid = (uid = "") =>
  uid ? `${uid.slice(0, 8)}...${uid.slice(-4)}` : "Ẩn danh";

const buildFallbackUser = (uid, currentUser = null, localId = null) => {
  if (uid && uid === localId) {
    return {
      uid,
      firstName: "Bạn",
      lastName: "",
      username: currentUser?.username || currentUser?.email || "",
      profilePic:
        currentUser?.profilePic ||
        currentUser?.profilePicture ||
        currentUser?.photoURL ||
        currentUser?.picture ||
        "",
    };
  }

  return {
    uid,
    firstName: shortenUid(uid),
    lastName: "",
    username: "",
    profilePic: "",
  };
};

const getActivityUserInfo = async (uid, currentUser = null, localId = null) => {
  if (!uid) return buildFallbackUser(uid, currentUser, localId);

  try {
    const cached = await getFriendDetail(uid);
    if (cached) return cached;
  } catch (error) {
    console.warn("Không lấy được cache người xem:", error);
  }

  if (uid === localId) {
    return buildFallbackUser(uid, currentUser, localId);
  }

  try {
    const remote = await fetchUserV2(uid);
    const normalized = normalizeFriendDataV2(remote);
    if (normalized) return normalized;
  } catch (error) {
    console.warn("Không fetch được thông tin người xem:", error);
  }

  return buildFallbackUser(uid, currentUser, localId);
};

const getReactionId = (reaction = {}) =>
  reaction?.id || reaction?.reaction_uid || reaction?.reactionUid || null;

const markReactionsViewed = (momentId, reactions = []) => {
  const marked = new Set();

  reactions.forEach((reaction) => {
    const reactionId = getReactionId(reaction);
    const createdAt = getReactionTime(reaction);
    if (!reactionId || !createdAt || marked.has(reactionId)) return;

    marked.add(reactionId);
    MarkReactionAsViewed({
      momentId,
      reactionId,
      createdAt,
    });
  });
};

const getPollEmojis = (moment = {}) => {
  const payload = moment?.overlays?.payload || {};
  if (moment?.overlays?.captionType !== "poll" && moment?.overlays?.id !== "caption:poll") {
    return null;
  }

  return {
    left: payload.left_emoji || "👍",
    right: payload.right_emoji || "👎",
  };
};

const getPollPayload = (moment = {}) => moment?.overlays?.payload || {};

const getPollCountFromPayload = (payload = {}, side) => {
  const keys =
    side === "left"
      ? ["left_count", "leftCount", "left_votes", "leftVotes"]
      : ["right_count", "rightCount", "right_votes", "rightVotes"];

  for (const key of keys) {
    const value = Number(payload[key]);
    if (Number.isFinite(value)) return value;
  }

  return 0;
};

const getPollSummary = (reactions = [], pollEmojis = null, payload = {}) => {
  if (!pollEmojis) return null;

  const votesByUser = getLatestReactionsByUser(reactions, [
    pollEmojis.left,
    pollEmojis.right,
  ]);
  const voters = Array.from(votesByUser.values());
  const reactionLeftCount = voters.filter((vote) => vote.emoji === pollEmojis.left).length;
  const reactionRightCount = voters.filter((vote) => vote.emoji === pollEmojis.right).length;
  const fallbackLeftCount = getPollCountFromPayload(payload, "left");
  const fallbackRightCount = getPollCountFromPayload(payload, "right");
  const leftCount = reactionLeftCount || fallbackLeftCount;
  const rightCount = reactionRightCount || fallbackRightCount;

  return {
    leftEmoji: pollEmojis.left,
    rightEmoji: pollEmojis.right,
    leftCount,
    rightCount,
    total: voters.length || leftCount + rightCount,
  };
};

const isPollVoteReaction = (reaction = {}, pollEmojis = null) => {
  if (!pollEmojis) return false;
  const emoji = getReactionEmoji(reaction);
  return emoji === pollEmojis.left || emoji === pollEmojis.right;
};

const excludeOwnPollVotes = (reactions = [], pollEmojis = null, localId = null) => {
  if (!pollEmojis || !localId) return reactions;

  return normalizeActivityReactions(reactions).filter((reaction) => {
    const uid = getActivityUserId(reaction);
    return !(uid === localId && isPollVoteReaction(reaction, pollEmojis));
  });
};

const getTimeValue = (value) => {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (value?._seconds) return value._seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const InputForMoment = () => {
  const { user } = useAuthStore();
  const localId = user?.localId || null;

  const {
    reactionInfo,
    setReactionInfo,
    selectedMoment,
    selectedMomentId,
    showEmojiPicker,
    setShowEmojiPicker,
  } = useApp().post;

  const {
    showFlyingEffect,
    setShowFlyingEffect,
    flyingEmojis,
    setFlyingEmojis,
  } = useApp().navigation;

  const [showFullInput, setShowFullInput] = useState(false);
  const [message, setMessage] = useState("");
  const [reactionPower, setReactionPower] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [holdingEmoji, setHoldingEmoji] = useState(null);
  const holdInterval = useRef(null);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  const [momentUser, setMomentUser] = useState(null);
  const [userDetail, setUserDetail] = useState(null);
  const [isPublic, setIsPublic] = useState(true);

  const [activity, setActivity] = useState([]);
  const [pollSummary, setPollSummary] = useState(null);

  // ✅ Loading states
  const [isLoadingMoment, setIsLoadingMoment] = useState(true);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isSendingReaction, setIsSendingReaction] = useState(false);

  // ---- CÁC HÀM CŨ ----
  const sendReact = async (emoji, power = 0) => {
    if (isSendingReaction) return;

    try {
      setIsSendingReaction(true);
      setFlyingEmojis(emoji);
      setShowFlyingEffect(true);
      const res = await SendReactMoment(emoji, selectedMomentId, power);
      SonnerSuccess(`Gửi cảm xúc thành công!`);
      setShowEmojiPicker(false);
    } catch (error) {
      SonnerError("Gửi cảm xúc thất bại!");
      console.error("Lỗi khi gửi react:", error);
    } finally {
      setIsSendingReaction(false);
    }
  };

  const handleHoldStart = (emoji) => {
    if (isSendingReaction) return;

    setIsHolding(true);
    setHoldingEmoji(emoji);
    setReactionPower(0);
    holdInterval.current = setInterval(() => {
      setReactionPower((prev) => (prev >= 1000 ? 1000 : prev + 1));
    }, 0.1);
  };

  const handleHoldEnd = (emoji) => {
    if (holdInterval.current) clearInterval(holdInterval.current);
    if (isHolding && !isSendingReaction) sendReact(emoji, reactionPower);
    setIsHolding(false);
    setHoldingEmoji(null);
    setReactionPower(0);
  };

  useEffect(() => {
    const fetchMomentAndUser = async () => {
      try {
        setIsLoadingMoment(true);
        const moment = await getMomentById(selectedMomentId);
        const ownerUid = moment?.user || selectedMoment?.user || null;
        setIsPublic(moment?.isPublic ?? selectedMoment?.isPublic ?? true);
        setMomentUser(ownerUid);

        if (ownerUid) {
          const data = await getFriendDetail(ownerUid);
          setUserDetail(data);
        }
      } catch (err) {
        console.error("Lỗi khi lấy moment hoặc user:", err);
      } finally {
        setIsLoadingMoment(false);
      }
    };

    if (selectedMomentId) {
      fetchMomentAndUser();
    }
  }, [selectedMomentId, selectedMoment]);

  useEffect(() => {
    if (!selectedMomentId || !momentUser) return;

    const markViewed = async () => {
      try {
        // await markMomentViewedOnce({
        //   id: selectedMomentId,
        //   user: momentUser,
        // });
      } catch (err) {
        console.error("❌ Lỗi mark viewed:", err);
      }
    };

    markViewed();
  }, [selectedMomentId, momentUser]);

  const handleSend = async () => {
    if (isSendingMessage || !message.trim()) return;

    try {
      setIsSendingMessage(true);
      const moment = await getMomentById(selectedMomentId);
      const momentId = moment?.id || selectedMoment?.id || selectedMomentId;
      const receiverUid = moment?.user || selectedMoment?.user || momentUser;

      if (!momentId || !receiverUid) {
        SonnerError("Không tìm thấy người nhận tin nhắn.");
        return;
      }

      await SendMessageMoment(message, momentId, receiverUid);
      setMessage("");
      setShowFullInput(false);
      SonnerSuccess("Gửi tin nhắn thành công!");
    } catch (error) {
      SonnerError("Gửi tin nhắn thất bại!");
      console.error("❌ Lỗi khi gửi message:", error);
    } finally {
      setIsSendingMessage(false);
    }
  };

  const fullName = `${userDetail?.firstName || ""} ${
    userDetail?.lastName || ""
  }`.trim();
  const shortName =
    fullName.length > 10 ? fullName.slice(0, 10) + "…" : fullName;

  useEffect(() => {
    if (localId && momentUser && localId === momentUser && selectedMomentId) {
      const fetchMyMoment = async () => {
        try {
          setIsLoadingActivity(true);
          const [info, views] = await Promise.all([
            GetInfoMoment(selectedMomentId),
            GetViewsMoment(selectedMomentId),
          ]);
          const cachedMoment = await getMomentById(selectedMomentId);
          const reactions = mergeActivityReactions(
            info?.reactions,
            cachedMoment?.reactions,
          );
          markReactionsViewed(selectedMomentId, reactions);
          const pollEmojis =
            getPollEmojis(info) ||
            getPollEmojis(cachedMoment) ||
            getPollEmojis(selectedMoment);
          const pollPayload = {
            ...getPollPayload(cachedMoment),
            ...getPollPayload(info),
          };
          const displayReactions = excludeOwnPollVotes(
            reactions,
            pollEmojis,
            localId
          );
          setPollSummary(getPollSummary(displayReactions, pollEmojis, pollPayload));
          const momentViews = Array.isArray(views?.moment_views)
            ? views.moment_views
            : [];
          const activityByUid = new Map();

          momentViews.forEach((view) => {
            const uid = getActivityUserId(view);
            if (!uid) return;
            activityByUid.set(uid, {
              uid,
              viewedAt: getActivityTime(view),
              reaction: null,
              vote: null,
            });
          });

          const latestVotes = pollEmojis
            ? getLatestReactionsByUser(displayReactions, [
                pollEmojis.left,
                pollEmojis.right,
              ])
            : new Map();
          const latestReactions = getLatestNonPollReactionsByUser(
            displayReactions,
            pollEmojis
          );

          latestVotes.forEach((vote) => {
            const uid = getActivityUserId(vote);
            if (!uid) return;
            const emoji = getReactionEmoji(vote);
            const current = activityByUid.get(uid) || {
              uid,
              viewedAt: null,
              reaction: null,
              vote: null,
            };

            activityByUid.set(uid, {
              ...current,
              vote: {
                emoji: emoji || "💛",
                intensity: vote.intensity || 0,
                createdAt: getReactionTime(vote),
              },
            });
          });

          latestReactions.forEach((reaction) => {
            const uid = getActivityUserId(reaction);
            if (!uid) return;
            const emoji = getReactionEmoji(reaction);
            const current = activityByUid.get(uid) || {
              uid,
              viewedAt: null,
              reaction: null,
              vote: null,
            };

            activityByUid.set(uid, {
              ...current,
              reaction: {
                emoji: emoji || "💛",
                intensity: reaction.intensity || 0,
                createdAt: getReactionTime(reaction),
              },
            });
          });

          const merged = await Promise.all(
            Array.from(activityByUid.values()).map(async (item) => {
              const userInfo = await getActivityUserInfo(item.uid, user, localId);

              return {
                user: userInfo,
                viewedAt: item.viewedAt,
                reaction: item.reaction,
                vote: item.vote,
              };
            })
          );

          setActivity(
            merged.sort((a, b) => {
              const timeA = getTimeValue(
                a.reaction?.createdAt || a.vote?.createdAt || a.viewedAt
              );
              const timeB = getTimeValue(
                b.reaction?.createdAt || b.vote?.createdAt || b.viewedAt
              );
              return timeB - timeA;
            })
          );
        } catch (err) {
          console.error("❌ Lỗi khi gọi GetInfoMoment:", err);
          setPollSummary(null);
        } finally {
          setIsLoadingActivity(false);
        }
      };

      fetchMyMoment();
    }
  }, [localId, momentUser, selectedMomentId]);

  useEffect(() => {
    if (!showFullInput) return; // chỉ chạy khi đang mở input

    const handleClickOutside = (e) => {
      // nếu click bên ngoài vùng input
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowFullInput(false);
      }
    };

    // lắng nghe click
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [showFullInput]);

  return (
    <>
      {localId && momentUser && localId === momentUser ? (
        <ActivitySection
          isPublic={isPublic}
          activity={activity}
          pollSummary={pollSummary}
          isLoading={isLoadingActivity}
        />
      ) : (
        <>
          {/* ✅ Input hiện khi gõ */}
          {showFullInput && (
            <div ref={wrapperRef} className="z-50 w-full">
              <div className="relative w-full">
                <div className="flex w-full items-center gap-3 px-4 py-3.5 bg-base-200 rounded-3xl shadow-md">
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder={`Trả lời ${shortName}`}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    disabled={isSendingMessage || userDetail?.isCelebrity}
                    className="flex-1 bg-transparent focus:outline-none font-semibold pl-1 disabled:opacity-50"
                  />
                  <button
                    onClick={handleSend}
                    disabled={
                      isSendingMessage ||
                      !message.trim() ||
                      userDetail?.isCelebrity
                    }
                    className="btn absolute right-3 p-1 btn-sm bg-base-300 btn-circle flex justify-center items-center disabled:opacity-50"
                  >
                    {isSendingMessage ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-base-content"></div>
                    ) : (
                      <ArrowUp className="text-base-content w-7 h-7" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ✅ Khung rút gọn */}
          {!showFullInput && (
            <div className="w-full">
              <div className="relative w-full">
                <div
                  className={clsx(
                    "flex items-center w-full px-4 py-3.5 rounded-3xl bg-base-200 shadow-md",
                    userDetail?.isCelebrity
                      ? "cursor-not-allowed opacity-70"
                      : "cursor-text"
                  )}
                  onClick={() => {
                    if (!userDetail?.isCelebrity) setShowFullInput(true);
                  }}
                >
                  <span className="flex-1 text-md text-base-content/60 font-semibold pl-1">
                    Gửi tin nhắn...
                  </span>
                </div>

                {/* ✅ Icon cảm xúc */}
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-4 pointer-events-auto px-2">
                  {["🤣", "💛", "💩"].map((emoji) => (
                    <button
                      key={emoji}
                      title={emoji}
                      disabled={isSendingReaction}
                      onMouseDown={() => handleHoldStart(emoji)}
                      onMouseUp={() => handleHoldEnd(emoji)}
                      onMouseLeave={() => handleHoldEnd(emoji)}
                      onTouchStart={() => handleHoldStart(emoji)}
                      onTouchEnd={() => handleHoldEnd(emoji)}
                      className={`cursor-pointer select-none text-3xl transition-transform disabled:opacity-50 ${
                        holdingEmoji === emoji ? "shake" : ""
                      } ${isSendingReaction ? "pointer-events-none" : ""}`}
                    >
                      <span>{emoji}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={isSendingReaction}
                    className="cursor-pointer relative disabled:opacity-50"
                    onClick={() => setShowEmojiPicker((prev) => !prev)}
                  >
                    <SmilePlus className="w-8 h-8" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
};

export default InputForMoment;
