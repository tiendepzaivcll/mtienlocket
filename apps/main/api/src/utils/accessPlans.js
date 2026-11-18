// Shared VIP & AI Filter plan definitions, role normalization, and automatic expiration resolution.

const DAY_MS = 24 * 60 * 60 * 1000;

const VIP_PLANS = [
  {
    id: "vip_1month",
    name: "VIP 1 Tháng",
    description: "Trải nghiệm đầy đủ tính năng VIP trong 1 tháng",
    price: 25000,
    days: 30,
    category: "vip",
    badge: null,
  },
  {
    id: "vip_6months",
    name: "VIP 6 Tháng",
    description: "Tiết kiệm 34% so với gói tháng",
    price: 99000,
    days: 180,
    category: "vip",
    badge: "Phổ biến",
  },
  {
    id: "vip_1year",
    name: "VIP 1 Năm",
    description: "Tiết kiệm 50% — ưu đãi tốt nhất",
    price: 149000,
    days: 365,
    category: "vip",
    badge: "Tốt nhất",
  },
];

const AI_FILTER_PLANS = [
  {
    id: "ai_1month",
    name: "AI Filter 1 Tháng",
    description: "Mở khoá bộ lọc ảnh AI trong 1 tháng (dùng cho cả Free & VIP)",
    price: 19000,
    days: 30,
    category: "ai_filter",
    badge: null,
  },
  {
    id: "ai_6months",
    name: "AI Filter 6 Tháng",
    description: "Tiết kiệm 31% so với gói tháng",
    price: 79000,
    days: 180,
    category: "ai_filter",
    badge: "Phổ biến",
  },
  {
    id: "ai_1year",
    name: "AI Filter 1 Năm",
    description: "Tiết kiệm 43% — dùng trọn năm không lo gián đoạn",
    price: 129000,
    days: 365,
    category: "ai_filter",
    badge: "Tốt nhất",
  },
];

const ALL_PLANS = [...VIP_PLANS, ...AI_FILTER_PLANS];
const PLANS_MAP = new Map(ALL_PLANS.map((plan) => [plan.id, plan]));

const VALID_ROLES = new Set(["vip", "celebrity", "free"]);

const isApprovedDocEnabled = (data = {}) =>
  data.active !== false &&
  data.approved !== false &&
  data.enabled !== false &&
  data.disabled !== true;

const normalizeAccessRole = (value, fallback = "free") => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (VALID_ROLES.has(normalized)) return normalized;
  return fallback;
};

const toTimestampMs = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if (typeof value === "object") {
    if (typeof value.toMillis === "function") {
      const ms = Number(value.toMillis());
      return Number.isFinite(ms) && ms > 0 ? ms : null;
    }
    const seconds = Number(value._seconds ?? value.seconds);
    if (Number.isFinite(seconds) && seconds > 0) {
      return seconds * 1000;
    }
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d+$/.test(trimmed)) {
      const num = Number(trimmed);
      return Number.isFinite(num) && num > 0 ? num : null;
    }
    const parsed = Date.parse(trimmed);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
};

const formatVipPlanName = ({ vipPlanId, vipPlanName, vipPlanDays, role } = {}) => {
  if (vipPlanName && typeof vipPlanName === "string") return vipPlanName;
  if (vipPlanId && PLANS_MAP.has(vipPlanId)) return PLANS_MAP.get(vipPlanId).name;
  const days = Number(vipPlanDays);
  if (days === 365 || days === 366) return "VIP 1 Năm";
  if (days === 180 || days === 183) return "VIP 6 Tháng";
  if (days === 90 || days === 91) return "VIP 3 Tháng";
  if (days === 30 || days === 31) return "VIP 1 Tháng";
  if (Number.isFinite(days) && days > 0) return `VIP ${days} Ngày`;
  if (role === "vip") return "VIP Vĩnh viễn";
  return null;
};

const formatAiFilterPlanName = ({
  aiFilterPlanId,
  aiFilterPlanName,
  aiFilterPlanDays,
  aiFilterEnabled,
} = {}) => {
  if (aiFilterPlanName && typeof aiFilterPlanName === "string") return aiFilterPlanName;
  if (aiFilterPlanId && PLANS_MAP.has(aiFilterPlanId)) {
    return PLANS_MAP.get(aiFilterPlanId).name;
  }
  const days = Number(aiFilterPlanDays);
  if (days === 365 || days === 366) return "AI Filter 1 Năm";
  if (days === 180 || days === 183) return "AI Filter 6 Tháng";
  if (days === 90 || days === 91) return "AI Filter 3 Tháng";
  if (days === 30 || days === 31) return "AI Filter 1 Tháng";
  if (Number.isFinite(days) && days > 0) return `AI Filter ${days} Ngày`;
  if (aiFilterEnabled) return "AI Filter Vĩnh viễn";
  return null;
};

const resolveAdminVipSelection = ({ vipPlanId, planDays } = {}, now = Date.now()) => {
  if (vipPlanId && PLANS_MAP.has(vipPlanId)) {
    const plan = PLANS_MAP.get(vipPlanId);
    if (plan.category === "vip") {
      return {
        vipPlanId: plan.id,
        vipPlanName: plan.name,
        vipPlanDays: plan.days,
        vipExpireAt: now + plan.days * DAY_MS,
      };
    }
  }

  const parsedDays = Number(planDays);
  if (Number.isFinite(parsedDays) && parsedDays > 0) {
    const matched = VIP_PLANS.find((p) => p.days === parsedDays);
    return {
      vipPlanId: matched ? matched.id : `vip_${parsedDays}d`,
      vipPlanName: formatVipPlanName({ vipPlanDays: parsedDays }),
      vipPlanDays: parsedDays,
      vipExpireAt: now + parsedDays * DAY_MS,
    };
  }

  return {
    vipPlanId: "vip_lifetime",
    vipPlanName: "VIP Vĩnh viễn",
    vipPlanDays: null,
    vipExpireAt: null,
  };
};

const resolveAdminAiSelection = (
  { aiFilterPlanId, aiFilterPlanDays } = {},
  now = Date.now(),
) => {
  if (aiFilterPlanId && PLANS_MAP.has(aiFilterPlanId)) {
    const plan = PLANS_MAP.get(aiFilterPlanId);
    if (plan.category === "ai_filter") {
      return {
        aiFilterPlanId: plan.id,
        aiFilterPlanName: plan.name,
        aiFilterPlanDays: plan.days,
        aiFilterExpireAt: now + plan.days * DAY_MS,
      };
    }
  }

  const parsedDays = Number(aiFilterPlanDays);
  if (Number.isFinite(parsedDays) && parsedDays > 0) {
    const matched = AI_FILTER_PLANS.find((p) => p.days === parsedDays);
    return {
      aiFilterPlanId: matched ? matched.id : `ai_${parsedDays}d`,
      aiFilterPlanName: formatAiFilterPlanName({ aiFilterPlanDays: parsedDays }),
      aiFilterPlanDays: parsedDays,
      aiFilterExpireAt: now + parsedDays * DAY_MS,
    };
  }

  return {
    aiFilterPlanId: "ai_lifetime",
    aiFilterPlanName: "AI Filter Vĩnh viễn",
    aiFilterPlanDays: null,
    aiFilterExpireAt: null,
  };
};

/**
 * Evaluates effective VIP and AI Filter entitlements for an approved_users record.
 * Automatically detects expired VIP (downgrades to "free") and expired AI Filter
 * (sets aiFilterEnabled = false), returning an exact Firestore patch if persisted state changed.
 */
const resolveEffectiveAccess = (data = {}, now = Date.now()) => {
  const isEnabled = isApprovedDocEnabled(data);
  // Legacy docs created before explicit role tracking defaulted to "vip".
  const rawRole = normalizeAccessRole(data.role, "vip");

  const vipExpireAt = toTimestampMs(data.vipExpireAt);
  const vipExpired = rawRole === "vip" && vipExpireAt !== null && now > vipExpireAt;
  const effectiveRole = vipExpired ? "free" : rawRole;

  const rawVipPlanName = formatVipPlanName({
    vipPlanId: data.vipPlanId,
    vipPlanName: data.vipPlanName,
    vipPlanDays: data.vipPlanDays,
    role: rawRole,
  });

  const aiExpireAt = toTimestampMs(data.aiFilterExpireAt);
  const rawAiEnabled = data.aiFilterEnabled === true;
  const aiExpired = rawAiEnabled && aiExpireAt !== null && now > aiExpireAt;
  const effectiveAiEnabled = isEnabled && rawAiEnabled && !aiExpired;

  const rawAiPlanName = formatAiFilterPlanName({
    aiFilterPlanId: data.aiFilterPlanId,
    aiFilterPlanName: data.aiFilterPlanName,
    aiFilterPlanDays: data.aiFilterPlanDays,
    aiFilterEnabled: rawAiEnabled,
  });

  const downgradePatch = {};
  if (vipExpired) {
    downgradePatch.role = "free";
    downgradePatch.vipPlanId = null;
    downgradePatch.vipPlanName = null;
    downgradePatch.vipPlanDays = null;
    downgradePatch.vipExpireAt = null;
    downgradePatch.lastExpiredVipPlan = rawVipPlanName || "VIP";
    downgradePatch.lastExpiredVipAt = vipExpireAt;
  }

  if (aiExpired) {
    downgradePatch.aiFilterEnabled = false;
    downgradePatch.aiFilterPlanId = null;
    downgradePatch.aiFilterPlanName = null;
    downgradePatch.aiFilterPlanDays = null;
    downgradePatch.aiFilterExpireAt = null;
    downgradePatch.lastExpiredAiPlan = rawAiPlanName || "AI Filter";
    downgradePatch.lastExpiredAiAt = aiExpireAt;
  }

  const needsPersist = vipExpired || aiExpired;
  if (needsPersist) {
    downgradePatch.updatedAt = new Date(now).toISOString();
  }

  return {
    isEnabled,
    rawRole,
    effectiveRole,
    vipExpired,
    vipPlanId: effectiveRole === "vip" ? data.vipPlanId || null : null,
    vipPlanName: effectiveRole === "vip" ? rawVipPlanName : null,
    vipPlanDays: effectiveRole === "vip" ? Number(data.vipPlanDays) || null : null,
    vipExpireAt: effectiveRole === "vip" ? vipExpireAt : null,
    effectiveAiEnabled,
    aiExpired,
    aiFilterPlanId: effectiveAiEnabled ? data.aiFilterPlanId || null : null,
    aiFilterPlanName: effectiveAiEnabled ? rawAiPlanName : null,
    aiFilterPlanDays: effectiveAiEnabled ? Number(data.aiFilterPlanDays) || null : null,
    aiFilterExpireAt: effectiveAiEnabled ? aiExpireAt : null,
    lastExpiredVipPlan: vipExpired
      ? rawVipPlanName || "VIP"
      : data.lastExpiredVipPlan || null,
    lastExpiredVipAt: vipExpired ? vipExpireAt : toTimestampMs(data.lastExpiredVipAt),
    needsPersist,
    downgradePatch,
  };
};

module.exports = {
  DAY_MS,
  VIP_PLANS,
  AI_FILTER_PLANS,
  ALL_PLANS,
  PLANS_MAP,
  VALID_ROLES,
  isApprovedDocEnabled,
  normalizeAccessRole,
  toTimestampMs,
  formatVipPlanName,
  formatAiFilterPlanName,
  resolveAdminVipSelection,
  resolveAdminAiSelection,
  resolveEffectiveAccess,
};
