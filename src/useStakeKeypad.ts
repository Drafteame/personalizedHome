import { useRef, useState } from 'react';

/** Max digits the stake accepts — whole pesos, no decimals (the Figma keypad
 *  has no decimal key). Caps the entered amount at 999,999. */
export const MAX_STAKE_DIGITS = 6;

/**
 * useStakeKeypad — shared amount-editing state for the numeric keypad, used by
 * both the summarized bet slip and the "Resumen" floating card.
 *
 * Behavior (per spec):
 *   • Tapping the amount opens the keypad AND clears the current value so the
 *     user can immediately type a new one.
 *   • Tapping "Hecho" with a typed value → saves it and closes.
 *   • Tapping "Hecho" with nothing typed → restores the amount that was there
 *     before editing (on first use that IS the $200 default) and closes.
 *
 * The `stake` itself lives in App (single source of truth shared across both
 * views); this hook only manages the transient draft + open state and commits
 * via `onCommit`.
 */
export function useStakeKeypad(stake: number, onCommit: (next: number) => void) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  // The value shown before the keypad opened — restored on an empty "Hecho".
  const restoreRef = useRef(stake);

  const openKeypad = () => {
    restoreRef.current = stake;
    setDraft(''); // clear so the user can immediately enter a new value
    setOpen(true);
  };

  const pressDigit = (d: string) =>
    setDraft((s) => {
      // Accumulate digits, drop a leading zero, cap the length.
      const next = (s + d).replace(/^0+(\d)/, '$1');
      return next.slice(0, MAX_STAKE_DIGITS);
    });

  const pressDelete = () => setDraft((s) => s.slice(0, -1));

  const done = () => {
    // A typed value saves; an empty draft leaves the previous amount untouched
    // (i.e. restores it, since `stake` never changed).
    if (draft !== '') onCommit(parseInt(draft, 10));
    setOpen(false);
  };

  // Numeric value for derived figures (Ganancia, swipe label): the live draft
  // while editing (0 when empty), otherwise the saved stake.
  const displayValue = open ? (draft === '' ? 0 : parseInt(draft, 10)) : stake;

  // Text for the amount FIELD: while editing it shows the raw draft (BLANK when
  // nothing's typed yet — not "0" — so the field reads empty with a cursor),
  // otherwise the saved stake.
  const displayText = open ? draft : String(stake);

  return {
    open,
    draft,
    openKeypad,
    pressDigit,
    pressDelete,
    done,
    displayValue,
    displayText,
  };
}
