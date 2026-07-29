"use client";

import dynamic from "next/dynamic";
import type { BridgeData } from "./KboOperatorInputBridge";

const KboOperatorInputBridge = dynamic(
  () => import("./KboOperatorInputBridge"),
  { ssr: false },
);

export default function KboOperatorInputBridgeEntry(props: {
  initialData: BridgeData;
}) {
  return <KboOperatorInputBridge {...props} />;
}
