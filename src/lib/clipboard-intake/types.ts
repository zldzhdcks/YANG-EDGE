/**
 * Common Clipboard Image Intake types (browser memory only).
 * previewUrl must never be persisted to server artifacts or Git.
 */

export type ClipboardIntakeInputKind =
  | "CLIPBOARD_IMAGE"
  | "FILE_IMAGE"
  | "PASTED_TEXT";

export type ClipboardIntakeStatus =
  | "RECEIVED"
  | "VALIDATING"
  | "READY"
  | "PROCESSING"
  | "PROCESSED"
  | "REJECTED"
  | "REMOVED";

export type ClipboardIntakeMaterialType =
  | "KBO_DOMESTIC_PROTO"
  | "KBO_LINEUP"
  | "KBO_STARTER"
  | "UNKNOWN";

export type ClipboardIntakeMaterialAvailability =
  | "ACTIVE"
  | "COMING_SOON"
  | "NOT_IMPLEMENTED";

export type ClipboardIntakeItem = {
  intakeItemId: string;
  intakeRunId: string;
  inputKind: ClipboardIntakeInputKind;
  mimeType: string | null;
  originalName: string | null;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  imageSha256: string | null;
  /** Browser object URL only — revoke on remove/unmount. Never persist. */
  previewUrl: string | null;
  receivedAt: string;
  status: ClipboardIntakeStatus;
  warnings: string[];
  errors: string[];
  /** In-memory File/Blob for multipart upload; not serializable. */
  blob?: Blob | null;
};

export type ClipboardIntakeLimits = {
  maxImages: number;
  maxBytesPerImage: number;
  maxBytesTotal: number;
};

export type ClipboardPasteExtractResult = {
  images: Array<{
    blob: Blob;
    mimeType: string;
    originalName: string | null;
  }>;
  pastedText: string | null;
  unsupportedKinds: string[];
  empty: boolean;
};

export const CLIPBOARD_MATERIAL_OPTIONS: Array<{
  value: ClipboardIntakeMaterialType;
  label: string;
  availability: ClipboardIntakeMaterialAvailability;
}> = [
  {
    value: "KBO_DOMESTIC_PROTO",
    label: "KBO 국내 프로토",
    availability: "ACTIVE",
  },
  {
    value: "KBO_LINEUP",
    label: "KBO 라인업",
    availability: "COMING_SOON",
  },
  {
    value: "KBO_STARTER",
    label: "KBO 선발",
    availability: "COMING_SOON",
  },
  {
    value: "UNKNOWN",
    label: "알 수 없음",
    availability: "NOT_IMPLEMENTED",
  },
];
