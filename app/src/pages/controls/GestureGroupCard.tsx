import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDeviceStore, getCurrentDevice, getCurrentColor } from '@/lib/deviceStore';
import type { GestureDeviceId, GestureOpName, GestureSlot } from '@/lib/deviceCapabilities';
import { baseGestureKey, gestureName, gestureOpName } from '@/components/device/capabilityUi';

const ICON_BASE = '/assets/icons/ear/control/';

/** Icon per gesture key for pinch/tap buds. Dark-ink SVGs → `dark:invert`. */
const BUD_ICON: Record<string, string> = {
  singleTap: 'control_ic_index_one.svg',
  doubleTap: 'control_ic_index_two.svg',
  tripleTap: 'control_ic_index_three.svg',
  tapHold: 'control_ic_index_tap_hold.svg',
  doubleTapHold: 'control_ic_index_double_tap_hold.svg',
  singlePress: 'control_ic_index_one.svg',
  doublePress: 'control_ic_index_two.svg',
  triplePress: 'control_ic_index_three.svg',
  pressHold: 'control_ic_index_tap_hold.svg',
  doublePressHold: 'control_ic_index_double_tap_hold.svg',
  rotate: 'control_ic_rotate.svg',
  slide: 'control_controlIc_slide.svg',
  slider: 'control_controlIc_slide.svg',
  pinchBoth: 'control_pinch_both_buds.svg',
  pinchBothHold: 'control_pinch_both_buds_and_hold.svg',
};

/** Button-press style icons for headphones / case dial / speakers. */
const PRESS_ICON: Record<string, string> = {
  singleTap: 'headphone_single_press.svg',
  doubleTap: 'headphone_double_press.svg',
  tripleTap: 'headphone_tripple_press.svg',
  tapHold: 'headphone_hold_press.svg',
  doubleTapHold: 'headphone_hold_press.svg',
  singlePress: 'headphone_single_press.svg',
  doublePress: 'headphone_double_press.svg',
  triplePress: 'headphone_tripple_press.svg',
  pressHold: 'headphone_hold_press.svg',
  doublePressHold: 'headphone_hold_press.svg',
};

function gestureIcon(device: GestureDeviceId, gestureKey: string): string {
  const key = baseGestureKey(gestureKey).key;
  const press = device === 4 || device === 6 || device === 7 ? PRESS_ICON[key] : undefined;
  return ICON_BASE + (press ?? BUD_ICON[key] ?? 'control_ic_index_one.svg');
}

/** Button byte → key under `controls.buttons` (others fall back to "Button n"). */
const BUTTON_KEY: Record<number, 'main' | 'slider' | 'call' | 'customButton'> = {
  1: 'main',
  5: 'slider',
  9: 'call',
  10: 'customButton',
};

export function GestureGroupCard({
  device,
  slots,
}: {
  device: GestureDeviceId;
  slots: GestureSlot[];
}) {
  const { t } = useTranslation();
  const selectedModelId = useDeviceStore((s) => s.selectedModelId);
  const selectedColorSku = useDeviceStore((s) => s.selectedColorSku);
  const gestures = useDeviceStore((s) => s.gestures);
  const setGestureOp = useDeviceStore((s) => s.setGestureOp);

  const catalog = getCurrentDevice(selectedModelId);
  const color = getCurrentColor(catalog, selectedColorSku);

  const isBud = device === 2 || device === 3;
  let title: string;
  let image: string | undefined;
  switch (device) {
    case 2:
      title = t('controls.leftEarbud');
      image = color.leftImage;
      break;
    case 3:
      title = t('controls.rightEarbud');
      image = color.rightImage;
      break;
    case 4:
      title = t('controls.caseControls');
      image = color.caseImage || color.heroImage;
      break;
    case 7:
      title = t('controls.speakerControls');
      image = color.heroImage;
      break;
    default:
      title = t('controls.bodyControls');
      image = color.heroImage;
  }

  const usable = slots.filter((s) => s.allowed.length > 0);
  const multiButton = new Set(usable.map((s) => s.button)).size > 1;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
        <CardTitle className="flex items-center gap-2.5 text-base">
          {isBud && (
            <span
              className={`rounded px-2 py-0.5 font-bold text-xs ${
                device === 2 ? 'bg-muted text-foreground' : 'bg-primary/15 text-primary'
              }`}
            >
              {device === 2 ? t('common.leftShort') : t('common.rightShort')}
            </span>
          )}
          {title}
        </CardTitle>

        {image && (
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-secondary/20 p-1.5">
            <img
              src={image}
              alt={title}
              className="max-h-full max-w-full object-contain drop-shadow-sm"
            />
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {usable.length === 0 && (
          <p className="text-muted-foreground text-sm">{t('controls.noControls')}</p>
        )}
        {usable.map((slot) => {
          const stored = gestures[slot.id];
          const value: GestureOpName =
            stored && slot.allowed.includes(stored) ? stored : slot.defaultOp;
          const name = gestureName(t, slot.gestureKey);
          const buttonKey = BUTTON_KEY[slot.button];
          const buttonLabel = buttonKey
            ? t(`controls.buttons.${buttonKey}`)
            : t('controls.buttons.generic', { n: slot.button });
          return (
            <div
              key={slot.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 p-3.5"
            >
              <div className="flex min-w-[140px] flex-1 items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background/70 p-1.5">
                  <img
                    src={gestureIcon(device, slot.gestureKey)}
                    alt=""
                    className="max-h-full max-w-full object-contain opacity-90 dark:invert"
                  />
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-sm">{name}</div>
                  {multiButton && (
                    <div className="mt-0.5 text-muted-foreground text-xs">{buttonLabel}</div>
                  )}
                </div>
              </div>

              <Select
                value={value}
                onValueChange={(val) => setGestureOp(slot.id, val as GestureOpName)}
                disabled={slot.allowed.length < 2}
              >
                <SelectTrigger
                  size="sm"
                  className="w-auto min-w-[150px] max-w-full shrink-0"
                  aria-label={name}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {slot.allowed.map((op) => (
                    <SelectItem key={op} value={op}>
                      {gestureOpName(t, op)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
