import { useTranslation } from 'react-i18next';
import { Volume2, Square } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDeviceStore, getCurrentDevice } from '@/lib/deviceStore';

export function FindMyEarbudsCard() {
  const { t } = useTranslation();
  const selectedModelId = useDeviceStore((s) => s.selectedModelId);
  const ringingLeft = useDeviceStore((s) => s.ringingLeft);
  const ringingRight = useDeviceStore((s) => s.ringingRight);
  const toggleFindMyEarbud = useDeviceStore((s) => s.toggleFindMyEarbud);

  const device = getCurrentDevice(selectedModelId);
  const isRinging = ringingLeft || ringingRight;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>{t('settings.findEarbuds')}</CardTitle>
          <CardDescription className="mt-1">
            {t('settings.findEarbudsDesc')}
          </CardDescription>
        </div>

        <div className="flex size-14 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-secondary/20 p-1.5">
          <img
            src={
              isRinging
                ? '/assets/icons/ear/ear_device_find_playing.png'
                : '/assets/icons/ear/ear_device_find_start.png'
            }
            alt={device.name}
            className={`max-h-full max-w-full object-contain ${
              isRinging ? 'animate-pulse' : ''
            }`}
          />
        </div>
      </CardHeader>

      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Button
          variant={ringingLeft ? 'destructive' : 'outline'}
          onClick={() => toggleFindMyEarbud('left')}
          className="h-11 justify-between px-4"
        >
          <span className="flex items-center gap-2">
            <span className="rounded bg-muted px-1.5 py-0.5 font-bold text-foreground text-xs">
              L
            </span>
            {ringingLeft ? t('settings.stopRinging') : t('settings.ringLeft')}
          </span>
          {ringingLeft ? (
            <Square className="size-4" />
          ) : (
            <Volume2 className="size-4" />
          )}
        </Button>

        <Button
          variant={ringingRight ? 'destructive' : 'outline'}
          onClick={() => toggleFindMyEarbud('right')}
          className="h-11 justify-between px-4"
        >
          <span className="flex items-center gap-2">
            <span className="rounded bg-primary/15 px-1.5 py-0.5 font-bold text-primary text-xs">
              R
            </span>
            {ringingRight ? t('settings.stopRinging') : t('settings.ringRight')}
          </span>
          {ringingRight ? (
            <Square className="size-4" />
          ) : (
            <Volume2 className="size-4" />
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
