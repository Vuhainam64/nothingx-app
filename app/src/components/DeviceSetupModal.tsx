import {
  Bluetooth,
  BluetoothConnected,
  BluetoothSearching,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DEVICE_CATALOG } from '@/lib/deviceCatalog';
import {
  useDeviceStore,
  getCurrentColor,
  getCurrentDevice,
} from '@/lib/deviceStore';
import { cn } from '@/lib/utils';

export function DeviceSetupModal() {
  const { t } = useTranslation();

  const setupModalOpen = useDeviceStore((s) => s.setupModalOpen);
  const setSetupModalOpen = useDeviceStore((s) => s.setSetupModalOpen);
  const autoDetectStatus = useDeviceStore((s) => s.autoDetectStatus);
  const detectedDevices = useDeviceStore((s) => s.detectedDevices);
  const selectedModelId = useDeviceStore((s) => s.selectedModelId);
  const selectedColorSku = useDeviceStore((s) => s.selectedColorSku);
  const connectionMode = useDeviceStore((s) => s.connectionMode);
  const activeMacAddress = useDeviceStore((s) => s.activeMacAddress);
  const scanAndAutoConnect = useDeviceStore((s) => s.scanAndAutoConnect);
  const connectDetectedDevice = useDeviceStore((s) => s.connectDetectedDevice);
  const openWindowsBluetoothSettings = useDeviceStore(
    (s) => s.openWindowsBluetoothSettings,
  );
  const selectDevice = useDeviceStore((s) => s.selectDevice);

  const currentDevice = getCurrentDevice(selectedModelId);
  const currentColor = getCurrentColor(currentDevice, selectedColorSku);

  return (
    <Dialog open={setupModalOpen} onOpenChange={setSetupModalOpen}>
      <DialogContent className="max-w-3xl overflow-hidden border-border/80 bg-card p-0 sm:max-w-3xl">
        {/* Top Banner with Nothing Dot-Matrix & Radar */}
        <div className="relative overflow-hidden border-b border-border/60 bg-gradient-to-br from-primary/14 via-background to-background px-6 pt-6 pb-5">
          <div className="dot-matrix-bg pointer-events-none absolute inset-0 opacity-25" />
          <DialogHeader className="relative z-10">
            <div className="flex flex-wrap items-center justify-between gap-3 pr-6">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-xl border border-primary/40 bg-primary/15 text-primary">
                  {autoDetectStatus === 'scanning' ? (
                    <BluetoothSearching className="size-5 animate-pulse" />
                  ) : connectionMode === 'connected' ? (
                    <BluetoothConnected className="size-5" />
                  ) : (
                    <Bluetooth className="size-5" />
                  )}
                </div>
                <div>
                  <DialogTitle className="font-display text-base tracking-wider uppercase">
                    {t('setup.title')}
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 text-xs">
                    {t('setup.subtitle')}
                  </DialogDescription>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => void openWindowsBluetoothSettings()}
                >
                  <ExternalLink className="size-3.5" />
                  {t('setup.openWinBtBtn')}
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  className="h-8 gap-1.5 text-xs"
                  disabled={autoDetectStatus === 'scanning'}
                  onClick={() => void scanAndAutoConnect(false)}
                >
                  <RefreshCw
                    className={cn(
                      'size-3.5',
                      autoDetectStatus === 'scanning' && 'animate-spin',
                    )}
                  />
                  {t('setup.rescanBtn')}
                </Button>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="max-h-[72vh] space-y-6 overflow-y-auto px-6 py-5">
          {/* Discovered Windows Bluetooth Devices */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                {t('setup.detectedTitle')}
              </h4>
              {autoDetectStatus === 'scanning' && (
                <span className="flex items-center gap-1.5 font-mono text-xs text-primary">
                  <span className="size-2 animate-ping rounded-full bg-primary" />
                  {t('setup.scanning')}
                </span>
              )}
            </div>

            {detectedDevices.length > 0 ? (
              <div className="grid grid-cols-1 gap-3">
                {detectedDevices.map((dev) => {
                  const catDev = getCurrentDevice(dev.matched_model_id);
                  const catColor = getCurrentColor(
                    catDev,
                    dev.matched_color_sku ?? catDev.colors[0]?.sku ?? '',
                  );
                  const isCurrentActive =
                    connectionMode === 'connected' &&
                    activeMacAddress === dev.mac_address;

                  return (
                    <div
                      key={dev.mac_address}
                      className={cn(
                        'flex flex-col justify-between gap-4 rounded-xl border p-4 transition-all sm:flex-row sm:items-center',
                        dev.connected
                          ? 'border-emerald-500/40 bg-emerald-500/5'
                          : 'border-border/70 bg-secondary/25',
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className="relative flex size-20 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background/80 p-2">
                          <img
                            src={catColor.heroImage}
                            alt={dev.name}
                            className="max-h-full max-w-full object-contain drop-shadow-md"
                          />
                          <span
                            className={cn(
                              'absolute -top-1 -right-1 size-3 rounded-full border-2 border-background',
                              dev.connected ? 'bg-emerald-400' : 'bg-amber-400',
                            )}
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-display text-base font-bold tracking-tight">
                              {dev.name}
                            </span>
                            <Badge
                              variant={dev.connected ? 'default' : 'secondary'}
                              className={cn(
                                'font-mono text-[10px]',
                                dev.connected &&
                                  'border-emerald-500/40 bg-emerald-500/15 text-emerald-400',
                              )}
                            >
                              {dev.connected
                                ? t('setup.connectedBadge')
                                : t('setup.pairedBadge')}
                            </Badge>
                            <Badge variant="outline" className="font-mono text-[10px]">
                              {catColor.colorName}
                            </Badge>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground">
                            <span>MAC: {dev.mac_address}</span>
                            {dev.battery_left !== null && (
                              <span className="text-emerald-400">
                                {t('setup.batteryLabel')}: {dev.battery_left}%
                              </span>
                            )}
                            {dev.firmware_version && (
                              <span>FW: v{dev.firmware_version}</span>
                            )}
                            {dev.serial_number && (
                              <span>SN: {dev.serial_number}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <Button
                          size="sm"
                          variant={isCurrentActive ? 'secondary' : 'default'}
                          className="gap-1.5"
                          onClick={() => void connectDetectedDevice(dev)}
                        >
                          <CheckCircle2 className="size-4" />
                          {isCurrentActive ? t('setup.activeBtn') : t('setup.connectNowBtn')}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 items-center gap-5 rounded-xl border border-border/70 bg-secondary/20 p-5 md:grid-cols-12">
                <div className="flex flex-col items-center justify-center md:col-span-5">
                  <div className="relative flex h-44 w-full items-center justify-center rounded-xl border border-border/50 bg-background/60 p-3">
                    <img
                      src={
                        currentColor.steerImage ||
                        '/assets/icons/launch/onboarding_bluetooth_dark.png'
                      }
                      alt={currentDevice.name}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                </div>
                <div className="space-y-3 md:col-span-7">
                  <div className="space-y-1">
                    <h5 className="font-semibold text-foreground text-sm">
                      {t('setup.guideTitle')}
                    </h5>
                    <p className="text-muted-foreground text-xs">
                      {t('setup.noDeviceDesc')}
                    </p>
                  </div>
                  <ol className="space-y-2 text-xs text-muted-foreground">
                    <li className="flex items-start gap-2.5">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-[11px] font-bold text-primary">
                        1
                      </span>
                      <span>{t('setup.step1')}</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-[11px] font-bold text-primary">
                        2
                      </span>
                      <span>{t('setup.step2')}</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-[11px] font-bold text-primary">
                        3
                      </span>
                      <span>{t('setup.step3')}</span>
                    </li>
                  </ol>
                </div>
              </div>
            )}
          </div>

          {/* Official Pairing Guide Card when a device is selected */}
          {detectedDevices.length > 0 && currentColor.steerImage && (
            <div className="grid grid-cols-1 items-center gap-4 rounded-xl border border-border/60 bg-secondary/15 p-4 md:grid-cols-12">
              <div className="flex h-32 items-center justify-center rounded-lg bg-background/60 p-2 md:col-span-4">
                <img
                  src={currentColor.steerImage}
                  alt={currentDevice.name}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <div className="space-y-2 md:col-span-8">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  <span className="font-semibold text-xs uppercase tracking-wider">
                    {t('setup.guideTitle')} — {currentDevice.name}
                  </span>
                </div>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {t('setup.step1')} {t('setup.step3')}
                </p>
              </div>
            </div>
          )}

          {/* Supported Catalog Grid with Real Product Images */}
          <div className="space-y-3 border-t border-border/60 pt-4">
            <div>
              <h4 className="font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                {t('setup.catalogTitle')}
              </h4>
              <p className="text-muted-foreground text-xs">
                {t('setup.catalogSubtitle')}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
              {DEVICE_CATALOG.map((item) => {
                const isSelected = item.modelId === selectedModelId;
                const previewImg = item.colors[0]?.heroImage;
                return (
                  <button
                    key={item.modelId}
                    type="button"
                    onClick={() => {
                      selectDevice(item.modelId);
                      setSetupModalOpen(false);
                    }}
                    className={cn(
                      'group flex flex-col items-center gap-2 rounded-xl border p-3 text-left transition-all',
                      isSelected
                        ? 'border-primary bg-primary/10 shadow-xs'
                        : 'border-border/60 bg-secondary/20 hover:border-border hover:bg-secondary/40',
                    )}
                  >
                    <div className="relative flex h-20 w-full items-center justify-center">
                      <img
                        src={previewImg}
                        alt={item.name}
                        className="max-h-full max-w-full object-contain transition-transform duration-200 group-hover:scale-105"
                      />
                    </div>
                    <div className="w-full text-center">
                      <p className="truncate font-semibold text-foreground text-xs">
                        {item.name}
                      </p>
                      <div className="mt-1 flex items-center justify-center gap-1">
                        {item.colors.map((c) => (
                          <span
                            key={c.sku}
                            className="size-2.5 rounded-full border border-white/25"
                            style={{ backgroundColor: c.hex }}
                          />
                        ))}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
