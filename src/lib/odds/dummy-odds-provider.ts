import {
  buildOddsData,
  emptyUsage,
  type OddsProvider,
} from "./odds-provider";
import type {
  GetOddsParams,
  GetOddsResult,
  OddsBookmaker,
  OddsEventListing,
  OddsSportInfo,
} from "./types";

/**
 * 개발·단위 테스트용 Dummy Odds.
 * getOddsProvider() 기본 경로에서는 선택되지 않는다.
 * ODDS_PROVIDER=dummy 로만 명시적 선택.
 */
export class DummyOddsProvider implements OddsProvider {
  readonly kind = "dummy" as const;

  async listSports(): Promise<{
    sports: OddsSportInfo[];
    usage: ReturnType<typeof emptyUsage>;
  }> {
    return {
      sports: [
        {
          key: "baseball_kbo",
          group: "Baseball",
          title: "KBO",
          description: "Korea Baseball Organization",
          active: true,
          hasOutrights: false,
        },
        {
          key: "baseball_npb",
          group: "Baseball",
          title: "NPB",
          description: "Nippon Professional Baseball",
          active: true,
          hasOutrights: false,
        },
      ],
      usage: emptyUsage(),
    };
  }

  async listEvents(
    _sportKey: string,
  ): Promise<{ events: OddsEventListing[]; usage: ReturnType<typeof emptyUsage> }> {
    return { events: [], usage: emptyUsage() };
  }

  async getOdds(params: GetOddsParams): Promise<GetOddsResult> {
    const now = new Date().toISOString();
    const bookmakers: OddsBookmaker[] = [
      {
        key: "dummybook",
        title: "Dummy Book",
        lastUpdate: now,
        markets: [
          {
            key: "h2h",
            lastUpdate: now,
            outcomes: [
              { name: "Doosan Bears", price: 1.95 },
              { name: "Samsung Lions", price: 1.85 },
            ],
          },
        ],
      },
    ];

    const event = buildOddsData({
      externalEventId: "dummy-kbo-doosan-samsung",
      sportKey: params.sportKey,
      homeTeam: "Doosan Bears",
      awayTeam: "Samsung Lions",
      commenceTime: now,
      bookmakers,
      lastUpdated: now,
      source: "dummy",
    });

    return {
      events: params.sportKey.toLowerCase().includes("kbo") ? [event] : [],
      usage: emptyUsage(),
      sportKey: params.sportKey,
      cached: false,
      fetchedAt: now,
    };
  }
}
