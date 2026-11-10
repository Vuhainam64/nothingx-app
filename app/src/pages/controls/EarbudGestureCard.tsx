import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useDeviceStore,
  getCurrentDevice,
  getCurrentColor,
  type GestureAction,
  type GestureSideState,
} from '@/lib/deviceStore';
import { PINCH_ALLOWED_ACTIONS } from '@/lib/nothingCommands';

const GESTURE_KEYS: (keyof GestureSideState)[] = [
  'doublePinch',
  'triplePinch',
  'pinchHold',
  'doublePinchHold',
];

const GESTURE_ICON_MAP: Record<keyof GestureSideState, string> = {
  doublePinch: '/assets/icons/ear/control/control_ic_index_two.svg',
  triplePinch: '/assets/icons/ear/control/control_ic_index_three.svg',
  pinchHold: '/assets/icons/ear/control/control_ic_index_tap_hold.svg',
  doublePinchHold: '/assets/icons/ear/control/control_ic_index_double_tap_hold.svg',
};

const ACTION_OPTIONS: GestureAction[] = [
  'playPause',
  'nextTrack',
  'prevTrack',
  'noiseControl',
  'voiceAssistant',
  'volumeUp',
  'volumeDown',
  'noAction',
];

export function EarbudGestureCard({ side }: { side: 'left' | 'right' }) {
  const { t } = useTranslation();
  const selectedModelId = useDeviceStore((s) => s.selectedModelId);
  const selectedColorSku = useDeviceStore((s) => s.selectedColorSku);
  const gestures = useDeviceStore((s) =>
    side === 'left' ? s.leftGestures : s.rightGestures,
  );
  const setGesture = useDeviceStore((s) => s.setGesture);

  const device = getCurrentDevice(selectedModelId);
  const activeColor = getCurrentColor(device, selectedColorSku);
  const sideImage = side === 'left' ? activeColor.leftImage : activeColor.rightImage;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
        <CardTitle className="flex items-center gap-2.5 text-base">
          <span
            className={`rounded px-2 py-0.5 font-bold text-xs ${
              side === 'left'
                ? 'bg-muted text-foreground'
                : 'bg-primary/15 text-primary'
            }`}
          >
            {side === 'left' ? 'L' : 'R'}
          </span>
          {side === 'left' ? t('controls.leftEarbud') : t('controls.rightEarbud')}
        </CardTitle>

        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-secondary/20 p-1.5">
          <img
            src={sideImage}
            alt={side === 'left' ? 'Left' : 'Right'}
            className="max-h-full max-w-full object-contain drop-shadow-sm"
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {GESTURE_KEYS.map((gestureKey) => (
          <div
            key={gestureKey}
            className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 p-3.5"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background/70 p-1.5">
                <img
                  src={GESTURE_ICON_MAP[gestureKey]}
                  alt={gestureKey}
                  className="max-h-full max-w-full object-contain opacity-90 invert dark:invert-0"
                />
              </div>
              <div className="min-w-0">
                <div className="font-medium text-sm">
                  {t(`controls.gestures.${gestureKey}`)}
                </div>
                <div className="mt-0.5 text-muted-foreground text-xs">
                  {t(`controls.gestures.${gestureKey}Desc`)}
                </div>
              </div>
            </div>

            <Select
              value={gestures[gestureKey]}
              onValueChange={(val) =>
                setGesture(side, gestureKey, val as GestureAction)
              }
            >
              <SelectTrigger size="sm" className="w-[175px] shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTION_OPTIONS.filter((act) =>
                  PINCH_ALLOWED_ACTIONS[gestureKey].includes(act),
                ).map((act) => (
                  <SelectItem key={act} value={act}>
                    {t(`controls.actions.${act}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
