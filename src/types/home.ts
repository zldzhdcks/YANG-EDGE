import type { FeatureData } from "./feature";
import type { SportData } from "./sport";
import type { SportsProviderKind } from "@/lib/sports/types";

/**
 * 홈 경기 목록(Featured + 오늘 경기) 로드 상태.
 * Today EDGE Pick 의 상태 구분과 동일한 원칙:
 * 오류를 빈 목록으로 숨기지 않는다.
 *
 * - success: 오늘 일정 존재 (featured 는 조건 미충족 시 빈 배열일 수 있음)
 * - empty:   오늘 등록된 경기 일정 없음 (정상)
 * - error:   네트워크 / HTTP / 응답 형식 / 설정 오류
 */
export type HomeGamesLoadResult =
  | {
      status: "success";
      featured: FeatureData[];
      sports: SportData[];
      providerKind: SportsProviderKind;
    }
  | {
      status: "empty";
      providerKind: SportsProviderKind;
    }
  | {
      status: "error";
      message: string;
      providerKind: SportsProviderKind;
    };
