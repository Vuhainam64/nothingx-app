import { PanelLeftClose, PanelLeft, BatteryCharging } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { APP_NAME, APP_VERSION } from '@/lib/appMeta';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { NothingMark } from '@/components/NothingMark';
import { useDeviceStore } from '@/lib/deviceStore';
import { SidebarNav } from './SidebarNav';

interface DashboardSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function DashboardSidebar({ collapsed, onToggle }: DashboardSidebarProps) {
  const { t } = useTranslation();
  const battery = useDeviceStore((s) => s.battery);

  return (
    <aside
      data-ui="sidebar"
      className={cn(
        'hidden md:flex flex-col shrink-0 border-r border-border bg-sidebar text-sidebar-foreground select-none transition-[width] duration-200 ease-out',
        collapsed ? 'w-14' : 'w-60',
      )}
    >
      {/* Brand header */}
      <div
        className={cn(
          'h-14 flex items-center border-b border-border/60 shrink-0',
          collapsed ? 'justify-center px-0' : 'justify-between px-3.5',
        )}
      >
        <div className={cn('flex items-center min-w-0', collapsed ? 'justify-center' : 'gap-2.5')}>
          <div className="size-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0 ring-1 ring-primary/30">
            <NothingMark className="size-4" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-ndot text-sm tracking-wider leading-none truncate">
                {APP_NAME}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                {t('app.tagline')}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <SidebarNav collapsed={collapsed} />

      {/* Compact Battery Summary Footer */}
      {!collapsed && (
        <div className="mx-2.5 mb-2 p-2.5 rounded-lg border border-border/70 bg-background/50 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground/85">{t('overview.batteryStatus')}</span>
            {battery.caseCharging && <BatteryCharging className="size-3.5 text-emerald-500" />}
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-center font-mono">
            <div className="rounded bg-muted/60 py-1 px-1">
              <div className="text-[10px] text-muted-foreground">L</div>
              <div className="text-xs font-semibold tabular-nums">{battery.left}%</div>
            </div>
            <div className="rounded bg-muted/60 py-1 px-1">
              <div className="text-[10px] text-primary font-bold">R</div>
              <div className="text-xs font-semibold tabular-nums">{battery.right}%</div>
            </div>
            <div className="rounded bg-muted/60 py-1 px-1">
              <div className="text-[10px] text-muted-foreground">CASE</div>
              <div className="text-xs font-semibold tabular-nums">{battery.caseLevel}%</div>
            </div>
          </div>
        </div>
      )}

      {/* Collapse toggle */}
      <div
        data-ui="sidebar-footer"
        className={cn(
          'border-t border-border/60 p-2 flex items-center',
          collapsed ? 'justify-center' : 'justify-between',
        )}
      >
        {!collapsed && (
          <span className="text-[11px] text-muted-foreground px-2 font-mono">v{APP_VERSION}</span>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className={collapsed ? 'mx-auto size-9' : ''}
              onClick={onToggle}
              aria-label={collapsed ? t('nav.expand') : t('nav.collapse')}
            >
              {collapsed ? (
                <PanelLeft className="size-4" />
              ) : (
                <PanelLeftClose className="size-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {collapsed ? t('nav.expand') : t('nav.collapse')}
          </TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
}
