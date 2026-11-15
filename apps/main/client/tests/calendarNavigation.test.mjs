import test from "node:test";
import assert from "node:assert/strict";

import {
  getVisibleCalendarMonths,
  toCalendarMonthKey,
} from "../src/utils/moment/calendarMonths.js";

const september = new Date(2026, 8, 11);

test("calendar always renders the current month and one companion month", () => {
  assert.deepEqual(
    getVisibleCalendarMonths([], { referenceDate: september }),
    ["2026-08", "2026-09"],
  );
  assert.deepEqual(
    getVisibleCalendarMonths(["2026-05", "2026-07", "2026-09"], {
      referenceDate: september,
    }),
    ["2026-07", "2026-09"],
  );
});

test("calendar keeps the restore target month visible beside current month", () => {
  assert.deepEqual(
    getVisibleCalendarMonths(["2026-07", "2026-08", "2026-09"], {
      referenceDate: september,
      preferredMonthKey: "2026-07",
    }),
    ["2026-07", "2026-09"],
  );
  assert.equal(toCalendarMonthKey(september), "2026-09");
});
