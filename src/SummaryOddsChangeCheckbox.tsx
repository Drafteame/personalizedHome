import doneCheckIcon from './assets/done-check.svg';
import { PRIMARY_PURPLE } from './SwipeToConfirm';

type Props = {
  checked: boolean;
  onToggle: () => void;
};

export function SummaryOddsChangeCheckbox({ checked, onToggle }: Props) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className="mx-auto flex w-fit max-w-[calc(100%-20px)] items-center justify-center gap-3 px-[10px] pt-[10px] text-left active:opacity-70"
    >
      <span
        className={`relative flex size-5 shrink-0 items-center justify-center rounded-[6px] ${
          checked
            ? 'border-0'
            : 'border-2 border-[rgba(251,251,251,0.3)] bg-transparent'
        }`}
        style={checked ? { backgroundColor: PRIMARY_PURPLE } : undefined}
        aria-hidden
      >
        {checked && (
          <span
            className="h-[11px] w-4 bg-[#fbfbfb]"
            style={{
              WebkitMaskImage: `url(${doneCheckIcon})`,
              maskImage: `url(${doneCheckIcon})`,
              WebkitMaskRepeat: 'no-repeat',
              maskRepeat: 'no-repeat',
              WebkitMaskPosition: 'center',
              maskPosition: 'center',
              WebkitMaskSize: 'contain',
              maskSize: 'contain',
            }}
          />
        )}
      </span>
      <span className="min-w-0 text-[13px] font-medium leading-4 text-[rgba(251,251,251,0.7)]">
        Acepta siempre el cambio de momios.{' '}
        <span className="text-[12px] underline">Más info.</span>
      </span>
    </button>
  );
}
