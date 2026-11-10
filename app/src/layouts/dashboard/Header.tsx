import { useState } from 'react';
import {
  Menu,
  Bluetooth,
  BluetoothConnected,
  BluetoothSearching,
  Minimize2,
  EyeOff,
  SlidersHorizontal,
  RefreshCw,
  AlertTriangle,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDeviceDisplayName } from '@/hooks/useDeviceDisplayName';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { LangSwitch } from '@/components/LangSwitch';
import { ThemeToggle } from '@/components/ThemeToggle';
import { StatusChip } from '@/components/StatusChip';
import { NothingMark } from '@/components/NothingMark';
import { DeviceSetupModal } from '@/components/DeviceSetupModal';
import { APP_NAME } from '@/lib/appMeta';
import {
  useDeviceStore,
  getCurrentDevice,
  getCurrentColor,
} from '@/lib/deviceStore';
import { cn } from '@/lib/utils';
import { SidebarNav } from './SidebarNav';

export function Header() {
  const { t } = useTranslation();
  const displayName = useDeviceDisplayName();
  const [mobileOpen, setMobileOpen] = useState(false);

  const selectedModelId = useDeviceStore((s) => s.selectedModelId);
  const selectedColorSku = useDeviceStore((s) => s.selectedColorSku);
  const connectionMode = useDeviceStore((s) => s.connectionMode);
  const autoDetectStatus = useDeviceStore((s) => s.autoDetectStatus);
  const activeMacAddress = useDeviceStore((s) => s.activeMacAddress);
  const battery = useDeviceStore((s) => s.battery);
  const selectColor = useDeviceStore((s) => s.selectColor);
  const setViewMode = useDeviceStore((s) => s.setViewMode);
  const hideToSystemTray = useDeviceStore((s) => s.hideToSystemTray);
  const setSetupModalOpen = useDeviceStore((s) => s.setSetupModalOpen);
  const scanAndAutoConnect = useDeviceStore((s) => s.scanAndAutoConnect);

  const currentDevice = getCurrentDevice(selectedModelId);
  const currentColor = getCurrentColor(currentDevice, selectedColorSku);

  const lastCommandError = useDeviceStore((s) => s.lastCommandError);
  const clearCommandError = useDeviceStore((s) => s.clearCommandError);

  const handleAutoDetectClick = async () => {
    await scanAndAutoConnect(true);
    const state = useDeviceStore.getState();
    const dev = getCurrentDevice(state.selectedModelId);
    if (state.connectionMode === 'connected') {
      toast.success(
        t('header.autoDetectedToast', { name: dev.name, level: state.battery.left }),
      );
    }
  };

  return (
    <header
      data-ui="topbar"
      className="z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md lg:px-6"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <Button
          variant="ghost"
          size="icon-sm"
          className="md:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label={t('nav.openMenu')}
        >
          <Menu className="size-4" />
        </Button>

        {/* Auto-Detected Device Pill (Click to open Setup / Pairing / Switch Modal) */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setSetupModalOpen(true)}
              className="group flex items-center gap-2.5 rounded-xl border border-border/70 bg-secondary/35 px-2.5 py-1.5 text-left transition-all hover:border-primary/50 hover:bg-secondary/60"
            >
              <div className="relative flex size-7 shrink-0 items-center justify-center rounded-lg bg-background/80 p-0.5">
                <img
                  src={currentColor.heroImage}
                  alt={currentDevice.name}
                  className="max-h-full max-w-full object-contain"
                />
                <span
                  className={cn(
                    'absolute -right-0.5 -bottom-0.5 size-2 rounded-full border border-background',
                    connectionMode === 'connected'
                      ? 'bg-emerald-500'
                      : 'bg-amber-500',
                  )}
                />
              </div>

              <div className="min-w-0 pr-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-semibold text-foreground text-xs sm:text-sm">
                    {displayName}
                  </span>
                </div>
                <p className="truncate font-mono text-[10px] text-muted-foreground">
                  {connectionMode === 'connected'
                    ? `${activeMacAddress ?? 'Bluetooth RFCOMM'} • ${battery.left}%`
                    : t('header.clickToSetup')}
                </p>
              </div>

              <SlidersHorizontal className="ml-1 size-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {t('header.setupTooltip')}
          </TooltipContent>
        </Tooltip>

        {/* Colorway Picker with Custom Tooltip */}
        <div className="hidden items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2 py-1 sm:flex">
          {currentDevice.colors.map((color) => {
            const active = color.sku === selectedColorSku;
            return (
              <Tooltip key={color.sku}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => selectColor(color.sku)}
                    aria-label={color.colorName}
                    aria-pressed={active}
                    className={`size-4 rounded-full border transition-transform ${
                      active
                        ? 'scale-115 border-foreground/40 ring-2 ring-primary ring-offset-1 ring-offset-background'
                        : 'border-border opacity-70 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: color.hex }}
                  />
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {t('header.colorVariant')}: {color.colorName}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1.5">
        {lastCommandError && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={clearCommandError}
                aria-label={t('header.dismissError')}
                className="mr-1 inline-flex max-w-48 items-center gap-1 rounded-md border border-danger/40 bg-danger/10 px-2 py-1 text-[11px] text-danger"
              >
                <AlertTriangle className="size-3 shrink-0" />
                <span className="hidden truncate sm:inline">{t('errors.commandFailed')}</span>
                <X className="size-3 shrink-0 opacity-70" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs break-words">
              {lastCommandError}
            </TooltipContent>
          </Tooltip>
        )}
        <StatusChip
          tone={connectionMode === 'connected' ? 'success' : 'info'}
          pulse={connectionMode === 'connected'}
          className="mr-1 hidden lg:inline-flex"
        >
          {connectionMode === 'connected'
            ? t('header.autoConnected')
            : t('header.demoMode')}
        </StatusChip>

        {/* Auto-Scan / Setup Trigger Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={connectionMode === 'connected' ? 'secondary' : 'default'}
              size="sm"
              onClick={() => void handleAutoDetectClick()}
              disabled={autoDetectStatus === 'scanning'}
              className="gap-1.5"
            >
              {autoDetectStatus === 'scanning' ? (
                <>
                  <BluetoothSearching className="size-3.5 animate-pulse" />
                  <span className="hidden sm:inline">
                    {t('header.scanning')}
                  </span>
                </>
              ) : connectionMode === 'connected' ? (
                <>
                  <BluetoothConnected className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="hidden sm:inline">
                    {t('header.resync')}
                  </span>
                  <RefreshCw className="size-3 opacity-70" />
                </>
              ) : (
                <>
                  <Bluetooth className="size-3.5" />
                  <span className="hidden sm:inline">
                    {t('header.setupConnection')}
                  </span>
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {t('header.scanTooltip')}
          </TooltipContent>
        </Tooltip>

        {/* Mini Widget Mode Toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                setViewMode('mini');
                toast.success(t('tray.pinnedToast'));
              }}
              aria-label={t('window.miniMode')}
            >
              <Minimize2 className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t('window.miniMode')}</TooltipContent>
        </Tooltip>

        {/* Hide to System Tray (Show hidden icons) */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={async () => {
                await hideToSystemTray();
                toast.info(t('tray.hiddenToast'));
              }}
              aria-label={t('window.hideToTray')}
            >
              <EyeOff className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t('window.hideToTray')}</TooltipContent>
        </Tooltip>

        <LangSwitch />
        <ThemeToggle />
      </div>

      {/* Auto-Detection & Setup Modal */}
      <DeviceSetupModal />

      {/* Mobile Navigation Drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="flex-row items-center gap-2.5 space-y-0 border-b border-border px-4 h-14">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <NothingMark className="size-4" />
            </div>
            <SheetTitle className="font-ndot text-sm">{APP_NAME}</SheetTitle>
          </SheetHeader>
          <SidebarNav collapsed={false} onItemClick={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
    </header>
  );
}
