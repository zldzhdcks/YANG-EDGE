import type { DiscoveryAnnotationDocumentV0, DiscoveryAnnotationRecordV0 } from "./types";
import {
  CONFIRM_AND_NEXT_LABEL,
  OPTIONAL_SECTION_LABEL,
  PILOT_SAMPLE_SIZE,
  QUICK_UI_LABELS,
} from "./quick-ui";

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
  return records.map((record, index) => ({
    sourceImageSha256: record.sourceImageSha256,
    sourceFileName: record.sourceFileName,
    visualRowIndex: record.visualRowIndex,
    targetRowGeometry: record.targetRowGeometry,
    screenshotHref:
      index < PILOT_SAMPLE_SIZE ? screenshotHref(record.screenshotRelativePath) : "",
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
 * Discovery-only quick annotation page.
 * Original screenshot pixels via CSS crop. No OCR text. No parser guesses.
 */
export function renderDiscoveryAnnotationHtml(
  doc: DiscoveryAnnotationDocumentV0,
): string {
  const payload = {
    schemaVersion: doc.schemaVersion,
    protoRoundKey: doc.protoRoundKey,
    pilotSampleSize: PILOT_SAMPLE_SIZE,
    records: viewerRecords(doc.records),
  };
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Proto Round Ground Truth Discovery v0</title>
  <style>
    :root { color-scheme: dark; }
    body { margin: 0; font: 14px/1.4 system-ui, sans-serif; background: #111; color: #eee; }
    header { padding: 12px 16px; border-bottom: 1px solid #333; display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    h1 { font-size: 16px; margin: 0 0 6px; }
    .meta { color: #aaa; font-size: 12px; }
    .progress { text-align: right; font-size: 13px; }
    .progress strong { font-size: 16px; }
    main { display: grid; grid-template-columns: minmax(420px, 1.9fr) minmax(260px, 0.9fr); gap: 16px; padding: 16px; }
    .nav { display: flex; gap: 8px; align-items: center; margin: 8px 0 12px; flex-wrap: wrap; }
    button, select, input, textarea { font: inherit; }
    button { background: #2a2a2a; color: #eee; border: 1px solid #555; padding: 6px 10px; cursor: pointer; }
    button.primary { background: #3d5a1f; border-color: #7aa33a; font-weight: 600; }
    .viewport { position: relative; overflow: hidden; background: #000; border: 1px solid #444; width: 100%; min-height: 220px; }
    .viewport img { position: absolute; left: 0; top: 0; display: block; }
    .highlight { position: absolute; left: 0; right: 0; border: 2px solid #ffcc33; background: rgba(255, 204, 51, 0.08); pointer-events: none; box-sizing: border-box; }
    form { display: grid; gap: 8px; }
    label { display: grid; gap: 4px; color: #ccc; }
    input, textarea { background: #1a1a1a; color: #eee; border: 1px solid #555; padding: 6px; }
    textarea { min-height: 56px; }
    .checks { display: flex; gap: 16px; }
    .checks label { display: flex; gap: 6px; align-items: center; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; align-items: center; }
    .note { color: #999; font-size: 12px; }
    details { border: 1px solid #333; padding: 8px; }
    details summary { cursor: pointer; color: #bbb; }
    kbd { border: 1px solid #555; padding: 0 4px; font-size: 11px; }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>Discovery 파일럿 10</h1>
      <div class="meta">
        앞 10개만 눈으로 옮기세요. OCR/파서 후보는 표시하지 않습니다.
      </div>
    </div>
    <div class="progress">
      <div><strong id="position">1 / 10</strong></div>
      <div>Annotated <span id="annotatedCount">0</span> / <span id="totalCount">10</span></div>
      <div class="note">Last saved: <span id="lastSaved">--:--:--</span></div>
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
      <p class="note"><kbd>Ctrl</kbd>+<kbd>Enter</kbd> ${CONFIRM_AND_NEXT_LABEL} · 화살표는 초안만 저장</p>
    </section>
    <section>
      <form id="truthForm" autocomplete="off">
        <label>${QUICK_UI_LABELS.screenRowIdentifierRaw}
          <input id="fieldRowId" name="screenRowIdentifierRaw" data-schema-field="screenRowIdentifierRaw" tabindex="1" />
        </label>
        <label>${QUICK_UI_LABELS.participantLeftRaw}
          <input id="fieldLeft" name="participantLeftRaw" data-schema-field="participantLeftRaw" tabindex="2" />
        </label>
        <label>${QUICK_UI_LABELS.participantRightRaw}
          <input id="fieldRight" name="participantRightRaw" data-schema-field="participantRightRaw" tabindex="3" />
        </label>
        <label>${QUICK_UI_LABELS.numericCellsRaw}
          <input id="fieldNumeric" name="numericCellsRaw" data-schema-field="numericCellsRaw" tabindex="4" placeholder="공백 또는 쉼표로 구분" />
        </label>
        <div class="checks">
          <label><input type="checkbox" id="uncertain" name="uncertain" tabindex="6" /> UNCERTAIN</label>
          <label><input type="checkbox" id="unreadable" name="unreadable" tabindex="7" /> UNREADABLE</label>
        </div>
        <details>
          <summary>${OPTIONAL_SECTION_LABEL}</summary>
          <label>${QUICK_UI_LABELS.screenDateRaw}
            <input name="screenDateRaw" data-schema-field="screenDateRaw" tabindex="20" />
          </label>
          <label>${QUICK_UI_LABELS.screenTimeRaw}
            <input name="screenTimeRaw" data-schema-field="screenTimeRaw" tabindex="21" />
          </label>
          <label>${QUICK_UI_LABELS.leagueDisplayRaw}
            <input name="leagueDisplayRaw" data-schema-field="leagueDisplayRaw" tabindex="22" />
          </label>
          <label>${QUICK_UI_LABELS.marketMarkerRaw}
            <input name="marketMarkerRaw" data-schema-field="marketMarkerRaw" tabindex="23" />
          </label>
          <label>${QUICK_UI_LABELS.statusTextRaw}
            <input name="statusTextRaw" data-schema-field="statusTextRaw" tabindex="24" />
          </label>
          <label>${QUICK_UI_LABELS.otherVisibleTextRaw}
            <textarea name="otherVisibleTextRaw" data-schema-field="otherVisibleTextRaw" tabindex="25"></textarea>
          </label>
          <label>${QUICK_UI_LABELS.annotatorNotes}
            <textarea name="annotatorNotes" data-schema-field="annotatorNotes" tabindex="26"></textarea>
          </label>
        </details>
        <div class="actions">
          <button type="button" id="confirmNext" class="primary" tabindex="5">${CONFIRM_AND_NEXT_LABEL}</button>
          <button type="button" id="saveLocal">Save locally</button>
          <button type="button" id="exportJson">Export JSON</button>
        </div>
        <p class="note">Browser local save is convenience only, not the official record. Export JSON, then import it into discovery-annotation-v0.json. A later pack build will not blank existing human JSON.</p>
      </form>
    </section>
  </main>
  <script>
    const PACK = ${escapeHtmlScriptJson(payload)};
    const STORAGE_KEY = "proto-round-ground-truth-discovery-v0:" + PACK.protoRoundKey;
    const PILOT_COUNT = PACK.pilotSampleSize || 10;
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
    function formatNumericCells(cells) {
      return (cells || []).join(" ");
    }
    function lines(v) {
      return String(v || "")
        .split(/\\n/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
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
    function pickTruth(src) {
      return {
        annotationStatus: src.annotationStatus || "UNANNOTATED",
        draftUncertain: src.draftUncertain === true,
        draftUnreadable: src.draftUnreadable === true,
        screenRowIdentifierRaw: emptyToNull(src.screenRowIdentifierRaw),
        screenDateRaw: emptyToNull(src.screenDateRaw),
        screenTimeRaw: emptyToNull(src.screenTimeRaw),
        leagueDisplayRaw: emptyToNull(src.leagueDisplayRaw),
        participantLeftRaw: emptyToNull(src.participantLeftRaw),
        participantRightRaw: emptyToNull(src.participantRightRaw),
        marketMarkerRaw: emptyToNull(src.marketMarkerRaw),
        numericCellsRaw: Array.isArray(src.numericCellsRaw) ? src.numericCellsRaw : parseNumericCells(src.numericCellsRaw),
        statusTextRaw: emptyToNull(src.statusTextRaw),
        otherVisibleTextRaw: Array.isArray(src.otherVisibleTextRaw) ? src.otherVisibleTextRaw : [],
        annotatorNotes: emptyToNull(src.annotatorNotes),
      };
    }
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
          if (i >= PILOT_COUNT) continue;
          records[i] = { ...records[i], ...pickTruth(src) };
        }
      } catch {}
    }
    function restoreNonPilotRecords() {
      for (let i = PILOT_COUNT; i < records.length; i++) {
        records[i] = { ...PACK.records[i] };
      }
    }
    function readForm() {
      const form = document.getElementById("truthForm");
      const data = new FormData(form);
      const exclusive = exclusiveOverrides(form.uncertain.checked, form.unreadable.checked);
      return {
        uncertain: exclusive.uncertain,
        unreadable: exclusive.unreadable,
        screenRowIdentifierRaw: emptyToNull(data.get("screenRowIdentifierRaw")),
        screenDateRaw: emptyToNull(data.get("screenDateRaw")),
        screenTimeRaw: emptyToNull(data.get("screenTimeRaw")),
        leagueDisplayRaw: emptyToNull(data.get("leagueDisplayRaw")),
        participantLeftRaw: emptyToNull(data.get("participantLeftRaw")),
        participantRightRaw: emptyToNull(data.get("participantRightRaw")),
        marketMarkerRaw: emptyToNull(data.get("marketMarkerRaw")),
        numericCellsRaw: parseNumericCells(data.get("numericCellsRaw")),
        statusTextRaw: emptyToNull(data.get("statusTextRaw")),
        otherVisibleTextRaw: lines(data.get("otherVisibleTextRaw")),
        annotatorNotes: emptyToNull(data.get("annotatorNotes")),
      };
    }
    function writeForm(record) {
      const form = document.getElementById("truthForm");
      const uncertain = record.annotationStatus === "UNCERTAIN" || record.draftUncertain === true;
      const unreadable = record.annotationStatus === "UNREADABLE" || record.draftUnreadable === true;
      const exclusive = exclusiveOverrides(uncertain, unreadable);
      form.uncertain.checked = exclusive.uncertain;
      form.unreadable.checked = exclusive.unreadable;
      form.screenRowIdentifierRaw.value = record.screenRowIdentifierRaw || "";
      form.screenDateRaw.value = record.screenDateRaw || "";
      form.screenTimeRaw.value = record.screenTimeRaw || "";
      form.leagueDisplayRaw.value = record.leagueDisplayRaw || "";
      form.participantLeftRaw.value = record.participantLeftRaw || "";
      form.participantRightRaw.value = record.participantRightRaw || "";
      form.marketMarkerRaw.value = record.marketMarkerRaw || "";
      form.numericCellsRaw.value = formatNumericCells(record.numericCellsRaw || []);
      form.statusTextRaw.value = record.statusTextRaw || "";
      form.otherVisibleTextRaw.value = (record.otherVisibleTextRaw || []).join("\\n");
      form.annotatorNotes.value = record.annotatorNotes || "";
    }
    function persistCurrent(confirm) {
      const draft = readForm();
      if (index >= PILOT_COUNT) return;
      const current = records[index];
      Object.assign(current, {
        screenRowIdentifierRaw: draft.screenRowIdentifierRaw,
        screenDateRaw: draft.screenDateRaw,
        screenTimeRaw: draft.screenTimeRaw,
        leagueDisplayRaw: draft.leagueDisplayRaw,
        participantLeftRaw: draft.participantLeftRaw,
        participantRightRaw: draft.participantRightRaw,
        marketMarkerRaw: draft.marketMarkerRaw,
        numericCellsRaw: draft.numericCellsRaw,
        statusTextRaw: draft.statusTextRaw,
        otherVisibleTextRaw: draft.otherVisibleTextRaw,
        annotatorNotes: draft.annotatorNotes,
        draftUncertain: draft.uncertain,
        draftUnreadable: draft.unreadable,
        annotationStatus: confirm ? confirmStatus(draft) : current.annotationStatus,
      });
    }
    function clock() {
      const d = new Date();
      return [d.getHours(), d.getMinutes(), d.getSeconds()]
        .map((n) => String(n).padStart(2, "0"))
        .join(":");
    }
    function autosave(confirm) {
      persistCurrent(confirm === true);
      restoreNonPilotRecords();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records.map((r) => ({
        sourceImageSha256: r.sourceImageSha256,
        visualRowIndex: r.visualRowIndex,
        ...pickTruth(r),
      }))));
      document.getElementById("lastSaved").textContent = clock();
      updateProgress();
    }
    function updateProgress() {
      document.getElementById("position").textContent = (index + 1) + " / " + PILOT_COUNT;
      document.getElementById("totalCount").textContent = String(PILOT_COUNT);
      document.getElementById("annotatedCount").textContent = String(
        records.slice(0, PILOT_COUNT).filter((r) => r.annotationStatus !== "UNANNOTATED").length
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
      index = (index + PILOT_COUNT + delta) % PILOT_COUNT;
      render();
    }
    function confirmAndNext() {
      autosave(true);
      index = (index + 1) % PILOT_COUNT;
      render();
    }
    function exportDocument() {
      persistCurrent(false);
      restoreNonPilotRecords();
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
    function inTextField(el) {
      if (!el) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA";
    }
    document.getElementById("truthForm").addEventListener("submit", (e) => e.preventDefault());
    document.getElementById("truthForm").addEventListener("input", () => autosave(false));
    document.getElementById("truthForm").addEventListener("change", () => autosave(false));
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
    document.getElementById("saveLocal").onclick = () => autosave(false);
    document.getElementById("exportJson").onclick = () => {
      const blob = new Blob([JSON.stringify(exportDocument(), null, 2) + "\\n"], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "discovery-annotation-v0.json";
      a.click();
      URL.revokeObjectURL(a.href);
    };
    document.addEventListener("keydown", (e) => {
      const editing = inTextField(e.target) && e.target.type !== "checkbox";
      const shortcut = e.ctrlKey || e.altKey;
      if (e.key === "Enter" && shortcut) {
        e.preventDefault();
        confirmAndNext();
        return;
      }
      if (e.key === "Enter" && editing) {
        return;
      }
      if (e.key === "ArrowLeft" && (!editing || shortcut)) {
        e.preventDefault();
        go(-1);
        return;
      }
      if (e.key === "ArrowRight" && (!editing || shortcut)) {
        e.preventDefault();
        go(1);
      }
    });
    window.addEventListener("resize", layoutCrop);
    loadLocal();
    restoreNonPilotRecords();
    render();
  </script>
</body>
</html>
`;
}
