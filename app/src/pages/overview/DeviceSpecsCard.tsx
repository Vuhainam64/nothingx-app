import { useTranslation } from 'react-i18next';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDeviceStore, useCapabilities } from '@/lib/deviceStore';

export function DeviceSpecsCard() {
  const { t } = useTranslation();
  const firmwareVersion = useDeviceStore((s) => s.firmwareVersion);
  const caps = useCapabilities();

  const capabilities = [
    { enabled: caps.anc, label: t('anc.modes.anc') },
    { enabled: caps.transparency, label: t('anc.modes.transparency') },
    { enabled: caps.personalAnc, label: t('anc.personalAnc') },
    { enabled: caps.earTipFitTest, label: t('anc.earFitTitle') },
    { enabled: caps.advancedEq, label: t('equalizer.presets.advanced') },
    { enabled: caps.dirac !== null, label: t('equalizer.diracTitle') },
    { enabled: caps.ultraBass !== null, label: t('equalizer.ultraBass') },
    { enabled: caps.spatialModes.length > 0, label: t('equalizer.spatialAudio') },
    { enabled: caps.inEarDetection, label: t('settings.inEarDetection') },
    { enabled: caps.lowLatency, label: t('settings.lowLatency') },
    { enabled: caps.dualConnection, label: t('settings.dualConnection') },
    { enabled: caps.smartDial, label: t('controls.smartDial') },
    {
      enabled: caps.highResCodecs.length > 0,
      label: `${t('settings.highResAudio')} (${caps.highResCodecs.map((c) => c.toUpperCase()).join(' / ')})`,
    },
  ].filter((c) => c.enabled);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            {t('overview.capabilities')}
          </CardTitle>
          <Badge variant="outline" className="text-xs font-mono">
            {t('overview.firmware')}: {firmwareVersion ? `v${firmwareVersion}` : '—'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {capabilities.map((cap) => (
            <div
              key={cap.label}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/70 bg-muted/25 text-xs font-medium"
            >
              <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{cap.label}</span>
            </div>
          ))}
          {capabilities.length === 0 && (
            <span className="text-muted-foreground text-xs">{t('overview.noCapabilities')}</span>
          )}
        </div>
        {!caps.known && (
          <p className="mt-3 text-muted-foreground text-xs leading-relaxed">
            {t('overview.unknownModelNote', { model: caps.modelId })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
