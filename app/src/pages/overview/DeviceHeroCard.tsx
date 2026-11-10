import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ChevronRight,
  BluetoothConnected,
  Settings2,
  Cpu,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  useDeviceStore,
  useCapabilities,
  getCurrentDevice,
  getCurrentColor,
} from '@/lib/deviceStore';
import { eqPickerLabel, eqPickerValue } from '@/components/device/capabilityUi';

export function DeviceHeroCard() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const selectedModelId = useDeviceStore((s) => s.selectedModelId);
  const selectedColorSku = useDeviceStore((s) => s.selectedColorSku);
  const selectColor = useDeviceStore((s) => s.selectColor);
  const ancMode = useDeviceStore((s) => s.ancMode);
  const ancLevel = useDeviceStore((s) => s.ancLevel);
  const eqPreset = useDeviceStore((s) => s.eqPreset);
  const diracMode = useDeviceStore((s) => s.diracMode);
  const caps = useCapabilities();
  const highResCodec = useDeviceStore((s) => s.highResCodec);
  const connectionMode = useDeviceStore((s) => s.connectionMode);
  const activeMacAddress = useDeviceStore((s) => s.activeMacAddress);
  const firmwareVersion = useDeviceStore((s) => s.firmwareVersion);
  const serialNumber = useDeviceStore((s) => s.serialNumber);
  const setSetupModalOpen = useDeviceStore((s) => s.setSetupModalOpen);

  const device = getCurrentDevice(selectedModelId);
  const activeColor = getCurrentColor(device, selectedColorSku);

  const ancSummary =
    ancMode === 'anc'
      ? `${t('anc.modes.anc')} • ${t(`anc.levels.${ancLevel}`)}`
      : t(`anc.modes.${ancMode}`);

  const eqValue = eqPickerValue(caps, eqPreset, diracMode);
  const eqSummary = eqValue ? eqPickerLabel(t, eqValue) : t(`equalizer.presets.${eqPreset}`);
  const codecs = caps.highResCodecs.map((c) => c.toUpperCase()).join(' / ');
  const hasNoiseControl = caps.anc || caps.transparency;

  const ancIconSrc =
    ancMode === 'anc'
      ? '/assets/icons/ear/card_anc_on.svg'
      : ancMode === 'transparency'
        ? '/assets/icons/ear/card_anc_transparency.svg'
        : '/assets/icons/ear/card_anc_off.svg';

  return (
    <Card className="overflow-hidden border-border/80">
      <CardContent className="p-6">
        <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
          {/* Official Studio Product Visual & Colorway Switcher */}
          <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-b from-secondary/40 via-muted/20 to-background p-5 lg:col-span-5">
            <div className="dot-matrix-bg pointer-events-none absolute inset-0 opacity-20" />

            <Badge variant="outline" className="absolute top-3.5 left-3.5 z-10 text-[11px]">
              {device.brand}
            </Badge>
            {highResCodec && codecs && (
              <Badge
                variant="secondary"
                className="absolute top-3.5 right-3.5 z-10 font-mono text-[11px]"
              >
                {codecs}
              </Badge>
            )}

            {/* Real Product Image Showcase */}
            <div className="relative z-10 my-3 flex h-56 w-full items-center justify-center">
              <div
                className="pointer-events-none absolute size-44 rounded-full blur-3xl opacity-25 transition-colors duration-500"
                style={{ backgroundColor: activeColor.hex }}
              />
              {device.formFactor === 'tws' ? (
                <div className="relative flex h-full w-full items-center justify-center gap-2 px-2">
                  <img
                    src={activeColor.leftImage}
                    alt={t('overview.imageAlt.left', { name: device.name })}
                    className="h-36 w-auto object-contain drop-shadow-[0_14px_24px_rgba(0,0,0,0.65)] transition-transform duration-300 hover:-translate-y-1"
                  />
                  <img
                    src={activeColor.caseImage}
                    alt={t('overview.imageAlt.case', { name: device.name })}
                    className="h-44 w-auto object-contain drop-shadow-[0_18px_32px_rgba(0,0,0,0.75)] transition-transform duration-300 hover:scale-105"
                  />
                  <img
                    src={activeColor.rightImage}
                    alt={t('overview.imageAlt.right', { name: device.name })}
                    className="h-36 w-auto object-contain drop-shadow-[0_14px_24px_rgba(0,0,0,0.65)] transition-transform duration-300 hover:-translate-y-1"
                  />
                </div>
              ) : (
                <img
                  src={activeColor.heroImage}
                  alt={device.name}
                  className="max-h-52 w-auto object-contain drop-shadow-[0_20px_36px_rgba(0,0,0,0.75)] transition-transform duration-300 hover:scale-105"
                />
              )}
            </div>

            {/* Colorway Selector */}
            <div className="relative z-10 mt-2 flex flex-wrap items-center justify-center gap-2">
              {device.colors.map((c) => {
                const isSelected = c.sku === activeColor.sku;
                return (
                  <Tooltip key={c.sku}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => selectColor(c.sku)}
                        aria-pressed={isSelected}
                        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-all ${
                          isSelected
                            ? 'border-primary/60 bg-accent font-medium text-foreground shadow-xs'
                            : 'border-border/60 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <span
                          className="size-2.5 rounded-full border border-foreground/30"
                          style={{ backgroundColor: c.hex }}
                        />
                        {c.colorName}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">{c.colorName}</TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>

          {/* Device Identity, Telemetry & Quick Actions */}
          <div className="space-y-4 lg:col-span-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-mono text-xs font-medium tracking-wider text-muted-foreground uppercase">
                  {device.releaseYear} • {activeColor.colorName} • {device.modelId}
                </div>
                <h2 className="mt-0.5 font-display text-2xl font-bold tracking-tight">
                  {device.name}
                </h2>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => setSetupModalOpen(true)}
              >
                <Settings2 className="size-3.5 text-primary" />
                {t('overview.setupSwitchDevice')}
              </Button>
            </div>

            {/* Hardware Connection Info Strip */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-secondary/25 px-3.5 py-2.5 font-mono text-xs">
              <div className="flex items-center gap-2">
                <BluetoothConnected
                  className={
                    connectionMode === 'connected'
                      ? 'size-4 text-emerald-600 dark:text-emerald-400'
                      : 'size-4 text-amber-600 dark:text-amber-400'
                  }
                />
                <span className="text-foreground">
                  {connectionMode === 'connected'
                    ? t('overview.detectedDirect', { mac: activeMacAddress ?? '—' })
                    : t('overview.previewNotConnected')}
                </span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Cpu className="size-3.5" /> {t('overview.fwShort')} {firmwareVersion ? `v${firmwareVersion}` : '—'}
                </span>
                {serialNumber && (
                  <span className="hidden sm:inline">
                    {t('overview.snShort')} {serialNumber}
                  </span>
                )}
              </div>
            </div>

            <div className={`grid grid-cols-1 gap-3 ${hasNoiseControl ? 'sm:grid-cols-2' : ''}`}>
              {hasNoiseControl && (
                <button
                  type="button"
                  onClick={() => navigate('/anc')}
                  className="group flex items-center justify-between rounded-xl border border-border bg-card/60 p-4 text-left transition-all hover:border-primary/40 hover:bg-accent/40"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/12 p-2 text-primary">
                      <img
                        src={ancIconSrc}
                        alt=""
                        className="size-6 object-contain invert dark:invert-0"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="text-muted-foreground text-xs">
                        {t('overview.quickAnc')}
                      </div>
                      <div className="mt-0.5 truncate font-semibold text-sm">
                        {ancSummary}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </button>
              )}

              <button
                type="button"
                onClick={() => navigate('/equalizer')}
                className="group flex items-center justify-between rounded-xl border border-border bg-card/60 p-4 text-left transition-all hover:border-primary/40 hover:bg-accent/40"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/12 p-2 text-primary">
                    <img
                      src="/assets/icons/ear/card_equaliser.svg"
                      alt=""
                      className="size-6 object-contain invert dark:invert-0"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-muted-foreground text-xs">
                      {t('overview.quickEq')}
                    </div>
                    <div className="mt-0.5 truncate font-semibold text-sm">
                      {eqSummary}
                    </div>
                  </div>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 p-3.5 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <img
                  src="/assets/icons/ear/ear_high_quality_audio.svg"
                  alt=""
                  className="size-4 object-contain opacity-85 dark:invert"
                />
                <span>{t('overview.audioQuality')}:</span>
              </div>
              <span className="font-medium text-foreground">
                {codecs
                  ? t('overview.hiResQuality', { codecs })
                  : t('overview.standardQuality')}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
