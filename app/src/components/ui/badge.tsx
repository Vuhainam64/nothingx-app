import { cn } from '@/lib/utils';

const VARIANT_CLASS = {
  default: 'bg-primary text-primary-foreground',
  secondary: 'bg-secondary text-secondary-foreground',
  outline: 'border border-border text-foreground',
} as const;

export function Badge({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<'span'> & { variant?: keyof typeof VARIANT_CLASS }) {
  return (
    <span
      data-slot="badge"
      data-variant={variant}
      className={cn(
        'inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        VARIANT_CLASS[variant],
        className,
      )}
      {...props}
    />
  );
}
