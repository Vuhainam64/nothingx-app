/**
 * UI helpers derived from per-model capabilities (shared by the full dashboard, mini widget and tray bar).
 */
import type { TFunction } from 'i18next';
import type { EqPreset } from '@/lib/bluetoothProtocol';
import type { DeviceCapabilities, DiracMode } from '@/lib/deviceCapabilities';

/**
 * Normal EQ presets to offer (empty when Dirac replaces the EQ). The generic 'diracOpteo' preset is left out
 * when the model lists Dirac sub-modes, since those are offered separately.
 */
export function visibleEqPresets(caps: DeviceCapabilities): EqPreset[] {
  if (caps.dirac?.replacesEq) return [];
  const hasDiracModes = (caps.dirac?.modes.length ?? 0) > 0;
  const list = caps.eqPresets.filter((p) => {
    if (p === 'diracOpteo') return !hasDiracModes;
    if (p === 'advanced') return caps.advancedEq;
    if (p === 'custom') return caps.simpleCustomEq !== null;
    return true;
  });
  if (caps.advancedEq && !list.includes('advanced')) list.push('advanced');
  return list;
}

/** Dirac modes to offer (empty when the model has no Dirac). */
export function visibleDiracModes(caps: DeviceCapabilities): DiracMode[] {
  return caps.dirac?.modes ?? [];
}

/** Combined value used by compact pickers (mini widget): `p:<preset>` or `d:<diracMode>`. */
export type EqPickerValue = `p:${EqPreset}` | `d:${DiracMode}`;

export function eqPickerOptions(caps: DeviceCapabilities): EqPickerValue[] {
  const dirac = visibleDiracModes(caps);
  const presets = visibleEqPresets(caps);
  return [
    ...presets.map((p) => `p:${p}` as EqPickerValue),
    ...dirac.map((m) => `d:${m}` as EqPickerValue),
  ];
}

export function eqPickerValue(
  caps: DeviceCapabilities,
  eqPreset: EqPreset,
  diracMode: DiracMode,
): EqPickerValue | '' {
  const options = eqPickerOptions(caps);
  const dirac = caps.dirac;
  const current: EqPickerValue =
    dirac && (dirac.replacesEq || eqPreset === 'diracOpteo') ? `d:${diracMode}` : `p:${eqPreset}`;
  return options.includes(current) ? current : '';
}

export function eqPickerLabel(t: TFunction, value: EqPickerValue): string {
  return value.startsWith('d:')
    ? t(`equalizer.dirac.${value.slice(2)}`)
    : t(`equalizer.presets.${value.slice(2)}`);
}

// Cover art ships in light/dark variants (images/ear/eq/<name>_<theme>.png).
const EQ_COVER_NAME: Record<EqPreset, string> = {
  balanced: 'equalizer_balanced',
  moreBass: 'equalizer_bass',
  moreTreble: 'equalizer_treble',
  voice: 'equalizer_voice',
  diracOpteo: 'dirac_eq_cover',
  custom: 'equalizer_electronic',
  advanced: 'equalizer_classical',
};

const DIRAC_COVER_NAME: Record<DiracMode, string> = {
  opteo: 'dirac_eq_cover',
  rock: 'equalizer_rock',
  electronic: 'equalizer_electronic',
  pop: 'equalizer_pop',
  enhanceVocals: 'equalizer_vocals',
  classical: 'equalizer_classical',
  customEq: 'equalizer_balanced',
  dirac: 'equalizer_new_dirac_eq',
  immersionBoost: 'equalizer_new_dirac_eq',
};

export const eqCover = (preset: EqPreset, theme: 'light' | 'dark') =>
  `/assets/images/ear/eq/${EQ_COVER_NAME[preset] ?? 'equalizer_balanced'}_${theme}.png`;

export const diracCover = (mode: DiracMode, theme: 'light' | 'dark') =>
  `/assets/images/ear/eq/${DIRAC_COVER_NAME[mode] ?? 'dirac_eq_cover'}_${theme}.png`;

/** "doubleTapHold" → "Double tap hold" — fallback when an i18n key is missing. */
export function humanizeKey(key: string): string {
  const s = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Strips the `call` prefix CAPS uses for "default call controls" rows (e.g. callDoublePress → doublePress). */
export function baseGestureKey(gestureKey: string): { key: string; call: boolean } {
  const m = /^call([A-Z].*)$/.exec(gestureKey);
  return m ? { key: m[1].charAt(0).toLowerCase() + m[1].slice(1), call: true } : { key: gestureKey, call: false };
}

export function gestureName(t: TFunction, gestureKey: string): string {
  const { key, call } = baseGestureKey(gestureKey);
  const name = t(`controls.gestureNames.${key}`, { defaultValue: humanizeKey(key) });
  return call ? t('controls.callGesture', { gesture: name }) : name;
}

export function gestureOpName(t: TFunction, op: string): string {
  return t(`controls.ops.${op}`, { defaultValue: humanizeKey(op) });
}
