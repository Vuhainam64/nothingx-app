import { useTranslation } from 'react-i18next';
import { Waves, Orbit, Info } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDeviceStore, useCapabilities } from '@/lib/deviceStore';
import type { SpatialAudioMode } from '@/lib/deviceStore';

const SPATIAL_LABEL: Record<SpatialAudioMode, string> = {
  off: 'equalizer.spatialOff',
  fixed: 'equalizer.spatialFixed',
  headTracking: 'equalizer.spatialTracking',
  concert: 'equalizer.spatialConcert',
  cinema: 'equalizer.spatialCinema',
  game: 'equalizer.spatialGame',
};

export function SoundEnhanceCard() {
  const { t } = useTranslation();
  const caps = useCapabilities();
  const ultraBassEnabled = useDeviceStore((s) => s.ultraBassEnabled);
  const ultraBassLevel = useDeviceStore((s) => s.ultraBassLevel);
  const spatialAudio = useDeviceStore((s) => s.spatialAudio);
  const setUltraBass = useDeviceStore((s) => s.setUltraBass);
  const setSpatialAudio = useDeviceStore((s) => s.setSpatialAudio);

  const ultraBass = caps.ultraBass;
  const maxLevel = ultraBass?.maxLevel ?? 5;
  const spatialOptions: SpatialAudioMode[] = ['off', ...caps.spatialModes];

  if (!ultraBass && caps.spatialModes.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {ultraBass && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="size-9 rounded-lg bg-primary/12 text-primary flex items-center justify-center shrink-0 mt-0.5">
                  <Waves className="size-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold">{t('equalizer.ultraBass')}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {t('equalizer.ultraBassDesc')}
                  </div>
                </div>
              </div>
              <Switch
                checked={ultraBassEnabled}
                onCheckedChange={(checked) => setUltraBass(checked, ultraBassLevel)}
              />
            </div>

            {ultraBassEnabled && (
              <div className="pt-2 border-t border-border/60 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{t('equalizer.level')}</span>
                  <span className="font-mono font-semibold text-primary">
                    {Math.min(ultraBassLevel, maxLevel)} / {maxLevel}
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={maxLevel}
                  step={1}
                  value={Math.min(ultraBassLevel, maxLevel)}
                  onChange={(e) => setUltraBass(true, Number(e.target.value))}
                  className="w-full accent-primary cursor-pointer"
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {caps.spatialModes.length > 0 && (
        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <div className="size-9 rounded-lg bg-primary/12 text-primary flex items-center justify-center shrink-0 mt-0.5">
                  <Orbit className="size-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{t('equalizer.spatialAudio')}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {t('equalizer.spatialAudioDesc')}
                  </div>
                </div>
              </div>

              <Select
                value={spatialOptions.includes(spatialAudio) ? spatialAudio : 'off'}
                onValueChange={(val) => setSpatialAudio(val as SpatialAudioMode)}
              >
                <SelectTrigger size="sm" className="w-auto min-w-[130px] shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {spatialOptions.map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {t(SPATIAL_LABEL[mode])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!caps.spatialOnDevice && (
              <p className="flex items-start gap-1.5 border-t border-border/60 pt-3 text-muted-foreground text-xs leading-relaxed">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                {t('equalizer.spatialHostNote')}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
