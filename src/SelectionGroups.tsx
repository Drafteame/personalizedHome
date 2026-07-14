import closeIcon from './assets/close.svg';
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
};

const DIVIDER_COLOR = 'rgba(251,251,251,0.12)';

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
}: {
  onRemove: () => void;
  stop?: boolean;
  label: string;
  /** Shorter 40px hit area for the group header (member rows are 48px). */
  compact?: boolean;
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
      <img src={closeIcon} alt="" className="size-4" />
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
  stop,
}: {
  sel: Selection;
  onRemove?: (id: string) => void;
  showDate: boolean;
  /** SGP members hide their leg odds (they roll up into the SGP's combined
      odds); standalone straight bets keep their own odds. */
  showOdds: boolean;
  indent: boolean;
  stop?: boolean;
}) {
  return (
    <div
      className={`flex min-h-11 w-full items-center ${indent ? 'pl-3' : ''}`}
    >
      {onRemove && (
        <RemoveButton
          onRemove={() => onRemove(sel.id)}
          stop={stop}
          label="Quitar selección"
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
          <img src={closeIcon} alt="" className="size-3" />
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
}: Props) {
  const groups = groupSelections(selections);
  // A slip with exactly ONE selection is a straight bet — render the original
  // single-selection layout (date on the right, no odds; odds live in the Momio
  // field next to the amount). Standalone legs in a MULTI-selection slip keep
  // their date-under-pick + odds, since the Momio there is the combined odds.
  const isStraightBet = selections.length === 1;

  return (
    <div className="flex w-full flex-col">
      {groups.map((group, i) => {
        const divider =
          i > 0 ? (
            <div
              className="h-px w-full shrink-0"
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
                showDate
                showOdds
                indent={false}
                stop={stopSwipePropagation}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
