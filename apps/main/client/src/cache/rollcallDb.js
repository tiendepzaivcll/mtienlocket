import db from "./configDB";

const rollcallDB = db;

export async function saveRollcalls(raw = [], meta = {}) {
  if (!Array.isArray(raw) || !raw.length) return;

  const fetchedAt = Date.now();
  const data = raw.map((rollcall) => ({
    ...rollcall,
    uid: rollcall.uid,
    user: rollcall.user,
    week_of_year: rollcall.week_of_year ?? meta.week,
    year: rollcall.year ?? meta.year ?? null,
    create_time:
      typeof rollcall.created_at === "number"
        ? rollcall.created_at
        : rollcall.created_at?._seconds
          ? rollcall.created_at._seconds * 1000
          : fetchedAt,
    fetchedAt,
  }));

  await rollcallDB.rollcalls.bulkPut(data);
}

export async function getRollcallsByWeek(week, year) {
  try {
    if (week == null) return [];

    let rows = await rollcallDB.rollcalls
      .where("week_of_year")
      .equals(week)
      .toArray();

    if (year != null) {
      rows = rows.filter((row) => row.year == null || row.year === year);
    }

    return rows.sort((first, second) => {
      const firstTime = first.create_time || first.fetchedAt || 0;
      const secondTime = second.create_time || second.fetchedAt || 0;
      return secondTime - firstTime;
    });
  } catch (error) {
    console.error("Failed to read Rollcall cache:", error);
    return [];
  }
}
