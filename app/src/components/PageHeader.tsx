import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function PageHeader({
  title,
  subtitle,
  description,
  actions,
  leading,
  className,
}: {
  title: string;
  subtitle?: string;
  description?: string;
  actions?: ReactNode;
  leading?: ReactNode;
  className?: string;
}) {
  const descText = subtitle ?? description;
  const heading = (
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {descText && <p className="max-w-3xl text-sm text-muted-foreground">{descText}</p>}
    </div>
  );
  return (
    <div
      data-ui="page-header"
      className={cn(
        'page-header-glass sticky top-3 z-20 -mt-2 flex flex-wrap items-start justify-between gap-4 rounded-2xl p-4',
        className,
      )}
    >
      {leading ? (
        <div className="flex items-start gap-2">
          {leading}
          {heading}
        </div>
      ) : (
        heading
      )}
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
