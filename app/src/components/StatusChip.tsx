import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type StatusTone = 'success' | 'info' | 'warning' | 'danger' | 'neutral';

const TONE_CLASS: Record<StatusTone, string> = {
  success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  info: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  warning: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  danger: 'bg-red-500/15 text-red-400 border-red-500/30',
  neutral: 'bg-muted/60 text-muted-foreground border-border/60',
};

export function StatusChip({
  tone = 'neutral',
  pulse = false,
  children,
  className,
}: {
  tone?: StatusTone;
  pulse?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 truncate rounded-full border px-2.5 py-0.5 text-xs font-medium',
        TONE_CLASS[tone],
        className,
      )}
    >
      {pulse && <span className="size-1.5 rounded-full bg-current animate-pulse" />}
      {children}
    </span>
  );
}
