import { useTranslation } from 'react-i18next';
import { Ear, Gamepad2, Sparkles, Info } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useDeviceStore, useCapabilities } from '@/lib/deviceStore';

export function AudioFeaturesCard() {
  const { t } = useTranslation();
  const caps = useCapabilities();
  const inEarDetection = useDeviceStore((s) => s.inEarDetection);
  const lowLatencyMode = useDeviceStore((s) => s.lowLatencyMode);
  const highResCodec = useDeviceStore((s) => s.highResCodec);
  const setInEarDetection = useDeviceStore((s) => s.setInEarDetection);
  const setLowLatencyMode = useDeviceStore((s) => s.setLowLatencyMode);
  const setHighResCodec = useDeviceStore((s) => s.setHighResCodec);

  const codecs = caps.highResCodecs.map((c) => c.toUpperCase()).join(' / ');

  const items = [
    {
      id: 'inEar',
      icon: Ear,
      title: t('settings.inEarDetection'),
      desc: t('settings.inEarDetectionDesc'),
      checked: inEarDetection,
      onChange: setInEarDetection,
      note: '',
      visible: caps.inEarDetection,
    },
    {
      id: 'lowLag',
      icon: Gamepad2,
      title: t('settings.lowLatency'),
      desc: t('settings.lowLatencyDesc'),
      checked: lowLatencyMode,
      onChange: setLowLatencyMode,
      note: '',
      visible: caps.lowLatency,
    },
    {
      id: 'hiRes',
      icon: Sparkles,
      title: codecs ? `${t('settings.highResAudio')} (${codecs})` : t('settings.highResAudio'),
      desc: t('settings.highResAudioDesc'),
      checked: highResCodec,
      onChange: setHighResCodec,
      note: t('settings.highResWindowsNote'),
      visible: caps.highResCodecs.length > 0,
    },
  ].filter((i) => i.visible);

  if (items.length === 0) return null;

  return (
    <div className={`grid grid-cols-1 gap-4 ${items.length >= 3 ? 'md:grid-cols-3' : items.length === 2 ? 'md:grid-cols-2' : ''}`}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.id}>
            <CardContent className="p-5 flex flex-col justify-between gap-4 h-full">
              <div className="flex items-center justify-between">
                <div className="size-9 rounded-lg bg-primary/12 text-primary flex items-center justify-center">
                  <Icon className="size-4" />
                </div>
                <Switch checked={item.checked} onCheckedChange={item.onChange} aria-label={item.title} />
              </div>
              <div>
                <div className="text-sm font-semibold">{item.title}</div>
                <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {item.desc}
                </div>
                {item.note && (
                  <p className="mt-2 flex items-start gap-1.5 text-[11px] text-muted-foreground/90 leading-relaxed">
                    <Info className="mt-0.5 size-3 shrink-0" />
                    {item.note}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
