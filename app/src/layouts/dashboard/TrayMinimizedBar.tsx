import { useTranslation } from 'react-i18next';
import { ChevronUp, Maximize2, LayoutGrid, ShieldAlert, Ear, PowerOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { NothingMark } from '@/components/NothingMark';
import { useDeviceStore, getCurrentDevice } from '@/lib/deviceStore';

export function TrayMinimizedBar() {
  const { t } = useTranslation();
  const selectedModelId = useDeviceStore((s) => s.selectedModelId);
  const battery = useDeviceStore((s) => s.battery);
  const ancMode = useDeviceStore((s) => s.ancMode);
  const setAncMode = useDeviceStore((s) => s.setAncMode);
  const restoreFromSystemTray = useDeviceStore((s) => s.restoreFromSystemTray);

  const device = getCurrentDevice(selectedModelId);

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
              <span>{device.name}</span>
            </div>
            <span className="font-mono text-[11px] text-muted-foreground">
              L {battery.left}% • R {battery.right}%
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setAncMode('anc')}
                  className={`py-1.5 rounded-md text-xs flex items-center justify-center gap-1 border ${
                    ancMode === 'anc'
                      ? 'border-primary bg-primary/15 text-primary font-medium'
                      : 'border-border/60 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <ShieldAlert className="size-3.5" />
                  <span>ANC</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">{t('anc.modes.anc')}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setAncMode('transparency')}
                  className={`py-1.5 rounded-md text-xs flex items-center justify-center gap-1 border ${
                    ancMode === 'transparency'
                      ? 'border-primary bg-primary/15 text-primary font-medium'
                      : 'border-border/60 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Ear className="size-3.5" />
                  <span>{t('tray.ancTransShort')}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">{t('anc.modes.transparency')}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setAncMode('off')}
                  className={`py-1.5 rounded-md text-xs flex items-center justify-center gap-1 border ${
                    ancMode === 'off'
                      ? 'border-primary bg-primary/15 text-primary font-medium'
                      : 'border-border/60 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <PowerOff className="size-3.5" />
                  <span>{t('tray.ancOffShort')}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">{t('anc.modes.off')}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Simulated Windows Taskbar Notification Corner ("Show hidden icons" ^) */}
        <div className="h-10 px-3 rounded-xl border border-border/80 bg-card/95 shadow-lg flex items-center gap-2.5">
          <ChevronUp className="size-4 text-primary" />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => void restoreFromSystemTray('mini')}
                className="size-7 rounded-lg bg-primary/15 text-primary flex items-center justify-center hover:bg-primary/25 transition-colors"
                aria-label={t('tray.openMini')}
              >
                <NothingMark className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">{t('tray.openMini')}</TooltipContent>
          </Tooltip>
          <span className="text-xs text-muted-foreground font-mono">{t('tray.showHiddenIcons')}</span>
        </div>
      </div>
    </div>
  );
}
