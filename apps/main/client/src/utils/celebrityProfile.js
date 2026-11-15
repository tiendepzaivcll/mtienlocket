const isTruthyCelebrityMarker = (value) => {
  if (value === true || value === 1) return true;
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "celebrity";
};

export const isCelebrityProfile = (profile) => {
  if (!profile || typeof profile !== "object") return false;

  const accountTypes = Array.isArray(profile.accountTypes)
    ? profile.accountTypes
    : Array.isArray(profile.account_types)
      ? profile.account_types
      : [];
  const relationship = String(profile.friendship_status || "").toLowerCase();

  return Boolean(
    isTruthyCelebrityMarker(profile.celebrity) ||
      accountTypes.some(
        (type) => String(type || "").trim().toLowerCase() === "celebrity",
      ) ||
      (profile.celebrity_data && typeof profile.celebrity_data === "object") ||
      relationship.includes("follow"),
  );
};
