import shieldIcon from './assets/shield.svg';
import { groupSelections, type MatchInfo } from './betSlipGrouping';
import type { Selection } from './types';

/**
 * SelectionGroups — the shared bet-slip selections list with same-game-parlay
 * (SGP) grouping. Used by ALL THREE bet-slip views (summarized slip, floating
 * "Resumen" card, success confirmation) so grouping reads identically everywhere.
 *
 * Layout (Figma "SGP" 34367:176772):
 *   • 2+ selections from one match → an SGP block: a match-info header
 *     ("HOME vs AWAY · kickoff", with a group × that removes the whole match)
 *     followed by its member rows, member rows indented under the header.
 *   • A lone selection → a standalone row (market / pick / kickoff / odds).
 *   • Every unit is separated from the next by a horizontal divider — SGP↔SGP,
 *     SGP↔single and single↔single alike.
 *
 * `onRemove` / `onRemoveGroup` are omitted for the read-only success view (no ×
 * chrome, no group header ×). `stopSwipePropagation` keeps taps on the × from
 * bubbling into a parent swipe-to-collapse gesture (summarized slip).
 */

const fmtOdds = (n: number) => `${n.toFixed(2)}x`;

type Props = {
  selections: Selection[];
  onRemove?: (id: string) => void;
  onRemoveGroup?: (matchId: string) => void;
  stopSwipePropagation?: boolean;
  /** Divider policy between units. `'auto'` (default) shows dividers only when
      the slip contains at least one SGP group (a pure list of single-match
      bets needs none); `'none'` never draws them (the summarized slip). */
  dividers?: 'auto' | 'none';
  /** Show the kickoff line under a standalone (non-SGP) leg. The summarized
      slip turns this off so its 2-selection view stays compact. */
  showStandaloneDate?: boolean;
};

const DIVIDER_COLOR = 'rgba(251,251,251,0.12)';

// × tint per context. The group header × is full white; the × inside an SGP
// member row matches the market-name color; standalone rows keep the default.
const X_WHITE = '#fbfbfb';
const X_MARKET = 'rgba(251,251,251,0.5)'; // same as the market label
const X_DEFAULT = 'rgba(251,251,251,0.7)';

/**
 * CloseGlyph — the × icon, drawn as an INLINE svg so its color is set directly
 * (via `fill`) and it needs no external asset. The path is close.svg verbatim.
 * (A CSS `mask-image: url(close.svg)` broke in the production build: Vite inlines
 * the small SVG as a url-encoded data URI whose unescaped `"`/`#` corrupt the
 * mask URL → the glyph rendered as a solid box.)
 */
function CloseGlyph({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M10.0634 2.59645C10.2456 2.41421 10.2456 2.11873 10.0634 1.93649C9.88112 1.75424 9.58564 1.75424 9.4034 1.93649L6.00005 5.33984L2.5967 1.93649C2.41445 1.75424 2.11898 1.75424 1.93673 1.93649C1.75449 2.11873 1.75449 2.41421 1.93673 2.59645L5.34008 5.9998L1.93673 9.40315C1.75449 9.5854 1.75449 9.88088 1.93673 10.0631C2.11898 10.2454 2.41445 10.2454 2.5967 10.0631L6.00005 6.65977L9.4034 10.0631C9.58564 10.2454 9.88112 10.2454 10.0634 10.0631C10.2456 9.88088 10.2456 9.5854 10.0634 9.40315L6.66001 5.9998L10.0634 2.59645Z"
        fill={color}
      />
    </svg>
  );
}

function Shield() {
  return (
    <div className="flex size-11 shrink-0 items-center justify-center">
      <div className="size-9 overflow-hidden rounded-[8px] backdrop-blur-[2px]">
        <img src={shieldIcon} alt="" className="size-full object-contain p-[3px]" />
      </div>
    </div>
  );
}

function RemoveButton({
  onRemove,
  stop,
  label,
  compact,
  color = X_DEFAULT,
}: {
  onRemove: () => void;
  stop?: boolean;
  label: string;
  /** Shorter 40px hit area for the group header (member rows are 48px). */
  compact?: boolean;
  color?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onRemove}
      onPointerDownCapture={stop ? (e) => e.stopPropagation() : undefined}
      className={`flex w-10 shrink-0 items-center justify-center active:scale-90 ${
        compact ? 'h-10' : 'h-12'
      }`}
    >
      <CloseGlyph color={color} />
    </button>
  );
}

/** One selection row (used for both SGP members and standalone singles). */
function SelectionRow({
  sel,
  onRemove,
  showDate,
  showOdds,
  indent,
  padded,
  compact,
  xColor = X_DEFAULT,
  stop,
}: {
  sel: Selection;
  onRemove?: (id: string) => void;
  showDate: boolean;
  /** SGP members hide their leg odds (they roll up into the SGP's combined
      odds); standalone straight bets keep their own odds. */
  showOdds: boolean;
  indent: boolean;
  /** Extra vertical padding — standalone rows breathe; SGP members stay tight. */
  padded?: boolean;
  /** Hug content: smaller shield + × and no min-height/padding, so a dateless
      row shrinks to its two text lines (summarized slip). */
  compact?: boolean;
  /** × tint (SGP members match the market color; standalone rows default). */
  xColor?: string;
  stop?: boolean;
}) {
  return (
    <div
      className={`flex w-full items-center ${indent ? 'pl-3' : ''} ${
        compact ? 'py-1' : padded ? 'min-h-11 py-1' : 'min-h-11'
      }`}
    >
      {onRemove && (
        <RemoveButton
          onRemove={() => onRemove(sel.id)}
          stop={stop}
          label="Quitar selección"
          color={xColor}
          compact={compact}
        />
      )}
      <div
        className={`flex min-w-px flex-1 items-center gap-[6px] overflow-hidden pl-[6px] ${
          showOdds ? '' : 'pr-3'
        }`}
      >
        <Shield />
        <div className="flex min-w-px flex-1 flex-col justify-center">
          <p className="max-w-[190px] truncate text-[10px] font-bold uppercase leading-[15px] text-[rgba(251,251,251,0.5)]">
            {sel.market}
          </p>
          <p className="truncate text-[14px] font-medium leading-[21px] text-[#fbfbfb]">
            {sel.pick}
          </p>
          {showDate && (
            <p className="truncate text-[12px] font-medium leading-4 text-[rgba(251,251,251,0.5)]">
              {sel.matchTime}
            </p>
          )}
        </div>
      </div>
      {showOdds && (
        <div className="flex w-[72px] shrink-0 items-center justify-end pl-1 pr-3">
          <span className="whitespace-nowrap text-[12px] font-medium leading-4 text-[rgba(251,251,251,0.5)]">
            {fmtOdds(sel.odds)}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Straight-bet row — the ORIGINAL single-selection layout, used only when the
 * whole slip is ONE selection: date on the right, and NO odds (the odds already
 * show in the Momio field next to the entry amount, so repeating it here is
 * redundant). Market is medium (not the SGP's uppercase micro-label) and the
 * pick is bold.
 */
function StraightBetRow({
  sel,
  onRemove,
  stop,
}: {
  sel: Selection;
  onRemove?: (id: string) => void;
  stop?: boolean;
}) {
  return (
    <div className="flex min-h-11 w-full items-center gap-1">
      {onRemove && (
        <button
          type="button"
          aria-label="Quitar selección"
          onClick={() => onRemove(sel.id)}
          onPointerDownCapture={stop ? (e) => e.stopPropagation() : undefined}
          className="flex size-5 shrink-0 items-center justify-center rounded-full p-[2px] active:scale-95"
        >
          <CloseGlyph color={X_WHITE} size={12} />
        </button>
      )}
      <div className="flex min-w-px flex-1 items-center gap-1">
        <div className="size-9 shrink-0 backdrop-blur-[2px]">
          <img
            src={shieldIcon}
            alt=""
            className="size-full object-contain p-[3px]"
          />
        </div>
        <div className="flex min-w-px flex-col justify-center">
          <p className="max-w-[162px] truncate text-[12px] font-medium leading-4 text-[rgba(251,251,251,0.7)]">
            {sel.market}
          </p>
          <p className="truncate text-[14px] font-bold leading-[21px] text-[#fbfbfb]">
            {sel.pick}
          </p>
        </div>
      </div>
      <div className="flex w-[92px] shrink-0 items-center justify-end pr-1 text-right text-[12px] font-medium leading-4 text-[rgba(251,251,251,0.7)]">
        <span className="truncate">{sel.matchTime}</span>
      </div>
    </div>
  );
}

/** SGP block header — "HOME vs AWAY · kickoff", with a group-remove ×. */
function SgpHeader({
  match,
  onRemoveGroup,
  stop,
}: {
  match: MatchInfo;
  onRemoveGroup?: (matchId: string) => void;
  stop?: boolean;
}) {
  return (
    <div className="flex min-h-10 w-full items-center">
      {onRemoveGroup && (
        <RemoveButton
          onRemove={() => onRemoveGroup(match.matchId)}
          stop={stop}
          label="Quitar partido"
          compact
          color={X_WHITE}
        />
      )}
      <div className="flex min-w-px flex-1 items-center gap-1 pl-3 pr-1">
        <div className="flex items-center gap-0.5 whitespace-nowrap">
          <span className="text-[14px] font-medium leading-[21px] text-[#fbfbfb]">
            {match.homeAbbrev}
          </span>
          <span className="text-[12px] font-medium leading-4 text-[rgba(251,251,251,0.5)]">
            vs
          </span>
          <span className="text-[14px] font-medium leading-[21px] text-[#fbfbfb]">
            {match.awayAbbrev}
          </span>
        </div>
        <span
          aria-hidden
          className="size-[2px] shrink-0 rounded-full bg-[rgba(251,251,251,0.5)]"
        />
        <span className="min-w-px truncate text-[12px] font-medium leading-4 text-[rgba(251,251,251,0.5)]">
          {match.matchTime}
        </span>
      </div>
    </div>
  );
}

export function SelectionGroups({
  selections,
  onRemove,
  onRemoveGroup,
  stopSwipePropagation,
  dividers = 'auto',
  showStandaloneDate = true,
}: Props) {
  const groups = groupSelections(selections);
  // A slip with exactly ONE selection is a straight bet — render the original
  // single-selection layout (date on the right, no odds; odds live in the Momio
  // field next to the amount). Standalone legs in a MULTI-selection slip keep
  // their date-under-pick + odds, since the Momio there is the combined odds.
  const isStraightBet = selections.length === 1;
  // Dividers separate units only when the slip actually has SGP grouping to
  // read (a pure list of single-match bets doesn't need them); `'none'` forces
  // them off entirely (summarized slip).
  const hasSgp = groups.some((g) => g.kind === 'sgp');
  const showDividers = dividers !== 'none' && hasSgp;

  return (
    <div className="flex w-full flex-col">
      {groups.map((group, i) => {
        const divider =
          i > 0 && showDividers ? (
            <div
              className="my-2 h-px w-full shrink-0"
              style={{ backgroundColor: DIVIDER_COLOR }}
              aria-hidden
            />
          ) : null;

        if (group.kind === 'sgp') {
          return (
            <div key={group.match.matchId} className="flex w-full flex-col">
              {divider}
              <SgpHeader
                match={group.match}
                onRemoveGroup={onRemoveGroup}
                stop={stopSwipePropagation}
              />
              {group.selections.map((sel) => (
                <SelectionRow
                  key={sel.id}
                  sel={sel}
                  onRemove={onRemove}
                  showDate={false}
                  showOdds={false}
                  indent
                  xColor={X_MARKET}
                  stop={stopSwipePropagation}
                />
              ))}
            </div>
          );
        }

        return (
          <div key={group.selection.id} className="flex w-full flex-col">
            {divider}
            {isStraightBet ? (
              <StraightBetRow
                sel={group.selection}
                onRemove={onRemove}
                stop={stopSwipePropagation}
              />
            ) : (
              <SelectionRow
                sel={group.selection}
                onRemove={onRemove}
                showDate={showStandaloneDate}
                showOdds
                indent={false}
                padded={showStandaloneDate}
                compact={!showStandaloneDate}
                xColor={X_WHITE}
                stop={stopSwipePropagation}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
