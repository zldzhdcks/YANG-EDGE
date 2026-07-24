import type { FeatureData } from "@/types/feature";

export const FEATURES: FeatureData[] = [
  {
    id: "dashboard",
    title: "하나의 화면에서 모든 데이터",
    description: "축구, 야구, 농구 경기를 한곳에서 확인합니다.",
    icon: "dashboard",
  },
  {
    id: "ai",
    title: "EDGE 근거 제공",
    description: "EDGE Score 뒤에 숨은 분석 근거를 함께 제공합니다.",
    icon: "ai",
  },
  {
    id: "sync",
    title: "자동 업데이트",
    description: "경기 일정과 분석 결과가 실시간으로 반영됩니다.",
    icon: "sync",
  },
  {
    id: "engine",
    title: "매일 학습하는 EDGE Engine",
    description: "경기 결과를 학습해 분석 정확도를 높입니다.",
    icon: "engine",
  },
];
