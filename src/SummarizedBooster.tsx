import boosterIllus from './assets/booster.png';
import chevronRightIcon from './assets/chevron_right.svg';
import clockIcon from './assets/clock.svg';

/**
 * SummarizedBooster — the standalone "Booster" incentive row shown in the
 * SUMMARIZED bet slip (BetSlipSheet), directly below the stake amount (or below
 * the numeric keypad while it is open).
 *
 * EXPERIMENTAL / EASILY REMOVABLE.
 * This is an exploration of how the summarized slip reads with a booster. It is
 * intentionally self-contained: the ONLY wiring into the slip is a single
 * `<SummarizedBooster />` call in `BetSlipSheet.tsx`. Flip `SUMMARIZED_BOOSTER_ENABLED`
 * to false (or delete the one call site) to remove it with zero effect on the
 * rest of the slip. It does NOT touch the floating card (`BetSlipFullSheet`),
 * which keeps its own promos-box booster.
 *
 * State / behavior (per spec):
 *   - The booster only becomes AVAILABLE with 3+ selections. The summarized slip
 *     only ever shows 1–2 selections, so here it is ALWAYS in the DISABLED state
 *     — shown purely as an incentive to add another pick.
 *   - The toggle is disabled (matches the Figma "Default-disabled" switch),
 *     non-interactive, and applies no benefit.
 *
 * Visual = Figma "booster" 34464:67859 (Draftea Global): orange-bordered
 * (#ffa65b) 20px-radius row · gradient illustration chip · "Booster NFL 20%" +
 * caret · countdown pill (23h : 23m) · disabled off-toggle.
 */

/** Master switch for this experimental component — set false to hide it. */
export const SUMMARIZED_BOOSTER_ENABLED = true;

export function SummarizedBooster() {
  if (!SUMMARIZED_BOOSTER_ENABLED) return null;

  return (
    // pt-[10px] = the 10px gap ABOVE the booster. When the keypad is closed this
    // is the Monto→booster gap; when it is open it is the keypad→booster gap
    // (the booster sits directly below whichever is above it). The swipe below
    // keeps its own pt-[10px] for the booster→swipe gap.
    <div className="px-[10px] pt-[10px]">
      {/* Border is a 50° orange→pink GRADIENT stroke (Figma), painted by the
          masked .booster-gradient-border ::before — not a solid color. */}
      <div className="booster-gradient-border flex items-center gap-2 rounded-[20px] py-[6px] pl-2 pr-[10px]">
        {/* Illustration chip */}
        <div
          className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-[12px] p-0.5"
          style={{
            backgroundImage:
              'linear-gradient(50deg, #ffa65b 2%, #f0abfc 103%)',
          }}
        >
          <img src={boosterIllus} alt="" className="size-7 object-contain" />
        </div>

        {/* Title + countdown */}
        <div className="flex min-w-px flex-1 flex-col items-start">
          <div className="flex items-center gap-0.5">
            <span className="whitespace-nowrap text-[14px] font-bold leading-[21px] text-[#fbfbfb]">
              Booster NFL 20%
            </span>
            <img
              src={chevronRightIcon}
              alt=""
              className="size-[18px] rotate-90 opacity-70"
            />
          </div>
          <div className="flex h-[18px] items-center gap-1 self-start rounded-[12px] bg-[rgba(251,251,251,0.16)] pl-0.5 pr-1">
            <img src={clockIcon} alt="" className="size-3" />
            <span className="whitespace-nowrap text-[12px] font-bold leading-[18px] text-[#fbfbfb]">
              23h<span className="text-[#e2e2e2]">:</span>23m
            </span>
          </div>
        </div>

        {/* Toggle — disabled off state (non-interactive; no benefit applied). */}
        <div
          className="flex h-8 w-[52px] shrink-0 items-center rounded-full bg-[rgba(251,251,251,0.16)] px-1 opacity-40"
          aria-disabled
        >
          <div className="size-6 rounded-full bg-white" />
        </div>
      </div>
    </div>
  );
}
