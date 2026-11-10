import { useTranslation } from 'react-i18next';
import { Waves, Orbit } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDeviceStore, getCurrentDevice } from '@/lib/deviceStore';
import type { SpatialAudioMode } from '@/lib/deviceStore';

export function SoundEnhanceCard() {
  const { t } = useTranslation();
  const selectedModelId = useDeviceStore((s) => s.selectedModelId);
  const ultraBassEnabled = useDeviceStore((s) => s.ultraBassEnabled);
  const ultraBassLevel = useDeviceStore((s) => s.ultraBassLevel);
  const spatialAudio = useDeviceStore((s) => s.spatialAudio);
  const setUltraBass = useDeviceStore((s) => s.setUltraBass);
  const setSpatialAudio = useDeviceStore((s) => s.setSpatialAudio);

  const device = getCurrentDevice(selectedModelId);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {device.supportsUltraBass && (
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
                    {ultraBassLevel} / 5
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={5}
                  step={1}
                  value={ultraBassLevel}
                  onChange={(e) => setUltraBass(true, Number(e.target.value))}
                  className="w-full accent-primary cursor-pointer"
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {device.supportsSpatialAudio && (
        <Card>
          <CardContent className="p-5 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="size-9 rounded-lg bg-primary/12 text-primary flex items-center justify-center shrink-0 mt-0.5">
                <Orbit className="size-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">{t('equalizer.spatialAudio')}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {t('equalizer.spatialAudioDesc')}
                </div>
              </div>
            </div>

            <Select
              value={spatialAudio}
              onValueChange={(val) => setSpatialAudio(val as SpatialAudioMode)}
            >
              <SelectTrigger size="sm" className="w-[150px] shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="off">{t('equalizer.spatialOff')}</SelectItem>
                <SelectItem value="fixed">{t('equalizer.spatialFixed')}</SelectItem>
                <SelectItem value="headTracking">{t('equalizer.spatialTracking')}</SelectItem>
                <SelectItem value="concert">{t('equalizer.spatialConcert')}</SelectItem>
                <SelectItem value="cinema">{t('equalizer.spatialCinema')}</SelectItem>
                <SelectItem value="game">{t('equalizer.spatialGame')}</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
