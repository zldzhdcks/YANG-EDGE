import type {Metadata} from "next";
import FootballV31ResearchConsoleView from "@/components/internal/football/FootballV31ResearchConsoleView";
import {loadResearchConsole} from "@/lib/football/v31-internal-research-console-v1/load-console-v1";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Football V3.1 Internal Research Console",
  robots: {index: false, follow: false},
};

export default function FootballV31InternalResearchPage() {
  const data = loadResearchConsole();
  return <FootballV31ResearchConsoleView data={data} />;
}
