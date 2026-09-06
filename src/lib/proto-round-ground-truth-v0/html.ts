import type { DiscoveryAnnotationDocumentV0, DiscoveryAnnotationRecordV0 } from "./types";

function escapeHtmlScriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function screenshotHref(relativePath: string): string {
  const posix = relativePath.replaceAll("\\", "/");
  const encoded = posix
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `../../${encoded}`;
}

function viewerRecords(records: DiscoveryAnnotationRecordV0[]) {
  return records.map((record) => ({
    sourceImageSha256: record.sourceImageSha256,
    sourceFileName: record.sourceFileName,
    visualRowIndex: record.visualRowIndex,
    targetRowGeometry: record.targetRowGeometry,
    screenshotHref: screenshotHref(record.screenshotRelativePath),
    annotationStatus: record.annotationStatus,
    screenRowIdentifierRaw: record.screenRowIdentifierRaw,
    screenDateRaw: record.screenDateRaw,
    screenTimeRaw: record.screenTimeRaw,
    leagueDisplayRaw: record.leagueDisplayRaw,
    participantLeftRaw: record.participantLeftRaw,
    participantRightRaw: record.participantRightRaw,
    marketMarkerRaw: record.marketMarkerRaw,
    numericCellsRaw: record.numericCellsRaw,
    statusTextRaw: record.statusTextRaw,
    otherVisibleTextRaw: record.otherVisibleTextRaw,
    annotatorNotes: record.annotatorNotes,
  }));
}

/**
 * Discovery-only annotation page.
 * Original screenshot pixels via CSS crop. No OCR text. No parser guesses.
 */
export function renderDiscoveryAnnotationHtml(
  doc: DiscoveryAnnotationDocumentV0,
): string {
  const payload = {
    schemaVersion: doc.schemaVersion,
    protoRoundKey: doc.protoRoundKey,
    records: viewerRecords(doc.records),
  };
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Proto Round Ground Truth Discovery v0</title>
  <style>
    :root { color-scheme: dark; }
    body { margin: 0; font: 14px/1.4 system-ui, sans-serif; background: #111; color: #eee; }
    header { padding: 12px 16px; border-bottom: 1px solid #333; }
    h1 { font-size: 16px; margin: 0 0 6px; }
    .meta { color: #aaa; font-size: 12px; }
    main { display: grid; grid-template-columns: minmax(320px, 1.4fr) minmax(280px, 1fr); gap: 16px; padding: 16px; }
    .nav { display: flex; gap: 8px; align-items: center; margin: 8px 0 12px; }
    button, select, input, textarea { font: inherit; }
    button { background: #2a2a2a; color: #eee; border: 1px solid #555; padding: 6px 10px; cursor: pointer; }
    .viewport { position: relative; overflow: hidden; background: #000; border: 1px solid #444; width: 100%; }
    .viewport img { position: absolute; left: 0; top: 0; display: block; }
    .highlight { position: absolute; left: 0; right: 0; border: 2px solid #ffcc33; background: rgba(255, 204, 51, 0.08); pointer-events: none; box-sizing: border-box; }
    form { display: grid; gap: 8px; }
    label { display: grid; gap: 4px; color: #ccc; }
    input, textarea, select { background: #1a1a1a; color: #eee; border: 1px solid #555; padding: 6px; }
    textarea { min-height: 56px; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
    .note { color: #999; font-size: 12px; }
  </style>
</head>
<body>
  <header>
    <h1>Discovery annotation pack v0</h1>
    <div class="meta">
      Transcribe visible screenshot pixels only. Parser/OCR candidates are not shown.
      Leave a field blank if that text is not visible.
    </div>
  </header>
  <main>
    <section>
      <div class="nav">
        <button type="button" id="prev">Previous</button>
        <span id="position"></span>
        <button type="button" id="next">Next</button>
        <label>View
          <select id="viewMode">
            <option value="focus">Target row</option>
            <option value="context">Wider context</option>
          </select>
        </label>
      </div>
      <div id="viewport" class="viewport" aria-label="Original screenshot crop">
        <img id="shot" alt="Original screenshot pixels around the selected visual row" />
        <div id="highlight" class="highlight"></div>
      </div>
      <p class="note" id="rowMeta"></p>
    </section>
    <section>
      <form id="truthForm" autocomplete="off">
        <label>annotationStatus
          <select name="annotationStatus">
            <option value="UNANNOTATED">UNANNOTATED</option>
            <option value="COMPLETE">COMPLETE</option>
            <option value="UNCERTAIN">UNCERTAIN</option>
            <option value="UNREADABLE">UNREADABLE</option>
          </select>
        </label>
        <label>screenRowIdentifierRaw <input name="screenRowIdentifierRaw" /></label>
        <label>screenDateRaw <input name="screenDateRaw" /></label>
        <label>screenTimeRaw <input name="screenTimeRaw" /></label>
        <label>leagueDisplayRaw <input name="leagueDisplayRaw" /></label>
        <label>participantLeftRaw <input name="participantLeftRaw" /></label>
        <label>participantRightRaw <input name="participantRightRaw" /></label>
        <label>marketMarkerRaw <input name="marketMarkerRaw" /></label>
        <label>numericCellsRaw (one visible cell per line) <textarea name="numericCellsRaw"></textarea></label>
        <label>statusTextRaw <input name="statusTextRaw" /></label>
        <label>otherVisibleTextRaw (one item per line) <textarea name="otherVisibleTextRaw"></textarea></label>
        <label>annotatorNotes <textarea name="annotatorNotes"></textarea></label>
        <div class="actions">
          <button type="button" id="saveLocal">Save locally</button>
          <button type="button" id="exportJson">Export JSON</button>
        </div>
        <p class="note">Local save uses this browser only. Export writes a JSON download. Fields are never auto-filled.</p>
      </form>
    </section>
  </main>
  <script>
    const PACK = ${escapeHtmlScriptJson(payload)};
    const STORAGE_KEY = "proto-round-ground-truth-discovery-v0:" + PACK.protoRoundKey;
    let index = 0;
    const records = PACK.records.map((r) => ({ ...r }));

    function loadLocal() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw);
        if (!Array.isArray(saved) || saved.length !== records.length) return;
        for (let i = 0; i < records.length; i++) {
          const src = saved[i];
          if (!src || src.sourceImageSha256 !== records[i].sourceImageSha256) return;
          if (src.visualRowIndex !== records[i].visualRowIndex) return;
          records[i] = { ...records[i], ...pickTruth(src) };
        }
      } catch {}
    }

    function pickTruth(src) {
      return {
        annotationStatus: src.annotationStatus || "UNANNOTATED",
        screenRowIdentifierRaw: emptyToNull(src.screenRowIdentifierRaw),
        screenDateRaw: emptyToNull(src.screenDateRaw),
        screenTimeRaw: emptyToNull(src.screenTimeRaw),
        leagueDisplayRaw: emptyToNull(src.leagueDisplayRaw),
        participantLeftRaw: emptyToNull(src.participantLeftRaw),
        participantRightRaw: emptyToNull(src.participantRightRaw),
        marketMarkerRaw: emptyToNull(src.marketMarkerRaw),
        numericCellsRaw: Array.isArray(src.numericCellsRaw) ? src.numericCellsRaw : [],
        statusTextRaw: emptyToNull(src.statusTextRaw),
        otherVisibleTextRaw: Array.isArray(src.otherVisibleTextRaw) ? src.otherVisibleTextRaw : [],
        annotatorNotes: emptyToNull(src.annotatorNotes),
      };
    }

    function emptyToNull(v) {
      if (v == null) return null;
      const s = String(v);
      return s.trim() === "" ? null : s;
    }

    function lines(v) {
      return String(v || "")
        .split(/\\n/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }

    function readForm() {
      const form = document.getElementById("truthForm");
      const data = new FormData(form);
      return {
        annotationStatus: data.get("annotationStatus"),
        screenRowIdentifierRaw: emptyToNull(data.get("screenRowIdentifierRaw")),
        screenDateRaw: emptyToNull(data.get("screenDateRaw")),
        screenTimeRaw: emptyToNull(data.get("screenTimeRaw")),
        leagueDisplayRaw: emptyToNull(data.get("leagueDisplayRaw")),
        participantLeftRaw: emptyToNull(data.get("participantLeftRaw")),
        participantRightRaw: emptyToNull(data.get("participantRightRaw")),
        marketMarkerRaw: emptyToNull(data.get("marketMarkerRaw")),
        numericCellsRaw: lines(data.get("numericCellsRaw")),
        statusTextRaw: emptyToNull(data.get("statusTextRaw")),
        otherVisibleTextRaw: lines(data.get("otherVisibleTextRaw")),
        annotatorNotes: emptyToNull(data.get("annotatorNotes")),
      };
    }

    function writeForm(record) {
      const form = document.getElementById("truthForm");
      form.annotationStatus.value = record.annotationStatus;
      form.screenRowIdentifierRaw.value = record.screenRowIdentifierRaw || "";
      form.screenDateRaw.value = record.screenDateRaw || "";
      form.screenTimeRaw.value = record.screenTimeRaw || "";
      form.leagueDisplayRaw.value = record.leagueDisplayRaw || "";
      form.participantLeftRaw.value = record.participantLeftRaw || "";
      form.participantRightRaw.value = record.participantRightRaw || "";
      form.marketMarkerRaw.value = record.marketMarkerRaw || "";
      form.numericCellsRaw.value = (record.numericCellsRaw || []).join("\\n");
      form.statusTextRaw.value = record.statusTextRaw || "";
      form.otherVisibleTextRaw.value = (record.otherVisibleTextRaw || []).join("\\n");
      form.annotatorNotes.value = record.annotatorNotes || "";
    }

    function persistCurrent() {
      Object.assign(records[index], readForm());
    }

    function layoutCrop() {
      const record = records[index];
      const geo = record.targetRowGeometry;
      const mode = document.getElementById("viewMode").value;
      const rowH = Math.max(1, geo.bottomY - geo.topY);
      const pad = mode === "focus" ? Math.max(12, rowH * 0.6) : Math.max(48, rowH * 2.2);
      const cropTop = Math.max(0, geo.topY - pad);
      const cropBottom = Math.min(geo.imageHeight, geo.bottomY + pad);
      const cropHeight = Math.max(1, cropBottom - cropTop);
      const viewport = document.getElementById("viewport");
      const img = document.getElementById("shot");
      const highlight = document.getElementById("highlight");
      const width = viewport.clientWidth || 640;
      const scale = width / geo.imageWidth;
      viewport.style.height = (cropHeight * scale) + "px";
      img.style.width = width + "px";
      img.style.height = (geo.imageHeight * scale) + "px";
      img.style.top = (-cropTop * scale) + "px";
      highlight.style.top = ((geo.topY - cropTop) * scale) + "px";
      highlight.style.height = ((geo.bottomY - geo.topY) * scale) + "px";
    }

    function render() {
      const record = records[index];
      document.getElementById("position").textContent =
        (index + 1) + " / " + records.length;
      document.getElementById("rowMeta").textContent =
        "visualRowIndex " + record.visualRowIndex + " · " + record.sourceFileName;
      const img = document.getElementById("shot");
      img.src = record.screenshotHref;
      writeForm(record);
      requestAnimationFrame(layoutCrop);
    }

    function exportDocument() {
      persistCurrent();
      return {
        schemaVersion: PACK.schemaVersion,
        protoRoundKey: PACK.protoRoundKey,
        records: records.map((record) => ({
          sourceImageSha256: record.sourceImageSha256,
          sourceFileName: record.sourceFileName,
          visualRowIndex: record.visualRowIndex,
          annotationStatus: record.annotationStatus,
          screenRowIdentifierRaw: record.screenRowIdentifierRaw,
          screenDateRaw: record.screenDateRaw,
          screenTimeRaw: record.screenTimeRaw,
          leagueDisplayRaw: record.leagueDisplayRaw,
          participantLeftRaw: record.participantLeftRaw,
          participantRightRaw: record.participantRightRaw,
          marketMarkerRaw: record.marketMarkerRaw,
          numericCellsRaw: record.numericCellsRaw,
          statusTextRaw: record.statusTextRaw,
          otherVisibleTextRaw: record.otherVisibleTextRaw,
          annotatorNotes: record.annotatorNotes,
        })),
      };
    }

    document.getElementById("prev").onclick = () => {
      persistCurrent();
      index = (index + records.length - 1) % records.length;
      render();
    };
    document.getElementById("next").onclick = () => {
      persistCurrent();
      index = (index + 1) % records.length;
      render();
    };
    document.getElementById("viewMode").onchange = layoutCrop;
    document.getElementById("saveLocal").onclick = () => {
      persistCurrent();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records.map((r) => ({
        sourceImageSha256: r.sourceImageSha256,
        visualRowIndex: r.visualRowIndex,
        ...pickTruth(r),
      }))));
    };
    document.getElementById("exportJson").onclick = () => {
      const blob = new Blob([JSON.stringify(exportDocument(), null, 2) + "\\n"], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "discovery-annotation-v0.json";
      a.click();
      URL.revokeObjectURL(a.href);
    };
    window.addEventListener("resize", layoutCrop);
    loadLocal();
    render();
  </script>
</body>
</html>
`;
}
