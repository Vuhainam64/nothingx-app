import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDeviceStore, getCurrentDevice, type GestureAction } from '@/lib/deviceStore';
import { DIAL_PRESS_ALLOWED, smartDialWritable } from '@/lib/nothingCommands';

const DIAL_ACTIONS: GestureAction[] = DIAL_PRESS_ALLOWED;

export function SmartDialCard() {
  const { t } = useTranslation();
  const selectedModelId = useDeviceStore((s) => s.selectedModelId);
  const smartDialEnabled = useDeviceStore((s) => s.smartDialEnabled);
  const smartDialPress = useDeviceStore((s) => s.smartDialPress);
  const setSmartDialEnabled = useDeviceStore((s) => s.setSmartDialEnabled);
  const setSmartDialPress = useDeviceStore((s) => s.setSmartDialPress);

  const device = getCurrentDevice(selectedModelId);
  if (!device.supportsSmartDial) return null;

  const isHeadphone = device.formFactor === 'headphone';
  const writable = smartDialWritable(device);

  if (!writable) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-start gap-3.5">
          <div className="mt-0.5 flex size-12 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-secondary/30 p-1.5">
            <img
              src={
                isHeadphone
                  ? '/assets/icons/ear/control/roll_iv.svg'
                  : '/assets/icons/bsv-smart-dial_dark.svg'
              }
              alt="Smart Dial"
              className="max-h-full max-w-full object-contain"
            />
          </div>
          <div>
            <CardTitle>{t('controls.smartDial')}</CardTitle>
            <CardDescription className="mt-1">{t('controls.dialFixed')}</CardDescription>
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="mt-0.5 flex size-12 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-secondary/30 p-1.5">
            <img
              src={
                isHeadphone
                  ? '/assets/icons/ear/control/roll_iv.svg'
                  : '/assets/icons/bsv-smart-dial_dark.svg'
              }
              alt="Smart Dial"
              className="max-h-full max-w-full object-contain"
            />
          </div>
          <div>
            <CardTitle>{t('controls.smartDial')}</CardTitle>
            <CardDescription className="mt-1">
              {t('controls.smartDialDesc')}
            </CardDescription>
          </div>
        </div>
        <Switch checked={smartDialEnabled} onCheckedChange={setSmartDialEnabled} />
      </CardHeader>

      {smartDialEnabled && (
        <CardContent className="grid grid-cols-1 gap-3 pt-0 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 p-3.5">
            <div className="flex items-center gap-2.5">
              <img
                src="/assets/icons/ear/control/control_ic_rotate.svg"
                alt="Rotate"
                className="size-5 object-contain opacity-90 invert dark:invert-0"
              />
              <span className="font-medium text-sm">{t('controls.dialRotate')}</span>
            </div>
            <span className="text-muted-foreground text-xs">
              {t('controls.actions.volumeUp')} / {t('controls.actions.volumeDown')}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 p-3.5">
            <div className="flex items-center gap-2.5">
              <img
                src="/assets/icons/ear/control/headphone_single_press.svg"
                alt="Press"
                className="size-5 object-contain opacity-90 invert dark:invert-0"
              />
              <span className="font-medium text-sm">
                {t('controls.dialSinglePress')}
              </span>
            </div>
            <Select
              value={smartDialPress}
              onValueChange={(val) => setSmartDialPress(val as GestureAction)}
            >
              <SelectTrigger size="sm" className="w-[175px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIAL_ACTIONS.map((act) => (
                  <SelectItem key={act} value={act}>
                    {t(`controls.actions.${act}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
