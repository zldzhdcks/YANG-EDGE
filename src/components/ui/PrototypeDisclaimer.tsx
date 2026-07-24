import {
  PROTOTYPE_DISCLAIMER_TEXT,
  SHOW_PROTOTYPE_DISCLAIMER,
} from "@/constants/prototype";

export default function PrototypeDisclaimer() {
  if (!SHOW_PROTOTYPE_DISCLAIMER) return null;

  return (
    <p className="mt-10 text-center text-[11px] text-zinc-600">
      {PROTOTYPE_DISCLAIMER_TEXT}
    </p>
  );
}
