import type { Selection } from './types';

/**
 * Same-game-parlay (SGP) grouping for the bet slip.
 *
 * Any 2+ selections that share a `matchId` collapse into a single SGP block
 * (one match-info header + its member rows). A match with a single selection
 * stays a standalone item. The three bet-slip views (summarized slip, floating
 * "Resumen" card, success confirmation) all render the SAME grouped structure,
 * with a divider between every unit — SGP↔SGP, SGP↔single, single↔single.
 *
 * Order is preserved from the incoming list (the views pass selections
 * latest-first): a match takes the position of its FIRST-seen member, and
 * members keep their relative order within the group.
 */

export type MatchInfo = {
  matchId: string;
  homeAbbrev: string;
  awayAbbrev: string;
  matchTime: string;
};

export type SelectionGroup =
  /** 2+ selections from the same match → one SGP block. */
  | { kind: 'sgp'; match: MatchInfo; selections: Selection[] }
  /** A lone selection from a match → standalone item. */
  | { kind: 'single'; selection: Selection };

function matchInfo(s: Selection): MatchInfo {
  return {
    matchId: s.matchId,
    homeAbbrev: s.homeAbbrev,
    awayAbbrev: s.awayAbbrev,
    matchTime: s.matchTime,
  };
}

export function groupSelections(selections: Selection[]): SelectionGroup[] {
  const order: string[] = [];
  const byMatch = new Map<string, Selection[]>();
  for (const s of selections) {
    if (!byMatch.has(s.matchId)) {
      byMatch.set(s.matchId, []);
      order.push(s.matchId);
    }
    byMatch.get(s.matchId)!.push(s);
  }
  return order.map((matchId): SelectionGroup => {
    const sels = byMatch.get(matchId)!;
    return sels.length >= 2
      ? { kind: 'sgp', match: matchInfo(sels[0]), selections: sels }
      : { kind: 'single', selection: sels[0] };
  });
}
