import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import LedgerPageContent from "@/components/ledger/LedgerPageContent";

export const metadata: Metadata = {
  title: "개인 베팅 가계부 | YANG EDGE",
  description:
    "직접 구매한 스포츠 베팅 내역을 기록하고 손익·자금 상태를 확인하는 개인용 관리 도구입니다.",
};

export default function LedgerPage() {
  return (
    <>
      <Header />
      <main>
        <LedgerPageContent />
      </main>
      <Footer />
    </>
  );
}
