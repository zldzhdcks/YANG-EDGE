/**
 * Proto-round extraction design v0 tests.
 * Deterministic. No real user screenshots. Network: 0.
 *
 *   npm run test:proto-round-extraction-design-v0
 */
import assert from "node:assert/strict";
import {
  attachNormalizedTeams,
  buildObservationIdentity,
  buildRowContentFingerprint,
  CROSS_IMAGE_ROW_AUTO_DEDUPE,
  parseScreenshotFilenameTimestamp,
  readPngIhdrDimensions,
} from "../src/lib/proto-round-extraction-design-v0";

function sampleRow(overrides?: {
  leftTeamTextRaw?: string;
  oddsValuesRaw?: string[] | null;
}) {
  return {
    protoRoundKey: "2026-105",
    sportTextRaw: "축구",
    leagueTextRaw: "EPL",
    scheduledDateTextRaw: "09-06",
    scheduledTimeTextRaw: "20:00",
    leftTeamTextRaw: overrides?.leftTeamTextRaw ?? "팀A",
    rightTeamTextRaw: "팀B",
    leftTeamNormalized: "Team A",
    rightTeamNormalized: "Team B",
    marketTypeRaw: "승패",
    handicapLineRaw: null,
    totalLineRaw: null,
    oddsValuesRaw: overrides?.oddsValuesRaw ?? ["1.80", "2.00"],
  };
}

async function main() {
  // A. exact filename timestamp parser
  const parsed = parseScreenshotFilenameTimestamp(
    "스크린샷 2026-09-06 105222.png",
  );
  assert.equal(parsed.filenameTimestampParseStatus, "PARSED_EXACT_PATTERN");
  assert.equal(parsed.filenameTimestampText, "2026-09-06 105222");
  assert.equal(parsed.filenameTimestampCandidateKst, "2026-09-06T10:52:22+09:00");
  assert.equal(parsed.candidateProvenance, "FILENAME_OS_GENERATED_CANDIDATE");
  assert.equal(Object.prototype.hasOwnProperty.call(parsed, "capturedAt"), false);

  // D. KST → UTC conversion exact (10:52:22 KST = 01:52:22 UTC)
  assert.equal(
    parsed.filenameTimestampCandidateUtc,
    "2026-09-06T01:52:22.000Z",
  );

  const later = parseScreenshotFilenameTimestamp(
    "스크린샷 2026-09-06 105324.png",
  );
  assert.equal(later.filenameTimestampCandidateKst, "2026-09-06T10:53:24+09:00");
  assert.equal(later.filenameTimestampCandidateUtc, "2026-09-06T01:53:24.000Z");

  // B. malformed filename → NO_MATCH
  assert.equal(
    parseScreenshotFilenameTimestamp("foo.png").filenameTimestampParseStatus,
    "NO_MATCH",
  );
  assert.equal(
    parseScreenshotFilenameTimestamp("스크린샷 2026-09-06.png")
      .filenameTimestampParseStatus,
    "NO_MATCH",
  );
  assert.equal(
    parseScreenshotFilenameTimestamp("screenshot 2026-09-06 105222.png")
      .filenameTimestampParseStatus,
    "NO_MATCH",
  );
  assert.equal(
    parseScreenshotFilenameTimestamp("스크린샷 2026-09-06 105222.gif")
      .filenameTimestampParseStatus,
    "NO_MATCH",
  );

  // C. impossible date/time → INVALID_DATE_TIME (no Date overflow accept)
  assert.equal(
    parseScreenshotFilenameTimestamp("스크린샷 2026-02-30 105222.png")
      .filenameTimestampParseStatus,
    "INVALID_DATE_TIME",
  );
  assert.equal(
    parseScreenshotFilenameTimestamp("스크린샷 2026-13-01 105222.png")
      .filenameTimestampParseStatus,
    "INVALID_DATE_TIME",
  );
  assert.equal(
    parseScreenshotFilenameTimestamp("스크린샷 2026-09-06 250000.png")
      .filenameTimestampParseStatus,
    "INVALID_DATE_TIME",
  );
  assert.equal(
    parseScreenshotFilenameTimestamp("스크린샷 2026-09-06 106100.png")
      .filenameTimestampParseStatus,
    "INVALID_DATE_TIME",
  );
  assert.equal(
    parseScreenshotFilenameTimestamp("스크린샷 2026-09-06 105299.png")
      .filenameTimestampParseStatus,
    "INVALID_DATE_TIME",
  );
  assert.equal(
    parseScreenshotFilenameTimestamp("스크린샷 2026-09-06 246000.png")
      .filenameTimestampParseStatus,
    "INVALID_DATE_TIME",
  );
  assert.equal(
    parseScreenshotFilenameTimestamp("스크린샷 2025-02-29 105222.png")
      .filenameTimestampParseStatus,
    "INVALID_DATE_TIME",
  );

  // E. raw text fields remain distinct from normalized future fields
  const raw = { leftTeamTextRaw: "팀A", rightTeamTextRaw: "팀B" };
  const attached = attachNormalizedTeams(raw, "Team A", "Team B");
  assert.equal(attached.leftTeamTextRaw, "팀A");
  assert.equal(attached.rightTeamTextRaw, "팀B");
  assert.equal(attached.leftTeamNormalized, "Team A");
  assert.equal(attached.rightTeamNormalized, "Team B");
  assert.notEqual(attached.leftTeamTextRaw, attached.leftTeamNormalized);

  // F. row fingerprint does not contain image SHA
  const fp = buildRowContentFingerprint(sampleRow());
  const imageSha =
    "9f19cd0e45aaefb9c9732dfb7ddb6771cb8510ee658c1fa92451bf040c6ca447";
  assert.equal(fp.includes(imageSha), false);
  const withShaAttempt = {
    ...sampleRow(),
    sourceImageSha256: imageSha,
  };
  const fpIgnoreExtra = buildRowContentFingerprint(
    withShaAttempt as ReturnType<typeof sampleRow>,
  );
  assert.equal(fpIgnoreExtra, fp);
  assert.equal(fp, buildRowContentFingerprint(sampleRow()));
  assert.match(fp, /^[0-9a-f]{64}$/);

  // G. different accepted observation times are not automatically merged
  const sameContent = buildRowContentFingerprint(sampleRow());
  const obs20 = buildObservationIdentity(sameContent, "2026-09-06T11:00:00+09:00");
  const obs23 = buildObservationIdentity(sameContent, "2026-09-06T14:00:00+09:00");
  assert.equal(sameContent, buildRowContentFingerprint(sampleRow()));
  assert.notEqual(obs20, obs23);

  const equalOddsLater = buildRowContentFingerprint(
    sampleRow({ oddsValuesRaw: ["1.80", "2.00"] }),
  );
  assert.equal(equalOddsLater, sameContent);
  assert.notEqual(
    buildObservationIdentity(equalOddsLater, "2026-09-06T11:00:00+09:00"),
    buildObservationIdentity(equalOddsLater, "2026-09-06T14:00:00+09:00"),
  );
  assert.equal(CROSS_IMAGE_ROW_AUTO_DEDUPE, "DISABLED");

  // PNG IHDR reader (synthetic 1x1 header bytes, no pixel decode)
  const ihdr = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(ihdr, 0);
  ihdr.writeUInt32BE(13, 8);
  ihdr.write("IHDR", 12, "ascii");
  ihdr.writeUInt32BE(1170, 16);
  ihdr.writeUInt32BE(2532, 20);
  const dims = readPngIhdrDimensions(ihdr);
  assert.ok(dims);
  assert.equal(dims.width, 1170);
  assert.equal(dims.height, 2532);

  console.log("PROTO_ROUND_EXTRACTION_DESIGN_V0_OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
