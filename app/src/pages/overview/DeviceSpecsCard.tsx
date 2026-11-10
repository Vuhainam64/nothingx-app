import { useTranslation } from 'react-i18next';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDeviceStore, getCurrentDevice } from '@/lib/deviceStore';

export function DeviceSpecsCard() {
  const { t } = useTranslation();
  const selectedModelId = useDeviceStore((s) => s.selectedModelId);
  const firmwareVersion = useDeviceStore((s) => s.firmwareVersion);
  const device = getCurrentDevice(selectedModelId);

  const capabilities = [
    { enabled: true, label: t('anc.modes.anc') },
    { enabled: device.supportsPersonalAnc, label: t('anc.personalAnc') },
    { enabled: device.supportsParametricEq, label: t('equalizer.presets.advanced') },
    { enabled: device.supportsUltraBass, label: t('equalizer.ultraBass') },
    { enabled: device.supportsSpatialAudio, label: t('equalizer.spatialAudio') },
    { enabled: device.supportsDualConnection, label: t('settings.dualConnection') },
    { enabled: device.supportsSmartDial, label: t('controls.smartDial') },
    { enabled: Boolean(device.highResCodec), label: t('settings.highResAudio') },
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
              <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
              <span>{cap.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
