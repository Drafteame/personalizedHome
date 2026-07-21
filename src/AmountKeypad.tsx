import { useRef } from 'react';
import deleteIcon from './assets/delete.svg';
import doneCheckIcon from './assets/done-check.svg';

/**
 * AmountKeypad — the shared numeric keypad (Figma `keyboard` 34367:172671) used
 * by BOTH the summarized bet slip (BetSlipSheet) and the "Resumen" floating card
 * (BetSlipFullSheet) to edit the entry amount.
 *
 * A 3×4 grid: digits 1–9, then Delete · 0 · Hecho. Purely presentational — the
 * parent owns the amount/draft state (see useStakeKeypad) and reacts to the
 * three callbacks. Every key is a real <button>, so the parents' swipe/collapse
 * recognizers (useVerticalSwipe, which excludes `button`) never fire from a tap
 * on a key.
 *
 * Faithful to Figma: rows are 40px tall, separated by a `rgba(251,251,251,0.34)`
 * hairline; keys are divided by a `rgba(251,251,251,0.16)` hairline. Digits are
 * Red Hat Display Medium 16px @ 70% white; "Hecho" uses the success accent
 * button treatment from Draftea Global; Delete is the 24px provided glyph.
 */

/** Fixed keypad height (px) — 4 rows × 40px. Parents use this to size the
 *  slide-in slot without having to measure the keypad. */
export const KEYPAD_H = 160;

// Horizontal row divider — a gradient that fades to transparent at both ends
// (Figma flattens it to a solid rgba(251,251,251,0.34), but it's a gradient
// stroke). Rendered as a 1px absolute line so it doesn't affect the row height.
const ROW_DIVIDER =
  'linear-gradient(90deg, rgba(251,251,251,0) 0%, rgba(251,251,251,0.34) 50%, rgba(251,251,251,0) 100%)';

// A downward drag of at least this many px anywhere on the keypad triggers
// `onSwipeDown` (used to close the bet slip while the keyboard is up). Detected
// with plain pointer down/up (NO pointer capture) so key TAPS still fire their
// click — a clean tap moves <this and just types the digit.
const SWIPE_DISMISS_PX = 44;

type Key =
  | { kind: 'digit'; label: string }
  | { kind: 'delete' }
  | { kind: 'done' };

const ROWS: Key[][] = [
  [
    { kind: 'digit', label: '1' },
    { kind: 'digit', label: '2' },
    { kind: 'digit', label: '3' },
  ],
  [
    { kind: 'digit', label: '4' },
    { kind: 'digit', label: '5' },
    { kind: 'digit', label: '6' },
  ],
  [
    { kind: 'digit', label: '7' },
    { kind: 'digit', label: '8' },
    { kind: 'digit', label: '9' },
  ],
  [{ kind: 'delete' }, { kind: 'digit', label: '0' }, { kind: 'done' }],
];

type Props = {
  onDigit: (d: string) => void;
  onDelete: () => void;
  onDone: () => void;
  /** Fired on a downward drag over the keypad — parents use it to close the bet
   *  slip so swipe-to-close works even while the keyboard covers the card. */
  onSwipeDown?: () => void;
};

export function AmountKeypad({ onDigit, onDelete, onDone, onSwipeDown }: Props) {
  // Track the pointer-down Y so a downward drag (vs a tap) can close the slip.
  const downYRef = useRef<number | null>(null);
  return (
    <div
      className="flex w-full flex-col"
      style={{ height: KEYPAD_H, touchAction: 'none' }}
      onPointerDown={(e) => {
        downYRef.current = e.clientY;
      }}
      onPointerUp={(e) => {
        const startY = downYRef.current;
        downYRef.current = null;
        if (startY != null && e.clientY - startY > SWIPE_DISMISS_PX) {
          onSwipeDown?.();
        }
      }}
    >
      {ROWS.map((row, ri) => {
        const lastRow = ri === ROWS.length - 1;
        return (
          <div key={ri} className="relative flex flex-1 items-center">
            {row.map((key, ci) => {
              const withDivider = ci < row.length - 1;
              const handler =
                key.kind === 'digit'
                  ? () => onDigit(key.label)
                  : key.kind === 'delete'
                    ? onDelete
                    : onDone;
              return (
                <button
                  key={ci}
                  type="button"
                  onClick={handler}
                  className={`flex h-full flex-1 items-center justify-center px-4 transition-colors ${
                    key.kind === 'done'
                      ? 'gap-2 bg-[rgba(52,211,153,0.16)] active:bg-[rgba(52,211,153,0.22)]'
                      : 'active:bg-[rgba(251,251,251,0.06)]'
                  } ${
                    withDivider
                      ? 'border-r border-[rgba(251,251,251,0.16)]'
                      : ''
                  }`}
                >
                  {key.kind === 'delete' ? (
                    <img src={deleteIcon} alt="Borrar" className="size-6" />
                  ) : key.kind === 'done' ? (
                    <>
                      <span className="relative size-[18px] shrink-0 overflow-hidden">
                        <img
                          src={doneCheckIcon}
                          alt=""
                          className="absolute inset-[18.71%_5%] h-[62.57%] w-[90%]"
                        />
                      </span>
                      <span className="text-[14px] font-medium leading-[21px] text-[#34d399]">
                        Hecho
                      </span>
                    </>
                  ) : (
                    <span className="text-[16px] font-medium leading-6 text-[rgba(251,251,251,0.7)]">
                      {key.label}
                    </span>
                  )}
                </button>
              );
            })}
            {!lastRow && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
                style={{ backgroundImage: ROW_DIVIDER }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
