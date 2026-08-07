import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { resolveOsDate } from "@/lib/internal/load-yang-edge-os-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "YANG EDGE OS",
  robots: { index: false, follow: false },
};

export default async function InternalIndexPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const dateKst = await resolveOsDate(searchParams);
  redirect(`/internal/dashboard?date=${encodeURIComponent(dateKst)}`);
}
