import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function PageContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-8', className)}>
      {children}
    </div>
  );
}
