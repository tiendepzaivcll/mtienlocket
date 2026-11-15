const readDateValue = (value) => Number(value?.value ?? value);

export const getRestoreToday = (
  now = new Date(),
  timeZone = "Asia/Ho_Chi_Minh",
) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts.filter(({ type }) => type !== "literal").map(({ type, value }) => [
      type,
      value,
    ]),
  );

  return Number(`${values.year}${values.month}${values.day}`);
};

export const normalizeYYYYMMDD = (value) => {
  const normalized = readDateValue(value);
  const text = String(normalized || "");
  if (!/^\d{8}$/.test(text)) return null;

  const year = Number(text.slice(0, 4));
  const month = Number(text.slice(4, 6));
  const day = Number(text.slice(6, 8));
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return normalized;
};

export const yyyymmddToUTCDate = (value) => {
  const normalized = normalizeYYYYMMDD(value);
  if (!normalized) return null;

  const text = String(normalized);
  return new Date(
    Date.UTC(
      Number(text.slice(0, 4)),
      Number(text.slice(4, 6)) - 1,
      Number(text.slice(6, 8)),
    ),
  );
};

export const utcDateToYYYYMMDD = (date) =>
  Number(
    `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`,
  );

export const addDaysToRestoreDate = (value, days) => {
  const date = yyyymmddToUTCDate(value);
  if (!date) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return utcDateToYYYYMMDD(date);
};

export const formatRestoreDate = (value) => {
  const normalized = normalizeYYYYMMDD(value);
  if (!normalized) return "—";
  const text = String(normalized);
  return `${text.slice(6, 8)}/${text.slice(4, 6)}/${text.slice(0, 4)}`;
};

export const getRestoreAnchorDate = (streak, today) => {
  const normalizedToday = normalizeYYYYMMDD(today);
  if (!normalizedToday) return null;

  const currentDate = normalizeYYYYMMDD(streak?.last_updated_yyyymmdd);
  if (currentDate && currentDate <= normalizedToday) return currentDate;

  const pastDate = normalizeYYYYMMDD(
    streak?.past_streak?.last_updated_yyyymmdd,
  );
  return pastDate && pastDate <= normalizedToday ? pastDate : null;
};

export const getNextRestoreDate = ({ streak, confirmedDate, today }) => {
  const normalizedToday = normalizeYYYYMMDD(today);
  const anchorDate = getRestoreAnchorDate(streak, normalizedToday);
  const normalizedConfirmed = normalizeYYYYMMDD(confirmedDate);
  if (!normalizedToday || !anchorDate) return null;

  const lastCompletedDate =
    normalizedConfirmed && normalizedConfirmed > anchorDate
      ? normalizedConfirmed
      : anchorDate;
  const nextDate = addDaysToRestoreDate(lastCompletedDate, 1);

  return nextDate && nextDate <= normalizedToday ? nextDate : null;
};

export const getMonthKeysBetween = (startValue, endValue) => {
  const start = yyyymmddToUTCDate(startValue);
  const end = yyyymmddToUTCDate(endValue);
  if (!start || !end || start > end) return [];

  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const endMonth = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1);
  const keys = [];

  while (cursor.getTime() <= endMonth) {
    keys.push(
      `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`,
    );
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return keys;
};
