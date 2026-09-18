import type { ForwardGradedEvent } from "../forward-read-model-v1";
import { FORWARD_EVENT_ORDER } from "./constants";

export function orderOfficialForwardEvents(
  events: readonly ForwardGradedEvent[],
): ForwardGradedEvent[] {
  return [...events].sort((a, b) => {
    const byKickoff = Date.parse(b.kickoffUtc) - Date.parse(a.kickoffUtc);
    if (byKickoff !== 0) return byKickoff;
    return b.fixtureId - a.fixtureId;
  });
}

export { FORWARD_EVENT_ORDER };
