/**
 * Seed 2026-08-08 MLB Expected Lineup Observation from operator-transcribed
 * Expected Lineup screen (RotoWire Expected Lineup blocks, MANUAL_OBSERVATION).
 *
 *   npx tsx scripts/seed-mlb-expected-lineup-observation-v0.ts
 */
import {
  parseExpectedLineupPaste,
  saveMlbExpectedLineupObservation,
  type MlbExpectedLineupDraftBatter,
  type MlbExpectedLineupDraftGame,
} from "../src/lib/mlb/expected-lineup-observation-v0";

/** RotoWire-style: "RF Nathan Lukes L" → numbered paste. */
function fromPosNameBats(lines: string[]): MlbExpectedLineupDraftBatter[] {
  const paste = lines
    .map((line, i) => {
      const m = line
        .trim()
        .match(
          /^(DH|C|1B|2B|3B|SS|LF|CF|RF|OF)\s+(.+?)\s+([LRSB])\s*$/i,
        );
      if (!m) throw new Error(`BAD_LINE:${line}`);
      return `${i + 1}. ${m[2]} ${m[1]} ${m[3]}`;
    })
    .join("\n");
  const { batters, errors } = parseExpectedLineupPaste(paste);
  if (errors.length) throw new Error(errors.join(";"));
  return batters;
}

/**
 * Order matches Expected Lineup screen slate (away then home per game),
 * aligned to 2026-08-08 schedule join via gamePk.
 */
const SLATE: Array<{ gamePk: number; away: string[]; home: string[] }> = [
  {
    gamePk: 823428,
    away: [
      "RF Nathan Lukes L",
      "1B V. Guerrero R",
      "3B K. Okamoto R",
      "DH G. Springer R",
      "C A. Kirk R",
      "LF J. Sanchez L",
      "2B E. Clement R",
      "SS A. Gimenez L",
      "CF Myles Straw R",
    ],
    home: [
      "DH K. Schwarber L",
      "SS Trea Turner R",
      "RF Bryce Harper L",
      "2B Luis Arraez L",
      "1B Alec Bohm R",
      "LF B. Marsh L",
      "C J. Realmuto R",
      "3B Bryson Stott L",
      "CF J. Crawford L",
    ],
  },
  {
    gamePk: 823349,
    away: [
      "LF A.J. Ewing L",
      "SS F. Lindor S",
      "3B Bo Bichette R",
      "RF Carson Benge L",
      "CF Luis Robert R",
      "1B Jared Young L",
      "2B M. Semien R",
      "DH J. Polanco S",
      "C F. Alvarez R",
    ],
    home: [
      "LF Jake Mangum S",
      "2B Brandon Lowe L",
      "DH B. Reynolds S",
      "RF E. Valdez R",
      "3B N. Gonzales R",
      "C E. Rodriguez S",
      "SS Jared Triolo R",
      "1B R. Flores R",
      "CF J. Garcia R",
    ],
  },
  {
    gamePk: 822699,
    away: [
      "SS E. De La Cruz S",
      "1B Sal Stewart R",
      "LF JJ Bleday L",
      "C T. Stephenson R",
      "3B E. Suarez R",
      "CF Dane Myers R",
      "RF Noelvi Marte R",
      "DH H. Rodriguez L",
      "2B Matt McLain R",
    ],
    home: [
      "SS CJ Abrams L",
      "1B A. Ortiz L",
      "RF Dylan Crews R",
      "LF Daylen Lile L",
      "C Keibert Ruiz S",
      "DH Jose Tena L",
      "2B Nasim Nunez S",
      "3B Jorbit Vivas L",
      "CF Jacob Young R",
    ],
  },
  {
    gamePk: 823515,
    away: [
      "RF Ronald Acuna R",
      "DH D. Baldwin L",
      "1B Matt Olson L",
      "2B Ozzie Albies S",
      "CF M. Harris L",
      "SS M. Dubon R",
      "LF Lane Thomas R",
      "3B Austin Riley R",
      "C Sean Murphy R",
    ],
    home: [
      "1B P. Goldschmidt R",
      "DH Ben Rice L",
      "3B Amed Rosario R",
      "LF Heliot Ramos R",
      "RF J. Caballero R",
      "2B J. Chisholm L",
      "SS G. Lombard R",
      "CF T. Grisham L",
      "C Ali Sanchez R",
    ],
  },
  {
    gamePk: 824727,
    away: [
      "DH Jacob Wilson R",
      "C Jonah Heim S",
      "LF T. Soderstrom L",
      "1B Tommy White R",
      "RF L. Butler L",
      "SS A. Williams R",
      "CF Henry Bolte R",
      "3B Max Muncy R",
      "2B J. Ornelas R",
    ],
    home: [
      "2B Nick Sogard S",
      "CF C. Rafaela R",
      "RF Wilyer Abreu L",
      "1B W. Contreras R",
      "DH M. Yoshida L",
      "3B Caleb Durbin R",
      "LF Jarren Duran L",
      "SS A. Monasterio R",
      "C Connor Wong R",
    ],
  },
  {
    gamePk: 823836,
    away: [
      "SS Zach Neto R",
      "CF Mike Trout R",
      "1B N. Schanuel L",
      "2B V. Grissom R",
      "DH M. Ballesteros L",
      "3B D. Guzman R",
      "RF Josh Lowe L",
      "C T. d'Arnaud R",
      "LF Wade Meckler L",
    ],
    home: [
      "2B X. Edwards S",
      "1B Kyle Stowers L",
      "SS Otto Lopez R",
      "DH G. Conine L",
      "LF H. Hernandez R",
      "RF Owen Caissie L",
      "CF Jakob Marsee L",
      "C Joe Mack L",
      "3B J. Sanoja R",
    ],
  },
  {
    gamePk: 824566,
    away: [
      "CF Steven Kwan L",
      "3B Jose Ramirez S",
      "DH C. DeLauter L",
      "RF Jo Adell R",
      "1B Rhys Hoskins R",
      "LF A. Martinez S",
      "2B T. Bazzana L",
      "C A. Hedges R",
      "SS B. Rocchio S",
    ],
    home: [
      "LF R. Grichuk R",
      "DH M. Murakami L",
      "1B M. Vargas R",
      "3B C. Montgomery L",
      "2B C. Meidroth R",
      "CF B. Doyle R",
      "RF B. Montgomery S",
      "C Drew Romo S",
      "SS L. Acuna R",
    ],
  },
  {
    gamePk: 823750,
    away: [
      "LF A. Martin R",
      "C Ryan Jeffers R",
      "DH Josh Bell S",
      "2B Royce Lewis R",
      "RF Kody Clemens L",
      "1B V. Caratini S",
      "CF L. Keaschall R",
      "3B Brooks Lee S",
      "SS R. Kreidler R",
    ],
    home: [
      "DH C. Yelich L",
      "LF J. Chourio R",
      "2B Brice Turang L",
      "C W. Contreras R",
      "1B A. Vaughn R",
      "RF Luis Lara S",
      "CF G. Mitchell L",
      "SS Cooper Pratt R",
      "3B Joey Ortiz R",
    ],
  },
  {
    gamePk: 824081,
    away: [
      "CF P. Crow-Armstrong L",
      "RF Seiya Suzuki R",
      "1B M. Busch L",
      "3B Alex Bregman R",
      "LF Ian Happ S",
      "2B Nico Hoerner R",
      "C Carson Kelly R",
      "DH P. Ramirez S",
      "SS D. Swanson R",
    ],
    home: [
      "C C. Jensen L",
      "SS Bobby Witt R",
      "1B J. Caglianone L",
      "DH S. Perez R",
      "2B M. Massey L",
      "LF I. Collins S",
      "3B Nick Loftin R",
      "RF John Rave L",
      "CF Kyle Isbel L",
    ],
  },
  {
    gamePk: 822863,
    away: [
      "LF D. Beavers L",
      "1B Pete Alonso R",
      "SS G. Henderson L",
      "3B C. Encarnacion-Strand R",
      "2B J. Holliday L",
      "DH Coby Mayo R",
      "CF C. Cowser L",
      "RF L. Taveras S",
      "C C. Narvaez R",
    ],
    home: [
      "DH Joc Pederson L",
      "LF W. Langford R",
      "SS Corey Seager L",
      "RF B. Nimmo L",
      "CF Evan Carter L",
      "1B Jake Burger R",
      "3B E. Duran R",
      "C Elias Diaz R",
      "2B Nicky Lopez L",
    ],
  },
  {
    gamePk: 823024,
    away: [
      "LF J. McCarthy L",
      "CF Cole Carrigg S",
      "DH M. Moniak L",
      "C H. Goodman R",
      "1B TJ Rumfield L",
      "3B Kyle Karros R",
      "2B Willi Castro S",
      "RF T. Johnston L",
      "SS E. Tovar R",
    ],
    home: [
      "2B J. Wetherholt L",
      "RF J. Walker R",
      "1B A. Burleson L",
      "DH Ivan Herrera R",
      "LF Bryan Torres L",
      "SS Masyn Winn R",
      "CF N. Church L",
      "3B Blaze Jordan R",
      "C Jimmy Crooks L",
    ],
  },
  {
    gamePk: 823266,
    away: [
      "SS Jeremy Pena R",
      "DH Y. Alvarez L",
      "3B I. Paredes R",
      "2B Jose Altuve R",
      "1B C. Walker R",
      "C Yainer Diaz R",
      "CF D. Varsho L",
      "RF Cam Smith R",
      "LF T. Trammell L",
    ],
    home: [
      "RF F. Tatis R",
      "2B J. Cronenworth L",
      "3B M. Machado R",
      "1B Ty France R",
      "CF J. Merrill L",
      "LF Luis Rengifo S",
      "DH Gavin Sheets L",
      "SS X. Bogaerts R",
      "C L. Campusano R",
    ],
  },
  {
    gamePk: 825051,
    away: [
      "DH S. Ohtani L",
      "CF Andy Pages R",
      "1B F. Freeman L",
      "3B Max Muncy L",
      "SS Mookie Betts R",
      "2B Tommy Edman S",
      "RF Kyle Tucker L",
      "LF T. Hernandez R",
      "C Ben Rortvedt L",
    ],
    home: [
      "RF C. Carroll L",
      "SS G. Perdomo S",
      "C G. Moreno R",
      "2B Ketel Marte S",
      "3B N. Arenado R",
      "LF L. Nootbaar L",
      "DH Max Kepler L",
      "1B Tim Tawa R",
      "CF R. Waldschmidt R",
    ],
  },
  {
    gamePk: 823103,
    away: [
      "DH Yandy Diaz R",
      "1B J. Aranda L",
      "3B J. Caminero R",
      "C Liam Hicks L",
      "CF C. Mullins L",
      "RF Victor Mesa L",
      "LF C. Simpson L",
      "2B R. Palacios L",
      "SS Taylor Walls S",
    ],
    home: [
      "2B Cole Young L",
      "LF R. Arozarena R",
      "DH D. Canzone L",
      "CF J. Rodriguez R",
      "1B Josh Naylor L",
      "C Cal Raleigh S",
      "3B B. Donovan L",
      "RF Taylor Ward R",
      "SS Colt Emerson L",
    ],
  },
  {
    gamePk: 823191,
    away: [
      "3B K. McGonigle L",
      "2B G. Torres R",
      "C D. Dingler R",
      "LF Riley Greene L",
      "DH Colt Keith L",
      "1B S. Torkelson R",
      "CF Max Clark L",
      "SS Javier Baez R",
      "RF Z. McKinstry L",
    ],
    home: [
      "DH B. Eldridge L",
      "RF Jung Hoo Lee L",
      "1B R. Devers L",
      "SS Willy Adames R",
      "C D. Cavanaugh L",
      "CF Drew Gilbert L",
      "2B O. Basabe R",
      "LF Grant McCray L",
      "3B C. Koss R",
    ],
  },
];

async function main() {
  const drafts: MlbExpectedLineupDraftGame[] = SLATE.map((g) => ({
    gamePk: g.gamePk,
    awayLineup: fromPosNameBats(g.away),
    homeLineup: fromPosNameBats(g.home),
  }));

  const result = await saveMlbExpectedLineupObservation({
    dateKst: "2026-08-08",
    observedAt: "2026-08-07T07:00:00.000Z",
    sourceLabel: "수동 관찰 · EXPECTED LINEUP · MANUAL_OBSERVATION",
    note: "PREGAME EXPECTED LINEUP OBSERVATION transcribed from Expected Lineup screen before first pitch. Not CONFIRMED. Does not mutate Prediction / Recommendation / lineup-dataset-v1.",
    drafts,
  });

  if (!result.ok || !result.document) {
    console.error("FAILED", result.errors);
    process.exitCode = 1;
    return;
  }

  const d = result.document;
  console.log("=== MLB EXPECTED LINEUP OBSERVATION ===\n");
  console.log(`Date: ${d.dateKst}`);
  console.log(`Games: ${d.summary.scheduleGames}`);
  console.log(`Matched: ${d.summary.matchedGames}`);
  console.log(`Teams: ${d.summary.teamLineups}`);
  console.log(`Batting Slots: ${d.summary.expectedBattingSlots}`);
  console.log("");
  console.log(`Expected: ${d.summary.expectedGames}`);
  console.log(`Confirmed: ${d.summary.confirmedGames}`);
  console.log(`Missing: ${d.summary.missingGames}`);
  console.log("");
  console.log(
    `Observed Before First Pitch: ${d.summary.preGameObservations}/${d.summary.matchedGames}`,
  );
  console.log(`Hash: ${d.expectedLineupHash.slice(0, 8)}…`);
  console.log(`Wrote: ${result.pathRel}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
