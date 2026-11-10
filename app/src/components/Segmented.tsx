import { cn } from '@/lib/utils';

export function Segmented<T extends string = string>({
  value,
  options,
  onChange,
  ariaLabel,
  disabled,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  return (
    <div
      role="group"
      data-slot="segmented"
      aria-label={ariaLabel}
      className="inline-flex rounded-md border border-border bg-muted/40 p-0.5"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            disabled={disabled}
            aria-pressed={active}
            data-slot="segmented-item"
            data-state={active ? 'on' : 'off'}
            className={cn(
              'rounded px-3 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
              active
                ? 'bg-chip text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
