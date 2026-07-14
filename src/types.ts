export type Selection = {
  id: string;
  /** Betting market, e.g. "Money line" or "Anota gol en cualquier momento". */
  market: string;
  /** The chosen selection within the market, e.g. "Real Madrid" / "Mbappé". */
  pick: string;
  odds: number;
  /** Match this selection belongs to. Two+ selections that share a `matchId`
      are grouped into a single same-game-parlay (SGP) block in the bet slip. */
  matchId: string;
  /** Home team abbreviation shown in the SGP group header (e.g. "PSG"). */
  homeAbbrev: string;
  /** Away team abbreviation shown in the SGP group header (e.g. "RMA"). */
  awayAbbrev: string;
  /** Kickoff label shown next to the teams / under a standalone pick
      (e.g. "Hoy 18:00"). */
  matchTime: string;
};

export type Tier = 0 | 1 | 2 | 3 | 4;

export type TierConfig = {
  id: Tier;
  name: string;
  minOdds: number;
};
