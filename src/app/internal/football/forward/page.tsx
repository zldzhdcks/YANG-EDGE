import type { Metadata } from "next";
import FootballForwardErrorState from "@/components/internal/football/forward/FootballForwardErrorState";
import FootballForwardResearchDashboard from "@/components/internal/football/forward/FootballForwardResearchDashboard";
import { loadOfficialForwardInternalPage } from "@/lib/football/forward-internal-prototype-v1";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Official Forward Football Research",
  robots: { index: false, follow: false },
};

export default function OfficialForwardInternalPage() {
  const page = loadOfficialForwardInternalPage();
  if (page.status === "error") {
    return <FootballForwardErrorState code={page.code} />;
  }
  return (
    <main className="min-h-screen bg-[#09090b] text-zinc-100">
      <FootballForwardResearchDashboard model={page.model} />
    </main>
  );
}
