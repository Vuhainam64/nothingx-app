import { useTranslation } from 'react-i18next';
import { Ear, Gamepad2, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useDeviceStore, getCurrentDevice } from '@/lib/deviceStore';

export function AudioFeaturesCard() {
  const { t } = useTranslation();
  const selectedModelId = useDeviceStore((s) => s.selectedModelId);
  const inEarDetection = useDeviceStore((s) => s.inEarDetection);
  const lowLatencyMode = useDeviceStore((s) => s.lowLatencyMode);
  const highResCodec = useDeviceStore((s) => s.highResCodec);
  const setInEarDetection = useDeviceStore((s) => s.setInEarDetection);
  const setLowLatencyMode = useDeviceStore((s) => s.setLowLatencyMode);
  const setHighResCodec = useDeviceStore((s) => s.setHighResCodec);

  const device = getCurrentDevice(selectedModelId);

  const items = [
    {
      id: 'inEar',
      icon: Ear,
      title: t('settings.inEarDetection'),
      desc: t('settings.inEarDetectionDesc'),
      checked: inEarDetection,
      onChange: setInEarDetection,
      visible: true,
    },
    {
      id: 'lowLag',
      icon: Gamepad2,
      title: t('settings.lowLatency'),
      desc: t('settings.lowLatencyDesc'),
      checked: lowLatencyMode,
      onChange: setLowLatencyMode,
      visible: true,
    },
    {
      id: 'hiRes',
      icon: Sparkles,
      title: `${t('settings.highResAudio')}${device.highResCodec ? ` (${device.highResCodec})` : ''}`,
      desc: t('settings.highResAudioDesc'),
      checked: highResCodec,
      onChange: setHighResCodec,
      visible: Boolean(device.highResCodec),
    },
  ].filter((i) => i.visible);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.id}>
            <CardContent className="p-5 flex flex-col justify-between gap-4 h-full">
              <div className="flex items-center justify-between">
                <div className="size-9 rounded-lg bg-primary/12 text-primary flex items-center justify-center">
                  <Icon className="size-4" />
                </div>
                <Switch checked={item.checked} onCheckedChange={item.onChange} />
              </div>
              <div>
                <div className="text-sm font-semibold">{item.title}</div>
                <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {item.desc}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
