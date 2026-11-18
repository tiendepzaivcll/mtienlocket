// Shared VIP & AI Filter plan definitions, role normalization, and automatic expiration resolution.

const DAY_MS = 24 * 60 * 60 * 1000;

const VIP_PLANS = [
  {
    id: "vip_trial",
    name: "VIP Dùng thử (1 ngày)",
    description: "Trải nghiệm đầy đủ tính năng VIP 24h + 1 ảnh AI",
    price: 0,
    days: 1,
    bonusAiCredits: 1,
    category: "vip",
    badge: "Miễn phí",
    isTrial: true,
  },
  {
    id: "vip_1month",
    name: "VIP 1 Tháng",
    description: "Trải nghiệm đầy đủ tính năng VIP trong 30 ngày",
    price: 15000,
    days: 30,
    bonusAiCredits: 1,
    category: "vip",
    badge: null,
  },
  {
    id: "vip_6months",
    name: "VIP 6 Tháng",
    description: "Tiết kiệm hơn so với gói tháng + tặng 3 ảnh AI",
    price: 79000,
    days: 180,
    bonusAiCredits: 3,
    category: "vip",
    badge: "Phổ biến",
  },
  {
    id: "vip_1year",
    name: "VIP 1 Năm",
    description: "Ưu đãi cả năm không lo gián đoạn + tặng 8 ảnh AI",
    price: 139000,
    days: 365,
    bonusAiCredits: 8,
    category: "vip",
    badge: "Tiết kiệm",
  },
  {
    id: "vip_lifetime",
    name: "VIP Vĩnh viễn",
    description: "Đặc quyền VIP trọn đời không giới hạn thời gian (Admin cấp)",
    price: 0,
    days: null,
    bonusAiCredits: 0,
    category: "vip",
    badge: "Vĩnh viễn",
    adminOnly: true,
  },
];

const AI_FILTER_PLANS = [
  {
    id: "ai_10k",
    name: "AI 10 Ảnh",
    description: "Gói trải nghiệm 10 lượt tạo ảnh AI",
    price: 10000,
    credits: 10,
    category: "ai_filter",
    badge: null,
  },
  {
    id: "ai_20k",
    name: "AI 25 Ảnh",
    description: "Gói tiêu chuẩn 25 lượt tạo ảnh AI",
    price: 20000,
    credits: 25,
    category: "ai_filter",
    badge: "Phổ biến",
  },
  {
    id: "ai_49k",
    name: "AI 65 Ảnh",
    description: "Gói cao cấp 65 lượt tạo ảnh AI",
    price: 49000,
    credits: 65,
    category: "ai_filter",
    badge: "Tiết kiệm",
  },
  {
    id: "ai_99k",
    name: "AI 140 Ảnh",
    description: "Gói siêu cấp 140 lượt tạo ảnh AI",
    price: 99000,
    credits: 140,
    category: "ai_filter",
    badge: "Hời nhất",
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
  if (vipPlanId === "vip_lifetime") return "VIP Vĩnh viễn";
  if (vipPlanId && PLANS_MAP.has(vipPlanId)) return PLANS_MAP.get(vipPlanId).name;
  const days = Number(vipPlanDays);
  if (days === 1) return "VIP Dùng thử (1 ngày)";
  if (days === 365 || days === 366) return "VIP 1 Năm";
  if (days === 180 || days === 183) return "VIP 6 Tháng";
  if (days === 90 || days === 91) return "VIP 3 Tháng";
  if (days === 30 || days === 31) return "VIP 1 Tháng";
  if (Number.isFinite(days) && days > 0) return `VIP ${days} Ngày`;
  if (role === "vip") return "VIP Vĩnh viễn";
  return null;
};

const formatAiFilterPlanName = ({ aiCredits } = {}) => {
  const credits = Number(aiCredits || 0);
  if (credits > 0) return `${credits} lượt`;
  return "0 lượt";
};

const resolveAdminVipSelection = ({ vipPlanId, planDays } = {}, now = Date.now()) => {
  if (vipPlanId === "vip_lifetime") {
    return {
      vipPlanId: "vip_lifetime",
      vipPlanName: "VIP Vĩnh viễn",
      vipPlanDays: null,
      vipExpireAt: null,
      bonusAiCredits: 0,
    };
  }

  if (vipPlanId && PLANS_MAP.has(vipPlanId)) {
    const plan = PLANS_MAP.get(vipPlanId);
    if (plan.category === "vip") {
      return {
        vipPlanId: plan.id,
        vipPlanName: plan.name,
        vipPlanDays: plan.days,
        vipExpireAt: plan.days ? now + plan.days * DAY_MS : null,
        bonusAiCredits: plan.bonusAiCredits || 0,
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
      bonusAiCredits: matched?.bonusAiCredits || 0,
    };
  }

  return {
    vipPlanId: "vip_lifetime",
    vipPlanName: "VIP Vĩnh viễn",
    vipPlanDays: null,
    vipExpireAt: null,
    bonusAiCredits: 0,
  };
};

/**
 * Evaluates effective VIP and AI Filter entitlements for an approved_users record.
 * Automatically detects expired VIP (downgrades to "free").
 * AI Filter requires active VIP AND aiCredits > 0.
 */
const resolveEffectiveAccess = (data = {}, now = Date.now()) => {
  const isEnabled = isApprovedDocEnabled(data);
  const rawRole = normalizeAccessRole(data.role, "vip");

  const vipExpireAt = toTimestampMs(data.vipExpireAt);
  const vipExpired = rawRole === "vip" && vipExpireAt !== null && now > vipExpireAt;
  const effectiveRole = vipExpired ? "free" : rawRole;
  const isVipActive = isEnabled && (effectiveRole === "vip" || effectiveRole === "celebrity");

  const rawVipPlanName = formatVipPlanName({
    vipPlanId: data.vipPlanId,
    vipPlanName: data.vipPlanName,
    vipPlanDays: data.vipPlanDays,
    role: rawRole,
  });

  const aiCredits = Math.max(0, Number(data.aiCredits ?? (data.aiFilterEnabled ? 20 : 0)));
  const hasUsedTrial = Boolean(data.hasUsedTrial);

  // AI Filter is effective ONLY if user has active VIP AND aiCredits > 0
  const effectiveAiEnabled = isVipActive && aiCredits > 0;

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

  const needsPersist = vipExpired;
  if (needsPersist) {
    downgradePatch.updatedAt = new Date(now).toISOString();
  }

  return {
    isEnabled,
    rawRole,
    effectiveRole,
    isVipActive,
    vipExpired,
    vipPlanId: effectiveRole === "vip" ? data.vipPlanId || null : null,
    vipPlanName: effectiveRole === "vip" ? rawVipPlanName : null,
    vipPlanDays: effectiveRole === "vip" ? Number(data.vipPlanDays) || null : null,
    vipExpireAt: effectiveRole === "vip" ? vipExpireAt : null,
    effectiveAiEnabled,
    aiCredits,
    hasUsedTrial,
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
  resolveEffectiveAccess,
};
