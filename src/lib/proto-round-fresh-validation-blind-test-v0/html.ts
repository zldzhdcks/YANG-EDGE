import {
  FRESH_ANNOTATION_EXPORT_FILE_NAME,
  FRESH_VALIDATION_ANNOTATION_SCHEMA_VERSION,
  GROUND_TRUTH_SOURCE,
  type FreshEligibleRowV0,
  type FreshHumanAnnotationRecordV0,
} from "./types";

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

export function humanAnnotationRecordsFromSelection(
  rows: FreshEligibleRowV0[],
): FreshHumanAnnotationRecordV0[] {
  return rows.map((row) => ({
    sourceImageSha256: row.sourceImageSha256,
    sourceFileName: row.sourceFileName,
    visualRowIndex: row.visualRowIndex,
    targetRowGeometry: {
      topY: row.topY,
      bottomY: row.bottomY,
      centerY: row.centerY,
      imageWidth: row.imageWidth,
      imageHeight: row.imageHeight,
    },
    screenshotRelativePath: row.screenshotRelativePath,
    annotationStatus: "UNANNOTATED",
    screenRowIdentifierRaw: null,
    participantLeftRaw: null,
    participantRightRaw: null,
    numericCellsRaw: [],
    marketMarkerRaw: null,
  }));
}

export function renderFreshValidationHumanHtml(input: {
  protoRoundKey: string;
  records: FreshHumanAnnotationRecordV0[];
}): string {
  const payload = {
    schemaVersion: FRESH_VALIDATION_ANNOTATION_SCHEMA_VERSION,
    protoRoundKey: input.protoRoundKey,
    groundTruthSource: GROUND_TRUTH_SOURCE,
    records: input.records.map((record) => ({
      sourceImageSha256: record.sourceImageSha256,
      sourceFileName: record.sourceFileName,
      visualRowIndex: record.visualRowIndex,
      targetRowGeometry: record.targetRowGeometry,
      screenshotHref: screenshotHref(record.screenshotRelativePath),
      annotationStatus: record.annotationStatus,
      screenRowIdentifierRaw: record.screenRowIdentifierRaw,
      participantLeftRaw: record.participantLeftRaw,
      participantRightRaw: record.participantRightRaw,
      numericCellsRaw: record.numericCellsRaw,
      marketMarkerRaw: record.marketMarkerRaw,
    })),
  };
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Fresh Validation Human Annotation v0</title>
  <style>
    :root { color-scheme: dark; }
    body { margin: 0; font: 14px/1.4 system-ui, sans-serif; background: #111; color: #eee; }
    header { padding: 12px 16px; border-bottom: 1px solid #333; display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    h1 { font-size: 16px; margin: 0 0 6px; }
    .meta { color: #aaa; font-size: 12px; }
    .progress { text-align: right; font-size: 13px; }
    main { display: grid; grid-template-columns: minmax(420px, 1.9fr) minmax(260px, 0.9fr); gap: 16px; padding: 16px; }
    .nav { display: flex; gap: 8px; align-items: center; margin: 8px 0 12px; flex-wrap: wrap; }
    button, select, input { font: inherit; }
    button { background: #2a2a2a; color: #eee; border: 1px solid #555; padding: 6px 10px; cursor: pointer; }
    button.primary { background: #3d5a1f; border-color: #7aa33a; font-weight: 600; }
    .viewport { position: relative; overflow: hidden; background: #000; border: 1px solid #444; width: 100%; min-height: 220px; }
    .viewport img { position: absolute; left: 0; top: 0; display: block; }
    .highlight { position: absolute; left: 0; right: 0; border: 2px solid #ffcc33; background: rgba(255, 204, 51, 0.08); pointer-events: none; box-sizing: border-box; }
    form { display: grid; gap: 8px; }
    label { display: grid; gap: 4px; color: #ccc; }
    input { background: #1a1a1a; color: #eee; border: 1px solid #555; padding: 6px; }
    .checks { display: flex; gap: 16px; }
    .checks label { display: flex; gap: 6px; align-items: center; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
    .note { color: #999; font-size: 12px; }
    kbd { border: 1px solid #555; padding: 0 4px; font-size: 11px; }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>Fresh Validation 사람 전사</h1>
      <div class="meta">원본 스크린샷 픽셀만 봅니다. 기계 OCR/후보/복원은 표시하지 않습니다. 시장 표시가 화면에 명확히 보이지 않으면 비워 두세요.</div>
    </div>
    <div class="progress">
      <div><strong id="position">1 / 0</strong></div>
      <div>Annotated <span id="annotatedCount">0</span> / <span id="totalCount">0</span></div>
    </div>
  </header>
  <main>
    <section>
      <div class="nav">
        <button type="button" id="prev">Previous</button>
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
      <p class="note"><kbd>Ctrl</kbd>+<kbd>Enter</kbd> 확인하고 다음</p>
    </section>
    <section>
      <form id="truthForm" autocomplete="off">
        <label>경기번호
          <input id="fieldRowId" name="screenRowIdentifierRaw" tabindex="1" />
        </label>
        <label>왼쪽 참가자
          <input name="participantLeftRaw" tabindex="2" />
        </label>
        <label>오른쪽 참가자
          <input name="participantRightRaw" tabindex="3" />
        </label>
        <label>숫자칸
          <input name="numericCellsRaw" tabindex="4" placeholder="공백 또는 쉼표로 구분" />
        </label>
        <label>시장 표시 raw
          <input name="marketMarkerRaw" tabindex="5" placeholder="명확히 보일 때만. 아니면 비움" />
        </label>
        <div class="checks">
          <label><input type="checkbox" id="uncertain" name="uncertain" tabindex="6" /> UNCERTAIN</label>
          <label><input type="checkbox" id="unreadable" name="unreadable" tabindex="7" /> UNREADABLE</label>
        </div>
        <div class="actions">
          <button type="button" id="confirmNext" class="primary" tabindex="8">확인하고 다음</button>
          <button type="button" id="exportJson">Export JSON</button>
        </div>
        <p class="note">Export JSON 후 Cursor에 전달하세요. 평가는 그 다음입니다.</p>
      </form>
    </section>
  </main>
  <script>
    const PACK = ${escapeHtmlScriptJson(payload)};
    const STORAGE_KEY = "proto-round-fresh-validation-annotation-v0:" + PACK.protoRoundKey;
    const TOTAL = PACK.records.length;
    let index = 0;
    const records = PACK.records.map((r) => ({ ...r }));
    function emptyToNull(v) {
      if (v == null) return null;
      const s = String(v);
      return s.trim() === "" ? null : s;
    }
    function parseNumericCells(v) {
      return String(v || "").split(/[,\\s]+/).filter((s) => s.length > 0);
    }
    function exclusiveOverrides(uncertain, unreadable, lastToggled) {
      if (lastToggled === "unreadable" && unreadable) return { uncertain: false, unreadable: true };
      if (lastToggled === "uncertain" && uncertain) return { uncertain: true, unreadable: false };
      if (unreadable) return { uncertain: false, unreadable: true };
      if (uncertain) return { uncertain: true, unreadable: false };
      return { uncertain: false, unreadable: false };
    }
    function confirmStatus(draft) {
      const ex = exclusiveOverrides(draft.uncertain, draft.unreadable);
      if (ex.unreadable) return "UNREADABLE";
      if (ex.uncertain) return "UNCERTAIN";
      return "COMPLETE";
    }
    function readForm() {
      const form = document.getElementById("truthForm");
      const data = new FormData(form);
      const exclusive = exclusiveOverrides(form.uncertain.checked, form.unreadable.checked);
      return {
        uncertain: exclusive.uncertain,
        unreadable: exclusive.unreadable,
        screenRowIdentifierRaw: emptyToNull(data.get("screenRowIdentifierRaw")),
        participantLeftRaw: emptyToNull(data.get("participantLeftRaw")),
        participantRightRaw: emptyToNull(data.get("participantRightRaw")),
        numericCellsRaw: parseNumericCells(data.get("numericCellsRaw")),
        marketMarkerRaw: emptyToNull(data.get("marketMarkerRaw")),
      };
    }
    function writeForm(record) {
      const form = document.getElementById("truthForm");
      const uncertain = record.annotationStatus === "UNCERTAIN";
      const unreadable = record.annotationStatus === "UNREADABLE";
      const exclusive = exclusiveOverrides(uncertain, unreadable);
      form.uncertain.checked = exclusive.uncertain;
      form.unreadable.checked = exclusive.unreadable;
      form.screenRowIdentifierRaw.value = record.screenRowIdentifierRaw || "";
      form.participantLeftRaw.value = record.participantLeftRaw || "";
      form.participantRightRaw.value = record.participantRightRaw || "";
      form.numericCellsRaw.value = (record.numericCellsRaw || []).join(" ");
      form.marketMarkerRaw.value = record.marketMarkerRaw || "";
    }
    function persistCurrent(confirm) {
      const draft = readForm();
      const current = records[index];
      Object.assign(current, {
        screenRowIdentifierRaw: draft.screenRowIdentifierRaw,
        participantLeftRaw: draft.participantLeftRaw,
        participantRightRaw: draft.participantRightRaw,
        numericCellsRaw: draft.numericCellsRaw,
        marketMarkerRaw: draft.marketMarkerRaw,
        annotationStatus: confirm ? confirmStatus(draft) : current.annotationStatus,
      });
    }
    function autosave(confirm) {
      persistCurrent(confirm === true);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      updateProgress();
    }
    function updateProgress() {
      document.getElementById("position").textContent = (index + 1) + " / " + TOTAL;
      document.getElementById("totalCount").textContent = String(TOTAL);
      document.getElementById("annotatedCount").textContent = String(
        records.filter((r) => r.annotationStatus !== "UNANNOTATED").length
      );
    }
    function layoutCrop() {
      const record = records[index];
      const geo = record.targetRowGeometry;
      const mode = document.getElementById("viewMode").value;
      const rowH = Math.max(1, geo.bottomY - geo.topY);
      const pad = mode === "focus" ? Math.max(8, rowH * 0.28) : Math.max(48, rowH * 2.2);
      const cropTop = Math.max(0, geo.topY - pad);
      const cropBottom = Math.min(geo.imageHeight, geo.bottomY + pad);
      const cropHeight = Math.max(1, cropBottom - cropTop);
      const viewport = document.getElementById("viewport");
      const img = document.getElementById("shot");
      const highlight = document.getElementById("highlight");
      const width = viewport.clientWidth || 900;
      const scale = Math.max(width / geo.imageWidth, 240 / cropHeight);
      viewport.style.height = (cropHeight * scale) + "px";
      img.style.width = width + "px";
      img.style.height = (geo.imageHeight * scale) + "px";
      img.style.top = (-cropTop * scale) + "px";
      highlight.style.top = ((geo.topY - cropTop) * scale) + "px";
      highlight.style.height = ((geo.bottomY - geo.topY) * scale) + "px";
    }
    function render() {
      const record = records[index];
      updateProgress();
      document.getElementById("rowMeta").textContent =
        "visualRowIndex " + record.visualRowIndex + " · " + record.sourceFileName;
      document.getElementById("shot").src = record.screenshotHref;
      writeForm(record);
      requestAnimationFrame(layoutCrop);
      const rowId = document.getElementById("fieldRowId");
      if (rowId) rowId.focus();
    }
    function go(delta) {
      autosave(false);
      index = (index + TOTAL + delta) % TOTAL;
      render();
    }
    function confirmAndNext() {
      autosave(true);
      index = (index + 1) % TOTAL;
      render();
    }
    document.getElementById("truthForm").addEventListener("submit", (e) => e.preventDefault());
    document.getElementById("truthForm").addEventListener("input", () => autosave(false));
    document.getElementById("prev").onclick = () => go(-1);
    document.getElementById("next").onclick = () => go(1);
    document.getElementById("confirmNext").onclick = confirmAndNext;
    document.getElementById("uncertain").addEventListener("change", () => {
      const form = document.getElementById("truthForm");
      const ex = exclusiveOverrides(form.uncertain.checked, form.unreadable.checked, "uncertain");
      form.uncertain.checked = ex.uncertain;
      form.unreadable.checked = ex.unreadable;
      autosave(false);
    });
    document.getElementById("unreadable").addEventListener("change", () => {
      const form = document.getElementById("truthForm");
      const ex = exclusiveOverrides(form.uncertain.checked, form.unreadable.checked, "unreadable");
      form.uncertain.checked = ex.uncertain;
      form.unreadable.checked = ex.unreadable;
      autosave(false);
    });
    document.getElementById("viewMode").onchange = layoutCrop;
    document.getElementById("exportJson").onclick = () => {
      persistCurrent(false);
      const doc = {
        schemaVersion: PACK.schemaVersion,
        protoRoundKey: PACK.protoRoundKey,
        groundTruthSource: PACK.groundTruthSource,
        records: records.map((record) => ({
          sourceImageSha256: record.sourceImageSha256,
          sourceFileName: record.sourceFileName,
          visualRowIndex: record.visualRowIndex,
          annotationStatus: record.annotationStatus,
          screenRowIdentifierRaw: record.screenRowIdentifierRaw,
          participantLeftRaw: record.participantLeftRaw,
          participantRightRaw: record.participantRightRaw,
          numericCellsRaw: record.numericCellsRaw,
          marketMarkerRaw: record.marketMarkerRaw,
        })),
      };
      const blob = new Blob([JSON.stringify(doc, null, 2) + "\\n"], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = ${JSON.stringify(FRESH_ANNOTATION_EXPORT_FILE_NAME)};
      a.click();
      URL.revokeObjectURL(a.href);
    };
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.altKey) && e.key === "Enter") {
        e.preventDefault();
        confirmAndNext();
      }
    });
    window.addEventListener("resize", layoutCrop);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved) && saved.length === records.length) {
          for (let i = 0; i < records.length; i++) {
            if (saved[i] && saved[i].sourceImageSha256 === records[i].sourceImageSha256) {
              records[i] = { ...records[i], ...saved[i], screenshotHref: records[i].screenshotHref };
            }
          }
        }
      }
    } catch {}
    render();
  </script>
</body>
</html>
`;
}
