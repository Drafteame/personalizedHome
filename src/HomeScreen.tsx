import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useFeaturedMatchSequence, FeaturedMatchParticles, FeaturedBetCount } from './FeaturedMatchMotion';
import { buttonProgressionConfig } from './buttonProgressionConfig';
import betsIcon from './assets/bets.svg';
import chevronIcon from './assets/chevron.svg';
import gamingIcon from './assets/gaming.svg';
import logoDrafteaIcon from './assets/logo-draftea.svg';
import misEntradasIcon from './assets/mis_entradas.svg';
import playerIcon from './assets/player.svg';
import plusIcon from './assets/plus.svg';
import popularIcon from './assets/popular.svg';
import rewardsIcon from './assets/rewards.png';
import searchIcon from './assets/search.svg';
import shieldIcon from './assets/shield.svg';
import statsIcon from './assets/stats.svg';
import userIcon from './assets/user.svg';
import redCardIcon from './assets/featured-red-card.svg';
import cornerIcon from './assets/featured-corner.svg';
import rightChevronIcon from './assets/chevron_right.svg';
import paraTiIcon from './assets/paraTiIcon.png';
import { useHorizontalDragScroll } from './useHorizontalDragScroll';
import type { Selection } from './types';

/* ============================================================ */
/*  Match + pick data — the offer this prototype exposes.         */
/*                                                                */
/*  FOUR matches are on the feed (a swipeable card carousel of     */
/*  their money lines + two shared player markets below). Each     */
/*  pick carries its MATCH (matchId + team abbrevs + kickoff) so   */
/*  the bet slip can group 2+ picks from the same match into a     */
/*  same-game-parlay (SGP) block, while picks from different       */
/*  matches stay standalone. Having several real matches on the    */
/*  feed lets us build + verify both cases by tapping the offer.   */
/* ============================================================ */

// Player markets rendered as the 2×2 player-card accordions (MarketAccordion).
export const GOALS_MARKET = 'Anota gol en cualquier momento';
export const SHOTS_MARKET = 'Tiros al arco';

// Per-match display metadata (used by the card carousel + the SGP headers).
export type MatchInfo = {
  matchId: string;
  league: string;
  homeName: string;
  awayName: string;
  homeAbbrev: string;
  awayAbbrev: string;
  matchTime: string;
  betCount: number;
};

export const MATCHES: MatchInfo[] = [
  { betCount: 12000, matchId: 'psg-rma', league: 'Champions', homeName: 'Paris-Saint Germain', awayName: 'Real Madrid', homeAbbrev: 'PSG', awayAbbrev: 'RMA', matchTime: 'Hoy 18:00' },
  { betCount: 8600, matchId: 'ars-rma', league: 'Champions', homeName: 'Arsenal', awayName: 'Real Madrid', homeAbbrev: 'ARS', awayAbbrev: 'RMA', matchTime: 'Hoy 20:00' },
  { betCount: 9400, matchId: 'fcb-psg', league: 'Champions', homeName: 'Barcelona', awayName: 'Paris-Saint Germain', homeAbbrev: 'FCB', awayAbbrev: 'PSG', matchTime: 'Mañana 21:00' },
  { betCount: 8200, matchId: 'liv-mci', league: 'Premier', homeName: 'Liverpool', awayName: 'Manchester City', homeAbbrev: 'LIV', awayAbbrev: 'MCI', matchTime: 'Mañana 14:00' },
];

const PREMIER_MATCHES: MatchInfo[] = [
  MATCHES[3],
  { betCount: 6400, matchId: 'ars-che', league: 'Premier', homeName: 'Arsenal', awayName: 'Chelsea', homeAbbrev: 'ARS', awayAbbrev: 'CHE', matchTime: 'Hoy 17:00' },
  { betCount: 5100, matchId: 'mun-tot', league: 'Premier', homeName: 'Manchester United', awayName: 'Tottenham', homeAbbrev: 'MUN', awayAbbrev: 'TOT', matchTime: 'Mañana 19:00' },
];

// Only the match fields carried by each Selection (league/full names live in MATCHES).
const matchOf = (m: MatchInfo) => ({
  matchId: m.matchId,
  homeAbbrev: m.homeAbbrev,
  awayAbbrev: m.awayAbbrev,
  matchTime: m.matchTime,
});
const [M_PSG_RMA, M_ARS_RMA, M_FCB_PSG, M_LIV_MCI] = MATCHES.map(matchOf);

export const MOCK_PICKS: Selection[] = [
  // ===== PSG vs Real Madrid =====
  { id: 'psg-w', market: 'Money line', pick: 'PSG', odds: 1.75, ...M_PSG_RMA },
  { id: 'draw', market: 'Money line', pick: 'Empate', odds: 3.8, ...M_PSG_RMA },
  { id: 'rma-w', market: 'Money line', pick: 'Real Madrid', odds: 2.75, ...M_PSG_RMA },
  { id: 'lewa', market: GOALS_MARKET, pick: 'Lewandowski', odds: 1.95, ...M_PSG_RMA },
  { id: 'mbappe', market: GOALS_MARKET, pick: 'Mbappé', odds: 1.65, ...M_PSG_RMA },
  { id: 'vini', market: GOALS_MARKET, pick: 'Vinicius', odds: 2.1, ...M_PSG_RMA },
  { id: 'mbappe-htrick', market: GOALS_MARKET, pick: 'Mbappé', odds: 9.0, ...M_PSG_RMA },
  { id: 'lewa-htrick', market: GOALS_MARKET, pick: 'Lewandowski', odds: 11.0, ...M_PSG_RMA },
  { id: 'vini-htrick', market: GOALS_MARKET, pick: 'Vinicius', odds: 16.0, ...M_PSG_RMA },
  { id: 'lewa-4goals', market: GOALS_MARKET, pick: 'Lewandowski', odds: 28.0, ...M_PSG_RMA },
  { id: 'mbappe-4goals', market: GOALS_MARKET, pick: 'Mbappé', odds: 60.0, ...M_PSG_RMA },
  { id: 'mbappe-tiros', market: SHOTS_MARKET, pick: 'Mbappé', odds: 1.55, ...M_PSG_RMA },
  { id: 'vini-tiros', market: SHOTS_MARKET, pick: 'Vinicius', odds: 1.8, ...M_PSG_RMA },
  { id: 'lewa-tiros', market: SHOTS_MARKET, pick: 'Lewandowski', odds: 1.7, ...M_PSG_RMA },
  // ===== Arsenal vs Real Madrid =====
  { id: 'ars-w', market: 'Money line', pick: 'Arsenal', odds: 2.1, ...M_ARS_RMA },
  { id: 'ars-draw', market: 'Money line', pick: 'Empate', odds: 3.4, ...M_ARS_RMA },
  { id: 'ars-rma', market: 'Money line', pick: 'Real Madrid', odds: 2.55, ...M_ARS_RMA },
  { id: 'ars-saka', market: GOALS_MARKET, pick: 'Saka', odds: 2.6, ...M_ARS_RMA },
  { id: 'ars-odegaard', market: GOALS_MARKET, pick: 'Ødegaard', odds: 3.1, ...M_ARS_RMA },
  { id: 'ars-saka-tiros', market: SHOTS_MARKET, pick: 'Saka', odds: 1.9, ...M_ARS_RMA },
  // ===== Barcelona vs PSG =====
  { id: 'fcb-w', market: 'Money line', pick: 'Barcelona', odds: 2.4, ...M_FCB_PSG },
  { id: 'fcb-draw', market: 'Money line', pick: 'Empate', odds: 3.5, ...M_FCB_PSG },
  { id: 'fcb-psg', market: 'Money line', pick: 'PSG', odds: 2.3, ...M_FCB_PSG },
  { id: 'fcb-yamal', market: GOALS_MARKET, pick: 'Yamal', odds: 2.2, ...M_FCB_PSG },
  { id: 'fcb-mbappe', market: GOALS_MARKET, pick: 'Mbappé', odds: 1.9, ...M_FCB_PSG },
  { id: 'fcb-yamal-tiros', market: SHOTS_MARKET, pick: 'Yamal', odds: 1.75, ...M_FCB_PSG },
  // ===== Liverpool vs Man City =====
  { id: 'liv-w', market: 'Money line', pick: 'Liverpool', odds: 2.55, ...M_LIV_MCI },
  { id: 'liv-draw', market: 'Money line', pick: 'Empate', odds: 3.6, ...M_LIV_MCI },
  { id: 'mci-w', market: 'Money line', pick: 'Manchester City', odds: 2.2, ...M_LIV_MCI },
  { id: 'liv-salah', market: GOALS_MARKET, pick: 'Salah', odds: 2.0, ...M_LIV_MCI },
  { id: 'mci-haaland', market: GOALS_MARKET, pick: 'Haaland', odds: 1.7, ...M_LIV_MCI },
  { id: 'mci-haaland-tiros', market: SHOTS_MARKET, pick: 'Haaland', odds: 1.6, ...M_LIV_MCI },
];

// Personalized markets share App's selection registry and match metadata.
MOCK_PICKS.push(...PREMIER_MATCHES.slice(1).flatMap((m) =>
  [m.homeName, 'Empate', m.awayName].map((pick, i) => ({
    id: `featured-${m.matchId}-${i}`, market: 'Money line', pick,
    odds: [1.75, 3.8, 2.75][i], ...matchOf(m),
  })),
));
const FEATURED_MATCHES = [MATCHES[0], PREMIER_MATCHES[0]];
for (const m of FEATURED_MATCHES) {
  for (const market of ['Corners totales', 'Goles totales']) {
    for (const direction of ['↑', '↓']) MOCK_PICKS.push({
      id: `featured-${m.matchId}-${market}-${direction}`, market,
      pick: `${direction === '↑' ? 'Más' : 'Menos'} de ${market === 'Corners totales' ? '9.5' : '2.5'}`,
      odds: 1.75, ...matchOf(m),
    });
  }
  for (const player of (m.league === 'Champions' ? ['Mbappé', 'Vinicius', 'Lewandowski'] : ['Salah', 'Haaland', 'Foden'])) {
    for (const line of [1, 2, 3]) MOCK_PICKS.push({
      id: `featured-${m.matchId}-${player}-${line}`, market: SHOTS_MARKET,
      pick: `${player} · ${line}.0+`, odds: 1.53, ...matchOf(m),
    });
  }
}

/* ============================================================ */
/*  Header — Draftea logo, balance, lightning, profile          */
/* ============================================================ */
function Header() {
  // Figma "header" node 1665:42931. Three regions:
  //   • Left: Draftea wordmark logo (110×24).
  //   • Right gap-2:
  //     - Balance pair: "$0.00" + "BALANCE" stacked right-aligned,
  //       then a 32×32 purple-gradient circle with the + icon.
  //     - 36×36 circular user button on rgba(251,251,251,0.12) bg.
  return (
    <div className="flex w-full items-center justify-between px-3 py-1">
      {/* Left — Draftea logo */}
      <div className="flex flex-1 items-center">
        <img
          src={logoDrafteaIcon}
          alt="Draftea"
          className="h-6"
        />
      </div>

      {/* Right — balance + plus button + user button */}
      <div className="flex h-full items-center justify-end gap-2">
        {/* Balance pair (text + plus button) */}
        <div className="flex items-center justify-end gap-2 rounded-xl">
          <div className="flex flex-col items-end whitespace-nowrap">
            <span
              className="text-center text-[14px] font-bold leading-[21px] text-[#fbfbfb]"
              style={{ fontFamily: 'Red Hat Display, sans-serif' }}
            >
              $0.00
            </span>
            <span
              className="text-right text-[10px] font-medium leading-[15px] text-[rgba(251,251,251,0.5)]"
              style={{ fontFamily: 'Red Hat Display, sans-serif' }}
            >
              BALANCE
            </span>
          </div>
          {/* Plus button — 32×32 purple gradient (75.11° angle) with
              the standard inset shadow used on the Gana CTA. */}
          <button
            type="button"
            aria-label="Add funds"
            className="relative flex size-8 cursor-pointer items-center justify-center rounded-[56px] active:scale-[0.95] transition-transform"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-[56px]"
              style={{
                backgroundImage:
                  'linear-gradient(75.11deg, #4b20ff 0%, #9730ff 100%)',
              }}
            />
            <img
              src={plusIcon}
              alt=""
              aria-hidden
              className="relative h-[18px] w-[18px]"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-[inherit]"
              style={{
                boxShadow: 'inset 0 0 12px rgba(0,0,0,0.24)',
              }}
            />
          </button>
        </div>

        {/* User / profile button — 36×36 on faint white bg */}
        <button
          type="button"
          aria-label="Profile"
          className="flex size-9 cursor-pointer items-center justify-center overflow-hidden rounded-[56px] bg-[rgba(251,251,251,0.12)] px-2 py-2.5 active:scale-[0.95] transition-transform"
        >
          <img
            src={userIcon}
            alt=""
            aria-hidden
            className="h-[18px] w-[18px]"
          />
        </button>
      </div>
    </div>
  );
}

/* ============================================================ */
/*  Leagues row — Figma node 1665:42976                         */
/*  Horizontal scroll of league/sport icon buttons. Selected     */
/*  league has a #4b20ff 2px ring + transparent purple gradient. */
/*  Bottom border on the row + right-edge fade-to-black gradient.*/
/*  Icons reuse the existing emoji glyphs.                       */
/* ============================================================ */
function LeaguesTab({ activeLeague, onChange }: { activeLeague: string; onChange: (id: string) => void }) {
  const leagues = [
    { id: 'parati', label: 'Para ti', glyph: '' },
    { id: 'todofut', label: 'TODO FUT', glyph: '⚽' },
    { id: 'champ', label: 'CHAMPIONS', glyph: '🏆' },
    { id: 'nfl', label: 'NFL', glyph: '🏈' },
    { id: 'mlb', label: 'MLB', glyph: '⚾' },
    { id: 'tenis', label: 'TENIS', glyph: '🎾' },
    { id: 'prem', label: 'PREMIER', glyph: '🦁' },
  ];
  return (
    <div className="relative w-full border-b border-[rgba(251,251,251,0.12)]">
      <div className="no-scrollbar flex w-full items-center gap-3 overflow-x-auto px-3 pt-2">
        {leagues.map((l) => {
          const isActive = activeLeague === l.id;
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => onChange(l.id)}
              aria-pressed={isActive}
              className="flex h-[70px] shrink-0 cursor-pointer flex-col items-center active:scale-[0.96] transition-transform"
            >
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`flex size-11 items-center justify-center rounded-full text-[22px] leading-none ${
                    isActive
                      ? 'border-2 border-[#4b20ff]'
                      : 'border border-[rgba(251,251,251,0.16)]'
                  }`}
                  style={
                    isActive
                      ? {
                          backgroundImage:
                            'linear-gradient(75.11deg, rgba(75,32,255,0.24) 0%, rgba(151,48,255,0.24) 100%)',
                        }
                      : undefined
                  }
                >
                  {l.id === 'parati' ? <img src={paraTiIcon} alt="" className="size-6 object-contain" /> : l.glyph}
                </div>
                <span
                  className={`w-[52px] overflow-hidden text-ellipsis whitespace-nowrap text-center text-[10px] font-bold leading-[15px] ${
                    isActive ? 'text-[#fbfbfb]' : 'text-[rgba(251,251,251,0.5)]'
                  }`}
                  style={{ fontFamily: 'Red Hat Display, sans-serif' }}
                >
                  {l.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>
      {/* Right-edge fade-to-black so trailing tabs hint at more content */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 h-full w-6"
        style={{
          background: 'linear-gradient(to right, rgba(0,0,0,0) 0%, #000 100%)',
        }}
      />
    </div>
  );
}

/* ============================================================ */
/*  Match tabs row — Figma node 1664:42888                      */
/*  Horizontal scroll: a "TODOS" gradient pill (selected) +     */
/*  a series of two-line tabs (HOME vs AWAY / HOY (time)).      */
/* ============================================================ */
function MatchTabsRow() {
  const [activeMatch, setActiveMatch] = useState<string>('todos');
  const matchTabs: Array<
    | { id: 'todos' }
    | { id: string; home: string; away: string; date: string; time: string }
  > = [
    { id: 'todos' },
    { id: 'ars-rma', home: 'ARS', away: 'RMA', date: 'HOY', time: '00:00' },
    { id: 'fcb-psg', home: 'FCB', away: 'PSG', date: 'HOY', time: '00:00' },
    { id: 'abc-xyz-1', home: 'ABC', away: 'XYZ', date: 'HOY', time: '00:00' },
    { id: 'abc-xyz-2', home: 'ABC', away: 'XYZ', date: 'HOY', time: '00:00' },
  ];

  return (
    <div className="flex w-full flex-col items-start px-3">
      <div className="no-scrollbar flex w-full items-center gap-3 overflow-x-auto pb-1 pr-3 pt-2">
        {matchTabs.map((t) => {
          const isTodos = !('home' in t);
          const isActive = activeMatch === t.id;
          if (isTodos) {
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveMatch(t.id)}
                className="relative flex h-5 shrink-0 cursor-pointer items-center justify-center rounded-[56px] px-1.5 text-[12px] font-bold leading-[18px] text-[#fbfbfb] active:scale-[0.96] transition-transform"
                style={{
                  backgroundImage:
                    'linear-gradient(53.34deg, #4b20ff 0%, #9730ff 100%)',
                  fontFamily: 'Red Hat Display, sans-serif',
                }}
              >
                TODOS
                {/* TODO: small 10×3 arrow notch below the pill —
                    awaiting asset (imgArrow in the Figma export). */}
              </button>
            );
          }
          // Two-line match tab (teams + date/time).
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveMatch(t.id)}
              className={`flex min-h-[40px] shrink-0 cursor-pointer flex-col items-center justify-center active:scale-[0.96] transition-transform ${
                isActive ? 'opacity-100' : 'opacity-100'
              }`}
              style={{ fontFamily: 'Red Hat Display, sans-serif' }}
            >
              <div className="flex items-baseline justify-center gap-0.5 text-[12px] font-bold leading-[18px] text-[rgba(251,251,251,0.5)]">
                <span>{t.home}</span>
                <span>vs</span>
                <span>{t.away}</span>
              </div>
              <span className="whitespace-nowrap text-[12px] font-medium leading-4 text-[rgba(251,251,251,0.5)]">
                {t.date} ({t.time})
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================ */
/*  Pills row — Figma node 1665:43054                           */
/*  6 chip-style pills with one selected (POPULARES) showing a  */
/*  transparent purple gradient + #4b20ff border + flame icon.  */
/* ============================================================ */
function TabsAndPills() {
  const [activePill, setActivePill] = useState<string>('POPULARES');
  const pills = ['POPULARES', 'PARTIDOS', '1era MITAD', 'TIROS', 'GOLES', 'OTROS'];

  return (
    <div className="no-scrollbar flex w-full items-center gap-1.5 overflow-x-auto px-3 pt-1">
      {pills.map((label) => {
        const isActive = activePill === label;
        if (isActive) {
          return (
            <button
              key={label}
              type="button"
              onClick={() => setActivePill(label)}
              className="flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-[56px] border border-[#4b20ff] py-[7px] pl-2 pr-3 transition-transform active:scale-[0.96]"
              style={{
                backgroundImage:
                  'linear-gradient(46.31deg, rgba(75,32,255,0.24) 0%, rgba(151,48,255,0.24) 100%)',
              }}
            >
              {/* "Popular" icon — 16×16, anchored to the left of the
                  selected pill (Figma node 1665:43054). */}
              <img
                src={popularIcon}
                alt=""
                aria-hidden
                className="h-4 w-4 shrink-0"
              />
              <span
                className="whitespace-nowrap text-center text-[12px] font-bold leading-[18px] text-[#fbfbfb]"
                style={{ fontFamily: 'Red Hat Display, sans-serif' }}
              >
                {label}
              </span>
            </button>
          );
        }
        // Default (unselected) pill.
        return (
          <button
            key={label}
            type="button"
            onClick={() => setActivePill(label)}
            className="flex h-8 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-[56px] border border-[rgba(251,251,251,0.16)] bg-[rgba(251,251,251,0.08)] px-3 py-[7px] transition-transform active:scale-[0.96]"
          >
            <span
              className="whitespace-nowrap text-center text-[12px] font-bold leading-[18px] text-[rgba(251,251,251,0.7)]"
              style={{ fontFamily: 'Red Hat Display, sans-serif' }}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================ */
/*  Promo carousel — Champions card with PSG vs Real Madrid     */
/* ============================================================ */
/*  Long-press → "Lightning Straight Bet" (instant entry).       */
/*  Returns props to spread on a pick button: a hold past `delay`  */
/*  fires onLongPress(id) and suppresses the tap that follows; a    */
/*  quick tap fires onTap(id) as usual. One press at a time, so a   */
/*  single timer ref is enough.                                     */
/* ============================================================ */
const LONG_PRESS_MS = 450;
function useLongPress(
  onLongPress: (id: string) => void,
  onTap: (id: string) => void,
) {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);
  useEffect(() => () => { if (timer.current != null) clearTimeout(timer.current); }, []);
  const clear = () => {
    if (timer.current != null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };
  return (id: string) => ({
    onPointerDown: () => {
      fired.current = false;
      clear();
      timer.current = window.setTimeout(() => {
        fired.current = true;
        timer.current = null;
        onLongPress(id);
      }, LONG_PRESS_MS);
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onClick: () => {
      if (fired.current) {
        fired.current = false; // long-press already created the entry
        return;
      }
      onTap(id);
    },
  });
}

type PromoCarouselProps = {
  selectedIds: Set<string>;
  onTogglePick: (id: string) => void;
  onLightningBet: (id: string) => void;
};

type BindPick = (id: string) => Record<string, unknown>;

function PickButton({ p, label, selected, bindPick }: { p: Selection; label: string; selected: boolean; bindPick: BindPick }) {
  return (
    <button
      type="button"
      {...bindPick(p.id)}
      aria-pressed={selected}
      className={`flex h-11 min-w-[58px] flex-1 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border px-3 py-1 transition-all duration-200 active:scale-[0.96] ${
        selected
          ? 'border-[#d2ff72] bg-gradient-to-b from-[rgba(210,255,114,0.16)] to-[rgba(86,222,234,0.16)]'
          : 'border-[rgba(251,251,251,0.08)] bg-[rgba(251,251,251,0.1)] hover:bg-[rgba(251,251,251,0.14)]'
      }`}
    >
      <span
        className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-center text-[10px] font-medium leading-[15px] text-[rgba(251,251,251,0.5)]"
        style={{ fontFamily: 'Red Hat Display, sans-serif' }}
      >
        {label}
      </span>
      <span
        className={`whitespace-nowrap text-center text-[13px] leading-4 text-[#fbfbfb] ${
          selected ? 'font-bold' : 'font-medium'
        }`}
        style={{ fontFamily: 'Red Hat Display, sans-serif' }}
      >
        {p.odds.toFixed(2)}x
      </span>
    </button>
  );
}

/** One match card (Figma "newLeagueMarkets" 1624:44632) — league + tags,
    the two teams + kickoff, and the money-line 3-way as odds buttons. */
function MatchCard({
  match,
  selectedIds,
  bindPick,
  featuredLayout = false,
}: {
  match: MatchInfo;
  selectedIds: Set<string>;
  bindPick: BindPick;
  featuredLayout?: boolean;
}) {
  // Money-line picks for THIS match, in [home, draw, away] order.
  const lines = MOCK_PICKS.filter(
    (p) => p.matchId === match.matchId && p.market === 'Money line',
  );
  // Label by position (0 = home, draw = EMPATE, else away) — the pick names are
  // full team names ("Paris-Saint Germain"), so we can't match them to abbrevs.
  const labelFor = (p: Selection, i: number) =>
    p.pick === 'Empate'
      ? 'EMPATE'
      : i === 0
        ? match.homeAbbrev
        : match.awayAbbrev;

  const leagueTags = (
      <div className="flex w-full items-center justify-center gap-1 px-2.5">
        <div className="flex items-center gap-1">
          <p
            className="whitespace-nowrap text-right text-[12px] font-medium leading-4 text-[rgba(251,251,251,0.5)]"
            style={{ fontFamily: 'Red Hat Display, sans-serif' }}
          >
            {match.league}
          </p>
          <span
            aria-hidden
            className="block h-0.5 w-0.5 rounded-full bg-[rgba(251,251,251,0.5)]"
          />
        </div>
        <div className="flex items-start gap-1">
          <span
            className="flex h-[15px] min-w-5 items-center justify-center rounded-md bg-[rgba(251,251,251,0.16)] px-1 text-[10px] font-bold leading-[15px] text-[rgba(251,251,251,0.7)]"
            style={{ fontFamily: 'Red Hat Display, sans-serif' }}
          >
            PA
          </span>
          <span
            className="flex h-[15px] min-w-5 items-center justify-center rounded-md bg-[rgba(251,251,251,0.16)] px-1 text-[10px] font-bold leading-[15px] text-[rgba(251,251,251,0.7)]"
            style={{ fontFamily: 'Red Hat Display, sans-serif' }}
          >
            90&apos;
          </span>
        </div>
      </div>
  );

  return (
    <div
      className={`relative w-full ${featuredLayout ? 'personalized-match-card' : ''} overflow-hidden rounded-[20px] border border-[rgba(251,251,251,0.24)] bg-black pt-2`}
      style={{ backdropFilter: 'blur(10.15px)', WebkitBackdropFilter: 'blur(10.15px)' }}
    >
      {/* League + tags row */}
      {!featuredLayout && leagueTags}

      {/* Match row — Team 1 / center kickoff / Team 2 */}
      <div className="flex w-full items-start gap-2 px-2.5 pb-2">
        <div className="flex flex-1 flex-col items-center gap-0.5">
          <img src={shieldIcon} alt="" aria-hidden className={featuredLayout ? 'size-11' : 'size-8'} />
          <p
            className="w-full overflow-hidden text-ellipsis whitespace-nowrap text-center text-[12px] font-medium leading-4 text-[rgba(251,251,251,0.7)]"
            style={{ fontFamily: 'Red Hat Display, sans-serif' }}
          >
            {match.homeName}
          </p>
        </div>
        <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 self-stretch">
          {featuredLayout && leagueTags}
          <p
            className="whitespace-nowrap text-[12px] font-bold leading-[18px] text-[#fbfbfb]"
            style={{ fontFamily: 'Red Hat Display, sans-serif' }}
          >
            {match.matchTime}
          </p>
        </div>
        <div className="flex flex-1 flex-col items-center justify-end gap-0.5">
          <img src={shieldIcon} alt="" aria-hidden className={featuredLayout ? 'size-11' : 'size-8'} />
          <p
            className="w-full overflow-hidden text-ellipsis whitespace-nowrap text-center text-[12px] font-medium leading-4 text-[rgba(251,251,251,0.7)]"
            style={{ fontFamily: 'Red Hat Display, sans-serif' }}
          >
            {match.awayName}
          </p>
        </div>
      </div>

      {/* Odds row — the money-line 3-way. Each toggles a MOCK_PICKS id into
          the slip; selected state = lime→cyan gradient + bold odds. */}
      <div className="flex w-full items-center justify-end gap-1 px-2.5 pb-2.5">
        {lines.map((p, i) => {
          const selected = selectedIds.has(p.id);
          return (
            <PickButton key={p.id} p={p} label={labelFor(p, i)} selected={selected} bindPick={bindPick} />
          );
        })}
      </div>
    </div>
  );
}

function PromoCarousel({
  selectedIds,
  onTogglePick,
  onLightningBet,
  matches = MATCHES.slice(0, 4),
  featuredLayout = false,
}: PromoCarouselProps & { matches?: MatchInfo[]; featuredLayout?: boolean }) {
  const bindPick = useLongPress(onLightningBet, onTogglePick);
  // Horizontal scroll-snap carousel over every match on the feed. Cards
  // snap-CENTER, so an intermediate card rests centered in the carousel (the
  // first/last rest at the edges, held there by the scroll bounds). The active
  // dot tracks whichever card's center is nearest the carousel's center —
  // measured from live rects so it stays correct for center snapping.
  const dragScroll = useHorizontalDragScroll();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const center = r.left + r.width / 2;
    let best = 0;
    let bestDist = Infinity;
    [...el.children].forEach((k, i) => {
      const kr = (k as HTMLElement).getBoundingClientRect();
      const dist = Math.abs(kr.left + kr.width / 2 - center);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    setActive(Math.max(0, Math.min(matches.length - 1, best)));
  };

  return (
    // pt-3 = 12px gap from the pills row above (per design spec).
    <div className="w-full pb-2 pt-3">
      <div
        {...dragScroll}
        ref={scrollRef}
        onScroll={onScroll}
        className="no-scrollbar flex snap-x snap-mandatory gap-2 overflow-x-auto px-3"
      >
        {matches.map((m) => (
          <div key={m.matchId} className="w-[86%] shrink-0 snap-center">
            <MatchCard
              match={m}
              featuredLayout={featuredLayout}
              selectedIds={selectedIds}
              bindPick={bindPick}
            />
          </div>
        ))}
      </div>

      {/* Carousel dots — one per match, active dot widens. */}
      <div className="mt-2 flex justify-center gap-1.5">
        {matches.map((m, i) => (
          <button
            type="button"
            aria-label={`Ver partido ${i + 1}`}
            aria-pressed={i === active}
            onClick={() => { const el = scrollRef.current; const card = el?.children[i] as HTMLElement | undefined; if (el && card) el.scrollTo({ left: card.offsetLeft - el.offsetLeft - (el.clientWidth - card.clientWidth) / 2, behavior: 'smooth' }); }}
            key={m.matchId}
            className={`h-1.5 rounded-full transition-all duration-200 ${
              i === active ? 'w-4 bg-white' : 'w-1.5 bg-white/40'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function FeaturedMatch({ match, ...props }: PromoCarouselProps & { match: MatchInfo }) {
  const { headerRef, phase, onEntranceComplete, onFlamesComplete } = useFeaturedMatchSequence(match.matchId);
  const hot = phase === 'flames' || phase === 'entrance' || phase === 'holding';
  const bindPick = useLongPress(props.onLightningBet, props.onTogglePick);
  const dragScroll = useHorizontalDragScroll();
  const picks = MOCK_PICKS.filter(p => p.matchId === match.matchId);
  const players = [...new Set(picks.filter(p => p.id.startsWith('featured-') && p.market === SHOTS_MARKET).map(p => p.pick.split(' · ')[0]))];
  const renderPick = (p: Selection, label: string) => <PickButton key={p.id} p={p} label={label} selected={props.selectedIds.has(p.id)} bindPick={bindPick} />;
  return (
    <motion.article className="featured-match" data-phase={phase} initial={false} animate={{ "--heat": hot ? 1 : 0 }} transition={{ duration: (hot ? buttonProgressionConfig.featuredMatch.activationMs : buttonProgressionConfig.featuredMatch.settleMs) / 1000, ease: buttonProgressionConfig.featuredMatch.gradientEase }} aria-label={`Partido destacado: ${match.homeName} vs ${match.awayName}`}>
      <div aria-hidden className="featured-glow" />
      <div aria-hidden className="featured-glow featured-hot-glow" />
      <div className="featured-header" ref={headerRef}>
        <FeaturedMatchParticles phase={phase} onFlamesComplete={onFlamesComplete} />
        {[match.homeName, match.awayName].map((name, i) => (
          <div className={`featured-team featured-team-${i}`} key={name}>
            <img src={shieldIcon} alt="" className="size-[42px]" />
            <span className="w-full truncate text-center text-xs leading-[18px] text-white/70">{name}</span>
            <div className="flex items-center gap-1.5 text-xs leading-[18px] text-white/50">
              <span className="flex items-center gap-0.5"><img src={redCardIcon} alt="Tarjetas rojas" />{i ? 1 : 2}</span>
              <span className="flex items-center gap-0.5"><img src={cornerIcon} alt="Corners" />{i ? 7 : 4}</span>
            </div>
          </div>
        ))}
        <div className="featured-score">
          <FeaturedBetCount count={match.betCount} phase={phase} onEntranceComplete={onEntranceComplete} />
          <div className="flex items-center gap-3"><strong>1</strong><span className="text-sm">:</span><strong>0</strong></div>
          <span className="flex items-center gap-1 text-xs font-bold leading-[18px]"><span className="size-1.5 rounded-full bg-[#ff416c]" />{match.matchTime.split(' ').slice(-1)[0]}</span>
        </div>
      </div>
      <div className="featured-body">
        <div aria-hidden className="featured-decoration" />
        <div className="featured-markets">
          <div>
            <div className="featured-market-title">Money line <span className="featured-badge">90’</span></div>
            <div className="flex gap-1">{picks.filter(p => p.market === 'Money line').map((p, i) => renderPick(p, i === 1 ? 'EMPATE' : i === 0 ? match.homeAbbrev : match.awayAbbrev))}</div>
          </div>
          <div className="flex gap-2.5">
            {['Corners totales', 'Goles totales'].map(market => <div className="min-w-0 flex-1" key={market}>
              <div className="featured-market-title">{market}</div>
              <div className="flex gap-1">{picks.filter(p => p.market === market).map((p, i) => renderPick(p, `${i ? '↓' : '↑'} ${market === 'Corners totales' ? '9.5' : '2.5'}`))}</div>
            </div>)}
          </div>
        </div>
        <div {...dragScroll} onPointerDownCapture={e => {
          // Native inner-strip scrolling and pick presses must not drag the outer carousel.
          if ((e.target as HTMLElement).closest('.featured-player-odds')) return;
          dragScroll.onPointerDownCapture(e);
        }} className="featured-players no-scrollbar" role="region" aria-label="Jugadores destacados" tabIndex={0}>
          {players.map(name => {
            const lines = picks.filter(p => p.id.startsWith('featured-') && p.market === SHOTS_MARKET && p.pick.startsWith(`${name} · `));
            return <div className="featured-player" key={name}>
              <span className="featured-player-team text-[10px] leading-[15px] text-white/50">{name === 'Vinicius' || name === 'Haaland' || name === 'Foden' ? match.awayAbbrev : match.homeAbbrev}</span>
              <PlayerProfile p={{ ...lines[0], pick: name }} compact />
              <div className="featured-market-title">Tiros al arco <span className="featured-badge italic">B+</span></div>
              <div className="featured-player-controls"><div className="featured-player-odds no-scrollbar" tabIndex={0} aria-label={`Líneas de ${name}`}>{lines.map((p, i) => renderPick(p, `${i + 1}.0+`))}</div></div>
            </div>;
          })}
        </div>
      </div>
    </motion.article>
  );
}

function PersonalizedFeed(props: PromoCarouselProps) {
  const sections = [
    { title: 'Champions', matches: MATCHES.slice(0, 3) },
    { title: 'Premier', matches: PREMIER_MATCHES },
  ];
  return <div className="personalized-feed">
    {sections.map(({title, matches}) => <section key={title} aria-label={title}>
      <h2 className="flex h-8 items-center gap-0.5 text-sm font-bold leading-[21px]">{title}<img src={rightChevronIcon} alt="" className="size-3.5" /></h2>
      <FeaturedMatch match={matches[0]} {...props} />
      <p className="mt-4 text-xs leading-[18px] text-white/70">Otros partidos destacados</p>
      <PromoCarousel matches={matches.slice(1)} featuredLayout {...props} />
    </section>)}
  </div>;
}

/* ============================================================ */
/*  Market accordion — Figma "marketAccordeon" node 1628:42604  */
/*  2×2 grid of player-prop cards. Each card has the player's   */
/*  silhouette (player.svg), name + position, match info, stats */
/*  icon, and an odds button at the bottom that toggles the     */
/*  corresponding pick into the bet slip. Selected state uses   */
/*  the same lime-cyan visual language as the PromoCarousel.    */
/*                                                              */
/*  Filters to the player-goal-prop picks only (lewa, mbappe,   */
/*  vini, mbappe-htrick). The other picks (team wins, draws,    */
/*  combo, hat-trick variants) don't fit this layout and live   */
/*  elsewhere (PromoCarousel + debug random add).               */
/* ============================================================ */
type MarketProps = {
  /** Market name — also the accordion title. Picks are filtered to this. */
  title: string;
  picks: Selection[];
  selectedIds: Set<string>;
  onTogglePick: (id: string) => void;
  onLightningBet: (id: string) => void;
};

// Position shown next to the player name on each card (default DEL).
const PLAYER_POSITION: Record<string, string> = {
  Ødegaard: 'MED',
};

// Split a "Hoy 18:00" / "Mañana 21:00" kickoff into an uppercase date + a time,
// for the two-line stamp in each card's top-right corner.
function splitKickoff(matchTime: string): { date: string; time: string } {
  const [date, ...rest] = matchTime.split(' ');
  return { date: date.toUpperCase(), time: rest.join(' ') };
}

function PlayerProfile({ p, compact = false }: { p: Selection; compact?: boolean }) {
  const position = PLAYER_POSITION[p.pick] ?? 'DEL';
  return (
    <div className="relative flex w-full flex-col items-center ">
      <img
        src={playerIcon}
        alt=""
        aria-hidden
        className="relative z-0"
        width={compact ? 56 : 76}
        height={compact ? 56 : 76}
      />
      {/* Fade — 60px tall, ~140px wide, anchored to the
          bottom of the player container. Starts halfway
          down the silhouette, ends just past the name. */}
      <div
        className={`pointer-events-none absolute bottom-0 left-1/2 z-[1] ${compact ? 'h-[32px]' : 'h-[60px]'} w-[140px] -translate-x-1/2 bg-gradient-to-b from-transparent to-black`}
        aria-hidden
      />
      <div
        className="relative z-[2] flex items-baseline justify-center gap-0.5"
        style={{ fontFamily: 'Red Hat Display, sans-serif' }}
      >
        <span className="text-[14px] font-medium leading-[21px] text-[#fbfbfb]">
          {p.pick}
        </span>
        <span className="text-[10px] font-medium leading-[15px] text-[rgba(251,251,251,0.44)]">
          {position}
        </span>
      </div>
    </div>
  );
}

function MarketAccordion({
  title,
  picks,
  selectedIds,
  onTogglePick,
  onLightningBet,
}: MarketProps) {
  const [isOpen, setIsOpen] = useState(true);
  const bindPick = useLongPress(onLightningBet, onTogglePick);
  // Player-prop cards for THIS market only, across every match on the feed —
  // so cards from different matches (and multiple picks per match) can be
  // tapped to build SGP groups + cross-match singles.
  const playerPicks = picks.filter((p) => p.market === title);

  return (
    <div className="w-full border-b border-[rgba(251,251,251,0.12)] bg-black px-3 pb-3">
      {/* Header — clickable to expand/collapse */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex h-11 w-full cursor-pointer items-center py-2.5"
        aria-expanded={isOpen}
      >
        <div className="flex flex-1 items-center gap-1">
          <p
            className="text-left text-[14px] font-bold leading-[21px] text-[#fbfbfb]"
            style={{ fontFamily: 'Red Hat Display, sans-serif' }}
          >
            {title}
          </p>
          <span
            className="flex h-[15px] min-w-5 items-center justify-center rounded-md bg-[rgba(251,251,251,0.16)] px-1 text-[10px] font-bold leading-[15px] text-[rgba(251,251,251,0.7)]"
            style={{ fontFamily: 'Red Hat Display, sans-serif' }}
          >
            90&apos;
          </span>
        </div>
        <div className="ml-6 flex size-6 shrink-0 items-center justify-center rounded-full border border-[rgba(251,251,251,0.24)]">
          <img
            src={chevronIcon}
            alt=""
            aria-hidden
            className={`h-4 w-4 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : 'rotate-0'
            }`}
          />
        </div>
      </button>

      {/* Body — 2×2 grid of player-prop cards + Ver todos CTA */}
      {isOpen && (
        <div className="flex flex-col gap-1 pt-1">
          <div className="grid grid-cols-2 gap-2">
            {playerPicks.map((p) => {
              const { date, time } = splitKickoff(p.matchTime);
              const selected = selectedIds.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  {...bindPick(p.id)}
                  // Selected state changes ONLY the odds button at the
                  // bottom (lime-cyan gradient + Bold odds); the outer
                  // card border stays neutral in both states.
                  className="relative flex cursor-pointer flex-col items-center gap-2 overflow-hidden rounded-[20px] border border-[rgba(251,251,251,0.12)] bg-black p-2.5 transition-all duration-200 active:scale-[0.98]"
                >
                  {/* TODO: decorative "light" glow at top of card —
                      Figma uses imgLight (no asset uploaded). */}

                  {/* Top-left: stats icon (chart bars) */}
                  <div className="absolute left-2.5 top-2.5 z-10 flex size-5 items-center justify-center rounded-md bg-[rgba(251,251,251,0.12)] p-0.5 backdrop-blur-sm">
                    <img
                      src={statsIcon}
                      alt=""
                      aria-hidden
                      className="h-3 w-3"
                    />
                  </div>

                  {/* Top-right: match teams + date + time */}
                  <div className="absolute right-2.5 top-2.5 z-10 flex flex-col items-end">
                    <div
                      className="flex items-baseline gap-px text-[10px] leading-[15px]"
                      style={{ fontFamily: 'Red Hat Display, sans-serif' }}
                    >
                      <span className="font-medium text-[rgba(251,251,251,0.7)]">
                        {p.homeAbbrev}
                      </span>
                      <span className="font-medium text-[rgba(251,251,251,0.44)]">
                        vs
                      </span>
                      <span className="font-medium text-[rgba(251,251,251,0.44)]">
                        {p.awayAbbrev}
                      </span>
                    </div>
                    <span
                      className="text-[10px] font-medium leading-[15px] text-[rgba(251,251,251,0.44)]"
                      style={{ fontFamily: 'Red Hat Display, sans-serif' }}
                    >
                      {date}
                    </span>
                    <span
                      className="text-[10px] font-medium leading-[15px] text-[rgba(251,251,251,0.44)]"
                      style={{ fontFamily: 'Red Hat Display, sans-serif' }}
                    >
                      {time}
                    </span>
                  </div>

                  {/* Player image + name + position.
                      The gradient fade sits ABOVE the bottom of the
                      silhouette (covering shoulders/chest) and EXTENDS
                      DOWN behind the player name, so the head reads
                      crisp and the name floats over a black wash. */}
                  <PlayerProfile p={p} />

                  {/* Odds button at the bottom — same default/selected
                      visual language as the PromoCarousel buttons. */}
                  <div
                    className={`flex h-11 w-full items-center justify-center overflow-hidden rounded-xl border px-3 py-1 ${
                      selected
                        ? 'border-[#d2ff72] bg-gradient-to-b from-[rgba(210,255,114,0.16)] to-[rgba(86,222,234,0.16)]'
                        : 'border-[rgba(251,251,251,0.08)] bg-[rgba(251,251,251,0.1)]'
                    }`}
                  >
                    <span
                      className={`whitespace-nowrap text-center text-[13px] leading-4 text-[#fbfbfb] ${
                        selected ? 'font-bold' : 'font-medium'
                      }`}
                      style={{ fontFamily: 'Red Hat Display, sans-serif' }}
                    >
                      {p.odds.toFixed(2)}x
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Ver todos (N) — tertiary CTA */}
          <button
            type="button"
            className="mt-1 flex w-full cursor-pointer items-center justify-center gap-1 py-2 text-[14px] font-medium leading-[21px] text-[#fbfbfb] transition-opacity hover:opacity-80"
            style={{ fontFamily: 'Red Hat Display, sans-serif' }}
          >
            Ver todos ({playerPicks.length})
            <img
              src={chevronIcon}
              alt=""
              aria-hidden
              className="h-4 w-4"
            />
          </button>
        </div>
      )}
    </div>
  );
}

/* ============================================================ */
/*  Bottom navbar (Figma "navbar and search" node 1628:42603)   */
/*  4 tabs (Bets default-selected) + dedicated search button.   */
/*  Icons sourced from src/assets/ by name-matching the tab id. */
/* ============================================================ */
function Navbar({
  entryCount = 0,
  bump = 0,
  badgeVisible = false,
  compact = false,
}: {
  entryCount?: number;
  bump?: number;
  badgeVisible?: boolean;
  /** Scrolled-down state: drop the labels + shrink the bar to a single
      row of icons (Figma 33885:39455). Morphs smoothly via CSS. */
  compact?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<'bets' | 'entradas' | 'gaming' | 'rewards'>('bets');

  // Entry-count badge lifecycle. `shouldShow` follows App's 10s window;
  // `badgeMounted` lags it so the badge can fade out (opacity transition)
  // before it unmounts, instead of popping out of existence. Deterministic
  // (no AnimatePresence), so there's no exit-race flicker.
  const shouldShowBadge = badgeVisible && entryCount > 0;
  const [badgeMounted, setBadgeMounted] = useState(false);
  useEffect(() => {
    if (shouldShowBadge) {
      setBadgeMounted(true);
      return;
    }
    const t = setTimeout(() => setBadgeMounted(false), 250); // after fade-out
    return () => clearTimeout(t);
  }, [shouldShowBadge]);

  const tabs: Array<{
    id: 'bets' | 'entradas' | 'gaming' | 'rewards';
    label: string;
    icon: string | null;
  }> = [
    { id: 'bets', label: 'Bets', icon: betsIcon },
    { id: 'entradas', label: 'Mis entradas', icon: misEntradasIcon },
    { id: 'gaming', label: 'Gaming', icon: gamingIcon },
    { id: 'rewards', label: 'Rewards', icon: rewardsIcon },
  ];

  return (
    <div
      className={`mx-auto flex items-center justify-center gap-2 pb-4 transition-[width,padding] duration-[250ms] ease-out ${
        compact ? 'w-[248px] px-0' : 'w-full px-4'
      }`}
    >
      {/* Tab pill — 4 tabs in a single rounded container. Compact (scrolled
          down, Figma 33885:39456): height 58→40px, padding 6→4px. Stays
          flex-1, so within the 248px centered bar (− 8px gap − 40px search)
          it lands at exactly 200px wide, icon-only. */}
      <div
        className={`flex flex-1 items-center justify-center rounded-[56px] border border-[rgba(251,251,251,0.16)] bg-[#191919] transition-[height,padding] duration-[250ms] ease-out ${
          compact ? 'h-10 p-1' : 'h-[58px] p-1.5'
        }`}
      >
        {tabs.map((t) => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              data-tab={t.id === 'entradas' ? 'entradas' : undefined}
              onClick={() => setActiveTab(t.id)}
              className={`relative flex h-full min-w-px flex-[1_0_0] cursor-pointer flex-col items-center justify-center rounded-[56px] px-1 transition-all duration-[250ms] ease-out active:scale-[0.97] ${
                isActive ? 'bg-[rgba(251,251,251,0.12)]' : ''
              } ${compact ? 'gap-0 pt-0' : 'gap-0.5 pt-[3px]'}`}
            >
              {/* Icon row. The rewards badge is rendered at 26×26 to
                  match Figma (the other tab icons are 20×20). It overflows
                  the row's nominal 20px height by ~3px each side, so the
                  row and button drop overflow-hidden / clip and the
                  badge can poke above/below the surrounding row. */}
              <div className="relative flex h-5 w-full items-center justify-center">
                {/* Icon-sized wrapper so the badge anchors to the ICON's
                    corner (not the full-width tab), keeping it close to the
                    tab. */}
                <div className="relative flex items-center justify-center">
                  <span
                    key={t.id === 'entradas' ? `icon-${bump}` : 'icon'}
                    className={`flex items-center justify-center ${
                      t.id === 'entradas' && bump > 0
                        ? 'animate-[iconBump_0.4s_ease-out]'
                        : ''
                    }`}
                  >
                    <img
                      src={t.icon ?? undefined}
                      alt=""
                      aria-hidden
                      className={t.id === 'rewards' ? 'h-[26px] w-[26px]' : 'h-5 w-5'}
                    />
                  </span>
                  {/* Entry-count badge — dark pill (Figma "Entry counter"
                      33563:154482): #3d3d3d fill, 2px #191919 ring, bold white
                      count. Keyed by entryCount so it remounts (and replays the
                      squash & stretch) on each new entry; cleanly unmounts when
                      App hides it after 10s. */}
                  {t.id === 'entradas' && badgeMounted && (
                    <span
                      key={entryCount}
                      className={`absolute -right-2.5 -top-2.5 flex min-w-[18px] items-center justify-center rounded-full border-2 border-[#191919] bg-[#3d3d3d] px-1.5 text-[10px] font-bold leading-[15px] text-[#fbfbfb] transition-opacity duration-200 ease-out ${
                        shouldShowBadge
                          ? 'opacity-100 animate-[badgePop_0.5s_ease-out]'
                          : 'opacity-0'
                      }`}
                      style={{ fontFamily: 'Red Hat Display, sans-serif' }}
                    >
                      {entryCount}
                    </span>
                  )}
                </div>
              </div>
              {/* Label — collapses (height + opacity) in compact mode so the
                  bar becomes an icon-only row. */}
              <span
                className={`overflow-hidden whitespace-nowrap text-[10px] font-medium leading-[15px] transition-all duration-[250ms] ease-out ${
                  isActive ? 'text-[#fbfbfb]' : 'text-[rgba(251,251,251,0.7)]'
                } ${compact ? 'max-h-0 opacity-0' : 'max-h-[15px] opacity-100'}`}
                style={{ fontFamily: 'Red Hat Display, sans-serif' }}
              >
                {t.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search — separate circular button */}
      <button
        type="button"
        aria-label="Search"
        className={`flex shrink-0 cursor-pointer items-center justify-center rounded-[56px] border border-[rgba(251,251,251,0.16)] bg-[#191919] p-2.5 transition-all duration-[250ms] ease-out active:scale-[0.97] ${
          compact ? 'size-10' : 'size-[58px]'
        }`}
      >
        <img
          src={searchIcon}
          alt=""
          aria-hidden
          className={`transition-all duration-[250ms] ease-out ${compact ? 'h-5 w-5' : 'h-6 w-6'}`}
        />
      </button>
    </div>
  );
}

/* ============================================================ */
/*  Combined HomeScreenChrome — everything above the button     */
/* ============================================================ */
type HomeScreenChromeProps = {
  picks: Selection[];
  selectedIds: Set<string>;
  onTogglePick: (id: string) => void;
  onLightningBet: (id: string) => void;
  /** Scroll-direction signal (shared with the navbar): true while scrolling
      DOWN → collapse the leagues row; false on scroll-up / near-top → reveal. */
  headerCollapsed?: boolean;
};

export function HomeScreenChrome({
  picks,
  selectedIds,
  onTogglePick,
  onLightningBet,
  headerCollapsed = false,
}: HomeScreenChromeProps) {
  const [activeLeague, setActiveLeague] = useState('todofut');
  return (
    <div className="flex w-full flex-col">
      {/* PINNED HEADER — ONE sticky surface holding the logo/balance bar, the
          leagues row, the match tabs and the pill markets. It's a SINGLE tier
          (not two) so the decorative glow can span behind ALL of it as one
          continuous layer instead of being trapped behind just the logo bar:
            • bg-black base — opaque, hides the feed scrolling underneath.
            • glow (z-0) — floats above the black base but below every element,
              so it reads as light BEHIND the header + leagues and never paints
              on top of any component. Kept at h-100 (the previous extension)
              so it reaches down through the leagues and fades via its own blur.
            • overflow-hidden — clips the blurred tail at the header's bottom
              edge so it can never bleed onto the feed below (in either the
              expanded or collapsed state); when expanded the glow has already
              faded to nothing well above that edge, so there's no visible cut.
            • content (relative z-10) — Header, leagues (collapsible), tabs,
              pills, all above the glow.
          On the desktop phone-mockup (min-[431px]) we add back the vertical
          space the old fake status bar occupied so the header clears the notch;
          real mobile relies on the device's own status bar for that inset. */}
      <div className="sticky top-0 z-30 overflow-hidden bg-black min-[431px]:pt-11">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[100px]"
          style={{
            backgroundImage:
              'linear-gradient(45.09deg, #4b20ff 0%, #9730ff 100%)',
            filter: 'blur(50px)',
            opacity: 0.48,
          }}
        />
        <div className="relative z-10">
          <Header />
          {/* Leagues row collapses (height + opacity) on scroll-down and
              springs back on scroll-up. */}
          <div
            className={`overflow-hidden transition-all duration-[250ms] ease-out ${
              headerCollapsed ? 'max-h-0 opacity-0' : 'max-h-[96px] opacity-100'
            }`}
          >
            <LeaguesTab activeLeague={activeLeague} onChange={setActiveLeague} />
          </div>
          <div hidden={activeLeague === 'parati'}><MatchTabsRow /><TabsAndPills /></div>
        </div>
      </div>

      {activeLeague === 'parati' && <PersonalizedFeed selectedIds={selectedIds} onTogglePick={onTogglePick} onLightningBet={onLightningBet} />}
      <div hidden={activeLeague === 'parati'}>
      <PromoCarousel
        selectedIds={selectedIds}
        onTogglePick={onTogglePick}
        onLightningBet={onLightningBet}
      />
      <MarketAccordion
        title={GOALS_MARKET}
        picks={picks.filter(p => !p.id.startsWith('featured-'))}
        selectedIds={selectedIds}
        onTogglePick={onTogglePick}
        onLightningBet={onLightningBet}
      />
      <MarketAccordion
        title={SHOTS_MARKET}
        picks={picks.filter(p => !p.id.startsWith('featured-'))}
        selectedIds={selectedIds}
        onTogglePick={onTogglePick}
        onLightningBet={onLightningBet}
      />
      </div>
    </div>
  );
}

export { Navbar };
