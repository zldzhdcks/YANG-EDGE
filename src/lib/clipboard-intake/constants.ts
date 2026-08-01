/**
 * Clipboard intake limits — keep aligned with Proto OCR image validation.
 */
import {
  PROTO_OCR_MAX_BYTES_PER_IMAGE,
  PROTO_OCR_MAX_BYTES_TOTAL,
  PROTO_OCR_MAX_IMAGES,
} from "@/lib/kbo/proto-ocr/image-validation";
import type { ClipboardIntakeLimits } from "./types";

export const CLIPBOARD_INTAKE_LIMITS: ClipboardIntakeLimits = {
  maxImages: PROTO_OCR_MAX_IMAGES,
  maxBytesPerImage: PROTO_OCR_MAX_BYTES_PER_IMAGE,
  maxBytesTotal: PROTO_OCR_MAX_BYTES_TOTAL,
};

export const CLIPBOARD_ALLOWED_MIME = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export type ClipboardAllowedMime = (typeof CLIPBOARD_ALLOWED_MIME)[number];
