import { findDateAnchors } from "../proto-round-row-anchor-schedule-v0/date";
import { parseImmediateTime } from "../proto-round-row-anchor-schedule-v0/time";
import type { LayoutFragmentV0, LayoutStatus } from "./types";
import type { JoinedLayoutRowV0 } from "./lineage";
import { layoutFragmentFromVisual, sortByNormalizedX } from "./geometry";

export type LocatedRowGeometry = {
  layoutStatus: LayoutStatus;
  fragments: LayoutFragmentV0[];
  identifierFragment: LayoutFragmentV0 | null;
  dateTimeFragments: LayoutFragmentV0[];
  semanticRemainderFragments: LayoutFragmentV0[];
  lastAnchorIndex: number | null;
};

export function locateRowGeometry(joined: JoinedLayoutRowV0): LocatedRowGeometry {
  const width = joined.imageWidth;
  if (width == null || !(width > 0)) {
    return {
      layoutStatus: "GEOMETRY_UNAVAILABLE",
      fragments: [],
      identifierFragment: null,
      dateTimeFragments: [],
      semanticRemainderFragments: [],
      lastAnchorIndex: null,
    };
  }
  const fragments = sortByNormalizedX(
    joined.visual.fragments.map((f) => layoutFragmentFromVisual(f, width)),
  );
  const texts = fragments.map((f) => f.rawText);
  const dates = findDateAnchors(texts);
  const uniqueDate = dates.length === 1 ? dates[0]! : null;
  let identifierFragment: LayoutFragmentV0 | null = null;
  const dateTimeFragments: LayoutFragmentV0[] = [];
  let lastAnchorIndex: number | null = null;

  if (uniqueDate) {
    const identRaw = joined.semantic.rowIdentifierRaw;
    if (
      joined.semantic.rowIdentifierParseStatus === "EXACT_ONE" &&
      identRaw != null
    ) {
      for (let i = 0; i < uniqueDate.startIndex; i++) {
        if (fragments[i]!.rawText === identRaw) {
          identifierFragment = fragments[i]!;
          break;
        }
      }
    }
    const dateEnd = uniqueDate.startIndex + uniqueDate.consumedFragments;
    for (let i = uniqueDate.startIndex; i < dateEnd; i++) {
      dateTimeFragments.push(fragments[i]!);
    }
    lastAnchorIndex = dateEnd - 1;
    if (uniqueDate.remainder.trim() === "") {
      const following = texts.slice(dateEnd);
      const timeHit = parseImmediateTime({
        remainder: uniqueDate.remainder,
        followingTexts: following,
      });
      if (
        timeHit.status === "PARSED_EXACT" ||
        timeHit.status === "INVALID_TIME" ||
        timeHit.status === "OCR_AMBIGUOUS"
      ) {
        const extra = timeHit.rawParts.length;
        for (let k = 0; k < extra; k++) {
          const frag = fragments[dateEnd + k];
          if (frag) {
            dateTimeFragments.push(frag);
            lastAnchorIndex = dateEnd + k;
          }
        }
      } else if (
        timeHit.rawParts.length === 2 &&
        timeHit.status === "PARSED_EXACT"
      ) {
        lastAnchorIndex = dateEnd + 1;
      }
    }
  }

  const remainder =
    lastAnchorIndex == null
      ? fragments
      : fragments.slice(lastAnchorIndex + 1);

  const layoutStatus: LayoutStatus =
    joined.semantic.rowIdentifierParseStatus === "EXACT_ONE" && uniqueDate
      ? "ANCHOR_COMPLETE"
      : "ANCHOR_INCOMPLETE";

  return {
    layoutStatus,
    fragments,
    identifierFragment,
    dateTimeFragments,
    semanticRemainderFragments: remainder,
    lastAnchorIndex,
  };
}
