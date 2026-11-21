const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export const toCalendarMonthKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const previousMonthKey = (date) =>
  toCalendarMonthKey(new Date(date.getFullYear(), date.getMonth() - 1, 1));

export function getVisibleCalendarMonths(
  monthKeys = [],
  { referenceDate = new Date(), preferredMonthKey = null, showAll = false } = {},
) {
  const currentMonthKey = toCalendarMonthKey(referenceDate);
  const validKeys = [...new Set(monthKeys)].filter((key) =>
    MONTH_KEY_PATTERN.test(key),
  );

  if (showAll) {
    return [...new Set([...validKeys, currentMonthKey])].sort();
  }

  let companionMonth = null;
  if (
    preferredMonthKey &&
    MONTH_KEY_PATTERN.test(preferredMonthKey) &&
    preferredMonthKey !== currentMonthKey
  ) {
    companionMonth = preferredMonthKey;
  } else {
    companionMonth = validKeys
      .filter((key) => key !== currentMonthKey && key < currentMonthKey)
      .sort()
      .at(-1);
  }

  return [...new Set([
    companionMonth || previousMonthKey(referenceDate),
    currentMonthKey,
  ])].sort();
}
