import { useTranslation } from 'react-i18next';
import { BatteryCharging, BluetoothConnected } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { StatusChip } from '@/components/StatusChip';
import {
  useDeviceStore,
  useCapabilities,
  getCurrentDevice,
  getCurrentColor,
} from '@/lib/deviceStore';

export function BatteryCards() {
  const { t } = useTranslation();

  const battery = useDeviceStore((s) => s.battery);
  const selectedModelId = useDeviceStore((s) => s.selectedModelId);
  const selectedColorSku = useDeviceStore((s) => s.selectedColorSku);
  const connectionMode = useDeviceStore((s) => s.connectionMode);
  const activeMacAddress = useDeviceStore((s) => s.activeMacAddress);
  const firmwareVersion = useDeviceStore((s) => s.firmwareVersion);
  const serialNumber = useDeviceStore((s) => s.serialNumber);

  const caps = useCapabilities();
  const device = getCurrentDevice(selectedModelId);
  const activeColor = getCurrentColor(device, selectedColorSku);
  const connected = connectionMode === 'connected';

  // Single-battery layout (headphones / neckband, e.g. Nothing Headphone (1) B170)
  if (caps.batteryLayout === 'single') {
    const level = battery.left;
    const charging = battery.leftCharging;
    const tone =
      level > 30 ? 'bg-emerald-500' : level > 15 ? 'bg-amber-500' : 'bg-red-500';

    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Main Headphone Battery Card with Real Image */}
        <Card className="sm:col-span-2">
          <CardContent className="flex items-center justify-between gap-4 p-5">
            <div className="flex-1 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-primary/15 px-2 py-0.5 font-mono text-[11px] font-bold text-primary">
                    {device.modelId}
                  </span>
                  <span className="font-semibold text-sm">{device.name}</span>
                </div>
                <StatusChip tone={charging ? 'success' : 'neutral'}>
                  {charging && <BatteryCharging className="size-3" />}
                  {charging
                    ? t('overview.charging')
                    : connected
                      ? t('overview.inUse')
                      : t('overview.idle')}
                </StatusChip>
              </div>

              <div className="flex items-baseline gap-3 pt-1">
                <div className="font-bold text-4xl tracking-tight tabular-nums">
                  {level}%
                </div>
                <span className="font-mono text-muted-foreground text-xs">
                  {t('overview.liveBattery')}
                </span>
              </div>

              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${tone}`}
                  style={{ width: `${level}%` }}
                />
              </div>
            </div>

            <div className="flex size-24 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-secondary/25 p-2">
              <img
                src={activeColor.heroImage}
                alt={device.name}
                className="max-h-full max-w-full object-contain drop-shadow-md"
              />
            </div>
          </CardContent>
        </Card>

        {/* Hardware Identity & Link Card */}
        <Card>
          <CardContent className="flex h-full flex-col justify-between space-y-3 p-5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm">
                {t('overview.hardwareInfo')}
              </span>
              <BluetoothConnected
                className={
                  connected
                    ? 'size-4 text-emerald-600 dark:text-emerald-400'
                    : 'size-4 text-muted-foreground'
                }
              />
            </div>

            <div className="space-y-1.5 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('overview.macLabel')}</span>
                <span className="text-foreground">
                  {activeMacAddress ?? '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('overview.firmwareLabel')}</span>
                <span className="text-foreground">
                  {firmwareVersion ? `v${firmwareVersion}` : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('overview.serialLabel')}</span>
                <span className="truncate pl-2 text-foreground">{serialNumber ?? '—'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // TWS Earbuds (Left + Right + Charging Case) with Real Product Photos
  const budStatus = (charging: boolean) =>
    charging ? t('overview.charging') : connected ? t('overview.inEar') : t('overview.idle');
  const items = [
    {
      id: 'left',
      label: t('overview.leftEarbud'),
      badge: t('common.leftShort'),
      level: battery.left,
      charging: battery.leftCharging,
      sub: budStatus(battery.leftCharging),
      image: activeColor.leftImage,
    },
    {
      id: 'right',
      label: t('overview.rightEarbud'),
      badge: t('common.rightShort'),
      level: battery.right,
      charging: battery.rightCharging,
      sub: budStatus(battery.rightCharging),
      image: activeColor.rightImage,
    },
    {
      id: 'case',
      label: t('overview.chargingCase'),
      badge: t('common.caseShort'),
      level: battery.caseLevel,
      charging: battery.caseCharging,
      sub: battery.caseCharging ? t('overview.charging') : t('overview.discharging'),
      image: activeColor.caseImage,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {items.map((item) => {
        const tone =
          item.level > 30
            ? 'bg-emerald-500'
            : item.level > 15
              ? 'bg-amber-500'
              : 'bg-red-500';
        return (
          <Card key={item.id}>
            <CardContent className="flex items-center justify-between gap-3 p-5">
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-primary/12 px-2 py-0.5 font-bold text-[11px] text-primary">
                      {item.badge}
                    </span>
                    <span className="truncate font-medium text-sm">{item.label}</span>
                  </div>
                </div>

                <div className="flex items-baseline justify-between pt-0.5">
                  <div className="font-bold text-3xl tracking-tight tabular-nums">
                    {item.level}%
                  </div>
                  <StatusChip tone={item.charging ? 'success' : 'neutral'}>
                    {item.charging && <BatteryCharging className="size-3" />}
                    {item.sub}
                  </StatusChip>
                </div>

                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${tone}`}
                    style={{ width: `${item.level}%` }}
                  />
                </div>
              </div>

              <div className="flex size-16 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-secondary/20 p-1.5">
                <img
                  src={item.image}
                  alt={item.label}
                  className="max-h-full max-w-full object-contain drop-shadow-sm"
                />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
