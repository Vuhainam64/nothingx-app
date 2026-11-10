import { useTranslation } from 'react-i18next';
import { Volume2, Square } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDeviceStore, useCapabilities, getCurrentDevice } from '@/lib/deviceStore';
import type { FindTarget } from '@/lib/deviceCapabilities';

export function FindMyEarbudsCard() {
  const { t } = useTranslation();
  const caps = useCapabilities();
  const selectedModelId = useDeviceStore((s) => s.selectedModelId);
  const ringing = useDeviceStore((s) => s.ringing);
  const toggleFind = useDeviceStore((s) => s.toggleFind);

  const device = getCurrentDevice(selectedModelId);
  const targets = caps.findTargets;
  if (targets.length === 0) return null;

  const isRinging = targets.some((target) => ringing[target]);
  const single = targets.length === 1;

  const label = (target: FindTarget) =>
    target === 'left'
      ? t('settings.ringLeft')
      : target === 'right'
        ? t('settings.ringRight')
        : t('settings.ringDevice');

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>{t('settings.findEarbuds')}</CardTitle>
          <CardDescription className="mt-1">
            {caps.batteryLayout === 'single'
              ? t('settings.findDeviceDesc')
              : t('settings.findEarbudsDesc')}
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
            className={`max-h-full max-w-full object-contain invert dark:invert-0 ${
              isRinging ? 'animate-pulse' : ''
            }`}
          />
        </div>
      </CardHeader>

      <CardContent className={`grid grid-cols-1 gap-3 ${single ? '' : 'sm:grid-cols-2'}`}>
        {targets.map((target) => {
          const active = ringing[target];
          return (
            <Button
              key={target}
              variant={active ? 'destructive' : 'outline'}
              onClick={() => toggleFind(target)}
              aria-pressed={active}
              className="h-11 justify-between px-4"
            >
              <span className="flex items-center gap-2">
                {target !== 'body' && (
                  <span
                    className={`rounded px-1.5 py-0.5 font-bold text-xs ${
                      target === 'left' ? 'bg-muted text-foreground' : 'bg-primary/15 text-primary'
                    }`}
                  >
                    {target === 'left' ? t('common.leftShort') : t('common.rightShort')}
                  </span>
                )}
                {active ? t('settings.stopRinging') : label(target)}
              </span>
              {active ? <Square className="size-4" /> : <Volume2 className="size-4" />}
            </Button>
          );
        })}
      </CardContent>
    </Card>
  );
}
