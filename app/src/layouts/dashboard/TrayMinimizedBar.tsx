import { useTranslation } from 'react-i18next';
import { useDeviceDisplayName } from '@/hooks/useDeviceDisplayName';
import { ChevronUp, Maximize2, LayoutGrid, ShieldAlert, Ear, PowerOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { NothingMark } from '@/components/NothingMark';
import { useDeviceStore, useCapabilities, getCurrentDevice } from '@/lib/deviceStore';
import type { AncMode } from '@/lib/bluetoothProtocol';

export function TrayMinimizedBar() {
  const { t } = useTranslation();
  const displayName = useDeviceDisplayName();
  const selectedModelId = useDeviceStore((s) => s.selectedModelId);
  const battery = useDeviceStore((s) => s.battery);
  const ancMode = useDeviceStore((s) => s.ancMode);
  const setAncMode = useDeviceStore((s) => s.setAncMode);
  const restoreFromSystemTray = useDeviceStore((s) => s.restoreFromSystemTray);

  const caps = useCapabilities();
  const device = getCurrentDevice(selectedModelId);
  const L = t('common.leftShort');
  const R = t('common.rightShort');
  const batterySummary =
    caps.batteryLayout === 'single'
      ? `${battery.left}%`
      : `${L} ${battery.left}% • ${R} ${battery.right}%`;

  const ancButtons = (
    [
      { id: 'anc', icon: ShieldAlert, short: t('tray.ancShort'), full: t('anc.modes.anc') },
      {
        id: 'transparency',
        icon: Ear,
        short: t('tray.ancTransShort'),
        full: t('anc.modes.transparency'),
      },
      { id: 'off', icon: PowerOff, short: t('tray.ancOffShort'), full: t('anc.modes.off') },
    ] as { id: AncMode; icon: typeof ShieldAlert; short: string; full: string }[]
  ).filter(
    (b) =>
      b.id === 'off' ||
      (b.id === 'anc' && caps.anc) ||
      (b.id === 'transparency' && caps.transparency),
  );
  const showAnc = caps.anc || caps.transparency;

  return (
    <div className="h-screen w-screen overflow-hidden bg-background/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 select-none relative">
      {/* Center status card */}
      <div className="max-w-md w-full rounded-2xl border border-border/80 bg-card/90 p-6 text-center space-y-4 shadow-xl">
        <div className="size-12 rounded-2xl bg-primary/15 text-primary flex items-center justify-center mx-auto ring-1 ring-primary/30">
          <NothingMark className="size-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{t('tray.title')}</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">{t('tray.subtitle')}</p>
        </div>

        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="default"
            size="sm"
            onClick={() => void restoreFromSystemTray('mini')}
            className="gap-1.5"
          >
            <LayoutGrid className="size-3.5" />
            {t('tray.openMini')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void restoreFromSystemTray('full')}
            className="gap-1.5"
          >
            <Maximize2 className="size-3.5" />
            {t('tray.openFull')}
          </Button>
        </div>
      </div>

      {/* Simulated Windows 11 "Show hidden icons" Overflow Tray Flyout at bottom-right */}
      <div className="fixed bottom-4 right-4 flex flex-col items-end gap-2">
        {/* Overflow Tray Box */}
        <div className="rounded-xl border border-border/80 glass-float bg-popover/95 p-3 shadow-2xl w-64 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 font-semibold">
              <NothingMark className="size-3.5 text-primary" />
              <span>{displayName}</span>
            </div>
            <span className="font-mono text-[11px] text-muted-foreground">
              {batterySummary}
            </span>
          </div>

          {showAnc && (
            <div className={`grid gap-1 ${ancButtons.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
              {ancButtons.map((btn) => {
                const Icon = btn.icon;
                const active = ancMode === btn.id;
                return (
                  <Tooltip key={btn.id}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setAncMode(btn.id)}
                        aria-pressed={active}
                        aria-label={btn.full}
                        className={`py-1.5 rounded-md text-xs flex items-center justify-center gap-1 border ${
                          active
                            ? 'border-primary bg-primary/15 text-primary font-medium'
                            : 'border-border/60 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Icon className="size-3.5" />
                        <span>{btn.short}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">{btn.full}</TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          )}
        </div>

        {/* Simulated Windows Taskbar Notification Corner ("Show hidden icons" ^) */}
        <div className="h-10 px-3 rounded-xl border border-border/80 bg-card/95 shadow-lg flex items-center gap-2.5">
          <ChevronUp className="size-4 text-primary" />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => void restoreFromSystemTray()}
                className="size-7 rounded-lg bg-primary/15 text-primary flex items-center justify-center hover:bg-primary/25 transition-colors"
                aria-label={t('tray.restoreWindow')}
              >
                <NothingMark className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">{t('tray.restoreWindow')}</TooltipContent>
          </Tooltip>
          <span className="text-xs text-muted-foreground font-mono">{t('tray.showHiddenIcons')}</span>
        </div>
      </div>
    </div>
  );
}
