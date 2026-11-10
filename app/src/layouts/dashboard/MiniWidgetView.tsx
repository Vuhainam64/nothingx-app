import { useTranslation } from 'react-i18next';
import { useDeviceDisplayName } from '@/hooks/useDeviceDisplayName';
import {
  Maximize2,
  EyeOff,
  ShieldAlert,
  Ear,
  PowerOff,
  Waves,
  Gamepad2,
  Volume2,
  BatteryCharging,
  BluetoothConnected,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Segmented } from '@/components/Segmented';
import { NothingMark } from '@/components/NothingMark';
import {
  useDeviceStore,
  useCapabilities,
  getCurrentDevice,
  getCurrentColor,
} from '@/lib/deviceStore';
import type { AncMode, AncLevel, EqPreset } from '@/lib/bluetoothProtocol';
import type { DiracMode, FindTarget } from '@/lib/deviceCapabilities';
import {
  eqPickerLabel,
  eqPickerOptions,
  eqPickerValue,
  type EqPickerValue,
} from '@/components/device/capabilityUi';

export function MiniWidgetView() {
  const { t } = useTranslation();
  const displayName = useDeviceDisplayName();

  const selectedModelId = useDeviceStore((s) => s.selectedModelId);
  const selectedColorSku = useDeviceStore((s) => s.selectedColorSku);
  const connectionMode = useDeviceStore((s) => s.connectionMode);
  const battery = useDeviceStore((s) => s.battery);
  const ancMode = useDeviceStore((s) => s.ancMode);
  const ancLevel = useDeviceStore((s) => s.ancLevel);
  const eqPreset = useDeviceStore((s) => s.eqPreset);
  const diracMode = useDeviceStore((s) => s.diracMode);
  const caps = useCapabilities();
  const ultraBassEnabled = useDeviceStore((s) => s.ultraBassEnabled);
  const lowLatencyMode = useDeviceStore((s) => s.lowLatencyMode);
  const ringing = useDeviceStore((s) => s.ringing);

  const setAncMode = useDeviceStore((s) => s.setAncMode);
  const setAncLevel = useDeviceStore((s) => s.setAncLevel);
  const setEqPreset = useDeviceStore((s) => s.setEqPreset);
  const setDiracMode = useDeviceStore((s) => s.setDiracMode);
  const setUltraBass = useDeviceStore((s) => s.setUltraBass);
  const setLowLatencyMode = useDeviceStore((s) => s.setLowLatencyMode);
  const toggleFind = useDeviceStore((s) => s.toggleFind);
  const setViewMode = useDeviceStore((s) => s.setViewMode);
  const hideToSystemTray = useDeviceStore((s) => s.hideToSystemTray);

  const device = getCurrentDevice(selectedModelId);
  const activeColor = getCurrentColor(device, selectedColorSku);

  const ancModes = (
    [
      { id: 'anc', icon: ShieldAlert, label: t('anc.modes.anc') },
      { id: 'transparency', icon: Ear, label: t('anc.modes.transparency') },
      { id: 'off', icon: PowerOff, label: t('anc.modes.off') },
    ] as { id: AncMode; icon: typeof ShieldAlert; label: string }[]
  ).filter(
    (m) =>
      m.id === 'off' ||
      (m.id === 'anc' && caps.anc) ||
      (m.id === 'transparency' && caps.transparency),
  );
  const showNoiseControl = caps.anc || caps.transparency;

  const levelOptions: { value: AncLevel; label: string }[] = caps.ancLevels.map((level) => ({
    value: level,
    label: t(`anc.levels.${level}`),
  }));

  const eqOptions = eqPickerOptions(caps);
  const eqValue = eqPickerValue(caps, eqPreset, diracMode);
  const onEqChange = (v: string) => {
    const value = v as EqPickerValue;
    if (value.startsWith('d:')) {
      // setDiracMode also switches eqPreset to 'diracOpteo'.
      setDiracMode(value.slice(2) as DiracMode);
    } else {
      setEqPreset(value.slice(2) as EqPreset);
    }
  };

  const findTargets = caps.findTargets;
  const findLabel = (target: FindTarget) =>
    ringing[target]
      ? t('settings.stopRinging')
      : target === 'left'
        ? t('settings.ringLeft')
        : target === 'right'
          ? t('settings.ringRight')
          : t('settings.ringDevice');

  const handleHideToTray = async () => {
    await hideToSystemTray();
    toast.info(t('tray.hiddenToast'));
  };

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center overflow-hidden bg-background/95 p-2 backdrop-blur-xl select-none sm:p-4">
      {/* Compact Taskbar Flyout Card */}
      <div className="flex h-full max-h-[600px] w-full max-w-[380px] flex-col overflow-hidden rounded-2xl border border-border/80 bg-card/90 shadow-2xl">
        {/* Mini Flyout Top Bar */}
        <div
          data-tauri-drag-region
          className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border/60 bg-background/70 px-3.5"
        >
          <div data-tauri-drag-region className="flex h-full min-w-0 flex-1 items-center gap-2">
            <div
              data-tauri-drag-region
              className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary"
            >
              <NothingMark className="pointer-events-none size-3.5" />
            </div>
            <span data-tauri-drag-region className="truncate font-semibold text-xs">
              {displayName}
            </span>
            {connectionMode === 'connected' && (
              <BluetoothConnected className="pointer-events-none size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            )}
          </div>

          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-7"
                  onClick={handleHideToTray}
                  aria-label={t('window.hideToTray')}
                >
                  <EyeOff className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{t('window.hideToTray')}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-7"
                  onClick={() => setViewMode('full')}
                  aria-label={t('window.fullMode')}
                >
                  <Maximize2 className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{t('window.fullMode')}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Scrollable Flyout Body */}
        <div className="flex-1 space-y-3.5 overflow-y-auto p-3.5">
          {/* Real Device Image + Battery Status */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/25 p-3">
            <div className="flex h-20 w-24 shrink-0 items-center justify-center rounded-lg bg-background/60 p-1.5">
              <img
                src={activeColor.heroImage}
                alt={device.name}
                className="max-h-full max-w-full object-contain drop-shadow-md"
              />
            </div>

            {caps.batteryLayout === 'single' ? (
              <div className="flex-1 rounded-lg border border-border/50 bg-background/70 px-3 py-2.5">
                <div className="font-mono text-[10px] font-bold text-muted-foreground uppercase">
                  {activeColor.colorName} • {device.modelId}
                </div>
                <div className="mt-0.5 flex items-baseline gap-2">
                  <span className="font-bold text-2xl tabular-nums">
                    {battery.left}%
                  </span>
                  <span className="text-emerald-600 text-xs dark:text-emerald-400">
                    {t('tray.liveBattery')}
                  </span>
                </div>
              </div>
            ) : (
              <div className="grid flex-1 grid-cols-3 gap-1.5 text-center">
                <div className="rounded-lg border border-border/50 bg-background/70 px-1 py-2">
                  <div className="font-bold text-[10px] text-muted-foreground">
                    {t('common.leftShort')}
                  </div>
                  <div className="mt-0.5 font-bold text-sm tabular-nums">
                    {battery.left}%
                  </div>
                </div>
                <div className="rounded-lg border border-border/50 bg-background/70 px-1 py-2">
                  <div className="font-bold text-[10px] text-primary">{t('common.rightShort')}</div>
                  <div className="mt-0.5 font-bold text-sm tabular-nums">
                    {battery.right}%
                  </div>
                </div>
                <div className="rounded-lg border border-border/50 bg-background/70 px-1 py-2">
                  <div className="flex items-center justify-center gap-0.5 font-bold text-[10px] text-muted-foreground">
                    {t('common.caseShort')}
                    {battery.caseCharging && (
                      <BatteryCharging className="size-2.5 text-emerald-600 dark:text-emerald-400" />
                    )}
                  </div>
                  <div className="mt-0.5 font-bold text-sm tabular-nums">
                    {battery.caseLevel}%
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Noise Control */}
          {showNoiseControl && (
            <div className="space-y-2.5 rounded-xl border border-border/60 bg-muted/15 p-3">
              <div className="font-semibold text-muted-foreground text-xs tracking-wider uppercase">
                {t('anc.title')}
              </div>
              <div className={`grid gap-1.5 ${ancModes.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                {ancModes.map((m) => {
                  const Icon = m.icon;
                  const active = ancMode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setAncMode(m.id)}
                      aria-pressed={active}
                      className={`flex flex-col items-center gap-1.5 rounded-lg border p-2.5 text-center transition-all ${
                        active
                          ? 'border-primary bg-primary/15 font-semibold text-primary'
                          : 'border-border/60 bg-background/50 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Icon className="size-4" />
                      <span className="line-clamp-1 text-[11px] leading-tight">
                        {m.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {ancMode === 'anc' && caps.anc && levelOptions.length > 0 && (
                <div className="flex justify-center pt-1">
                  <Segmented
                    value={ancLevel}
                    onChange={setAncLevel}
                    options={levelOptions}
                  />
                </div>
              )}
            </div>
          )}

          {/* Quick Equalizer Preset */}
          {eqOptions.length > 0 && (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/15 p-3">
              <span className="font-medium text-xs">{t('equalizer.presetTitle')}</span>
              <Select value={eqValue} onValueChange={onEqChange}>
                <SelectTrigger
                  size="sm"
                  className="w-[175px]"
                  aria-label={t('equalizer.presetTitle')}
                >
                  <SelectValue placeholder={t(`equalizer.presets.${eqPreset}`)} />
                </SelectTrigger>
                <SelectContent>
                  {eqOptions.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {eqPickerLabel(t, opt)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Quick Toggles: Ultra Bass & Low Lag Game Mode */}
          {(caps.ultraBass || caps.lowLatency) && (
            <div
              className={`grid gap-2 ${caps.ultraBass && caps.lowLatency ? 'grid-cols-2' : 'grid-cols-1'}`}
            >
              {caps.ultraBass && (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/15 p-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <Waves className="size-3.5 shrink-0 text-primary" />
                    <span className="truncate font-medium text-xs">
                      {t('equalizer.ultraBassShort')}
                    </span>
                  </div>
                  <Switch
                    checked={ultraBassEnabled}
                    onCheckedChange={(checked) => setUltraBass(checked)}
                    aria-label={t('equalizer.ultraBassShort')}
                  />
                </div>
              )}

              {caps.lowLatency && (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/15 p-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <Gamepad2 className="size-3.5 shrink-0 text-primary" />
                    <span className="truncate font-medium text-xs">
                      {t('settings.lowLatency')}
                    </span>
                  </div>
                  <Switch
                    checked={lowLatencyMode}
                    onCheckedChange={setLowLatencyMode}
                    aria-label={t('settings.lowLatency')}
                  />
                </div>
              )}
            </div>
          )}

          {/* Quick Find My Earbuds */}
          {findTargets.length > 0 && (
            <div
              className={`grid gap-2 pt-0.5 ${findTargets.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}
            >
              {findTargets.map((target) => (
                <Button
                  key={target}
                  size="sm"
                  variant={ringing[target] ? 'destructive' : 'outline'}
                  className="gap-1.5 text-xs"
                  aria-pressed={ringing[target]}
                  onClick={() => toggleFind(target)}
                >
                  <Volume2 className="size-3.5" />
                  {findLabel(target)}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
