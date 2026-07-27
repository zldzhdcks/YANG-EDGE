/**
 * /games date query helpers
 */
import {
  buildGamesBackPath,
  buildGamesPath,
  isValidKstDateString,
  parseGamesDateParam,
  shiftKstDate,
} from "../src/lib/datetime/games-date";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(isValidKstDateString("2026-07-28"), "valid date");
assert(!isValidKstDateString("2026-13-01"), "invalid month");
assert(!isValidKstDateString("bad"), "invalid string");

assert(
  parseGamesDateParam("2026-07-27") === "2026-07-27",
  "parse valid",
);
assert(
  parseGamesDateParam("not-a-date") !== "not-a-date",
  "invalid falls back",
);

assert(shiftKstDate("2026-07-28", -1) === "2026-07-27", "prev day");
assert(shiftKstDate("2026-07-28", 1) === "2026-07-29", "next day");

assert(
  buildGamesPath("2026-07-28") === "/games?date=2026-07-28",
  "games path",
);
assert(
  buildGamesBackPath("2026-07-28", "2026-07-27") ===
    "/games?date=2026-07-28",
  "fromDate wins",
);
assert(
  buildGamesBackPath(null, "2026-07-27") === "/games?date=2026-07-27",
  "gameDate fallback",
);

console.log("games-date helpers: OK");
