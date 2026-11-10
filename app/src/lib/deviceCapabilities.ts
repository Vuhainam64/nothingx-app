/**
 * Per-model capabilities derived from the official Nothing X per-model config
 * (`public/assets/config/ear_white_list.json`, byte-identical to the Android app's bundled copy).
 *
 * CONTRACT FILE — the types below are shared by the store (deviceStore.ts / nothingCommands.ts)
 * and the UI. Implementation of `getDeviceCapabilities` lives at the bottom of this file.
 */
import type { AncLevel, EqPreset } from './bluetoothProtocol';
import type { SpatialMode } from './nothingCommands';
import whiteListRaw from '../../public/assets/config/ear_white_list.json';

/** Gesture target device id on the wire (byte 0 of a 0xF003 entry). */
export type GestureDeviceId = 2 | 3 | 4 | 6 | 7; // 2 left, 3 right, 4 case, 6 single body (headphone/neckband), 7 speaker

/**
 * Operation codes (byte 3 of a 0xF003 entry) that this app can offer. Names are i18n keys under
 * `controls.ops.<name>`. Codes come from the official app's Operation enum.
 */
export const GESTURE_OPS = {
  noAction: 1,
  playPause: 2,
  answerHangUp: 3,
  rejectCall: 4,
  prevTrack: 8,
  nextTrack: 9,
  noiseControlAll: 10, // ANC → Transparency → Off cycle
  voiceAssistant: 11,
  lowLatency: 17,
  volumeUp: 18,
  volumeDown: 19,
  noiseAncOff: 20, // ANC ↔ Off
  noiseTransOff: 21, // Transparency ↔ Off
  noiseAncTrans: 22, // ANC ↔ Transparency
  volumeControl: 23, // dial rotate = volume
  spatialAudio: 27,
  micMute: 29,
  eqPreset: 34,
  ultraBass: 35,
  trebleEnhance: 36,
} as const;
export type GestureOpName = keyof typeof GESTURE_OPS;

/** One writable control slot (device, button, gesture) with the operations the model accepts. */
export interface GestureSlot {
  /** Stable key `${device}-${button}-${gesture}`, used in store state. */
  id: string;
  device: GestureDeviceId;
  button: number;
  gesture: number;
  /** i18n key for the gesture name, `controls.gestureNames.<key>` (e.g. doubleTap, tripleTap, tapHold, doubleTapHold, singleTap, rotate, slide). */
  gestureKey: string;
  /** Allowed operations, in the official app's display order; only ops present in GESTURE_OPS. */
  allowed: GestureOpName[];
  /** Factory default operation. */
  defaultOp: GestureOpName;
}

export type DiracMode =
  | 'opteo'
  | 'rock'
  | 'electronic'
  | 'pop'
  | 'enhanceVocals'
  | 'classical'
  | 'customEq'
  | 'dirac'
  | 'immersionBoost';

/** DiracMode → byte sent with 0xF01D. */
export const DIRAC_MODE_BYTE: Record<DiracMode, number> = {
  opteo: 0,
  rock: 1,
  electronic: 2,
  pop: 3,
  enhanceVocals: 4,
  classical: 5,
  customEq: 6,
  dirac: 7,
  immersionBoost: 8,
};

export interface SimpleEqShape {
  freqLow: number;
  qLow: number;
  freqPeak: number;
  qPeak: number;
  freqHigh: number;
  qHigh: number;
}

export type FindTarget = 'left' | 'right' | 'body';

export interface DeviceCapabilities {
  /** Model id (e.g. "B171"); `known` is false when the model is absent from the config. */
  modelId: string;
  known: boolean;

  // Noise control
  anc: boolean;
  /** ANC intensity levels the model offers (empty → no level selector). */
  ancLevels: AncLevel[];
  transparency: boolean;
  personalAnc: boolean;
  earTipFitTest: boolean;

  // Sound
  /**
   * Presets to show. For Dirac models (`dirac !== null && dirac.replacesEq`) this is empty and the UI
   * shows `dirac.modes` instead.
   */
  eqPresets: EqPreset[];
  simpleCustomEq: SimpleEqShape | null;
  /** 8-band parametric EQ (0xF050/0xF04F); firmware-dependent on some models. */
  advancedEq: boolean;
  /** advancedEqTotalGain from config (dB) or null for the default rule. */
  advancedEqTotalGain: number | null;
  dirac: null | {
    /** 1 = Dirac replaces the normal EQ (presets sent via 0xF01D only); 2 = both offered. */
    support: 1 | 2;
    replacesEq: boolean;
    modes: DiracMode[];
  };
  /** null = no Ultra Bass. v1 → level*2, v2 → level*5. */
  ultraBass: null | { encoding: 'v1' | 'v2'; maxLevel: number };
  /** Spatial modes offered, excluding 'off' (empty → no spatial card). */
  spatialModes: Exclude<SpatialMode, 'off'>[];
  /** true only when the device itself renders spatial audio (official app sends 0xF052). */
  spatialOnDevice: boolean;
  /** Hi-res codecs the model supports. */
  highResCodecs: ('ldac' | 'lhdc')[];

  // Controls
  gestureSlots: GestureSlot[];
  /** CMF Buds Pro 2 style dial on the case (device 4). */
  smartDial: boolean;

  // Settings
  inEarDetection: boolean;
  lowLatency: boolean;
  dualConnection: boolean;
  findTargets: FindTarget[];
  /** Battery layout. */
  batteryLayout: 'tws' | 'single';
}


// ─────────────────────────────────────────────────────────────────────────────
// Implementation. Every rule below mirrors the official app (Nothing X 3.10.2, blutter asm):
//  - config selection: NtWhiteListModelExt.getConfigByVersion + NtAppUtils.isInVersion/compareVersion
//  - flags: ConfigsExt.* (nt_white_list.dart) and NtConnectDeviceRecord.support* (nt_connect_device_record.dart)
//  - EQ / Dirac lists: EarEqSimplePresetsBuilder (ear_eq_simple_presets_builder.dart)
// ─────────────────────────────────────────────────────────────────────────────

interface WlOperation {
  operation: number;
  isCustom?: boolean;
  supportPlatform?: number;
  limitVersion?: string;
  isCanSelectNoiseReduction?: boolean;
}
interface WlOperationGroup {
  isCustom?: boolean;
  isDefaultCallControls?: boolean;
  callControlsButton?: number;
  operations?: WlOperation[];
}
interface WlGesture {
  isCustom?: boolean;
  deviceType: number;
  button: number;
  gesture: number;
  gestureNameKey?: string;
  defaultOperation?: Record<string, number>;
  operationGroups?: WlOperationGroup[];
}
interface WlConfig {
  minFirmware?: string;
  maxFirmware?: string;
  deviceType?: number;
  privateCode?: number;
  eq?: number;
  ancLevel?: number;
  personalizedAnc?: number;
  earTipFitTest?: number;
  earDetection?: number;
  lowLagMode?: number;
  dualConnection?: number;
  advancedEq?: number;
  advancedEqTotalGain?: number;
  customEQ?: SimpleEqShape;
  highQualityAudio?: number;
  ultraBass?: number;
  ultraBassType?: number;
  spatialAudio?: number;
  notUsePhoneSpatial?: number;
  useAudiodoSpatial?: number;
  diracOpteoSupport?: number;
  diracOpteo?: number;
  smartKnob?: number;
  clipSmartDial?: number;
  defaultControl?: string;
  controls?: { earGestureGroups?: { gestures?: WlGesture[] }[] };
}
interface WlModel {
  id: string;
  configs: WlConfig[];
}

const WHITE_LIST: WlModel[] = whiteListRaw as unknown as WlModel[];
const MODEL_INDEX = new Map<string, WlModel>(WHITE_LIST.map((m) => [m.id.toUpperCase(), m]));

/** NtAppUtils.versionFormat: drop any "-suffix". */
function versionFormat(v: string): string {
  return v.trim().split('-')[0];
}

/** NtAppUtils.compareVersion: dot-separated numeric compare; "*" components are skipped, junk parses as 0. */
function compareVersion(a: string, b: string): number {
  const pa = versionFormat(a).split('.');
  const pb = versionFormat(b).split('.');
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const x = pa[i] ?? '0';
    const y = pb[i] ?? '0';
    if (x === '*' || y === '*') continue;
    const xi = parseInt(x, 10) || 0;
    const yi = parseInt(y, 10) || 0;
    if (xi !== yi) return xi > yi ? 1 : -1;
  }
  return 0;
}

/** NtAppUtils.isInVersion: min/max inclusive, either bound optional. */
function isInVersion(fw: string, min?: string, max?: string): boolean {
  if (min && compareVersion(fw, min) < 0) return false;
  if (max && compareVersion(fw, max) > 0) return false;
  return true;
}

/**
 * Firmware assumed when none is known (demo mode). Ear (stick)'s newest range (`*.*.2.0`, ancLevel 33)
 * is a not-yet-shipped firmware line; shipping units run 1.x (no ANC), so demo mode uses that range.
 */
const DEMO_FIRMWARE: Record<string, string> = { B157: '*.*.1.999' };

/**
 * The official app takes the first config whose firmware range matches (or `configs.first` when the
 * firmware is unknown). We differ for unknown/unmatched firmware: pick the newest range (highest
 * minFirmware) so demo mode shows the current feature set.
 */
function pickConfig(model: WlModel, firmware: string | null): WlConfig | null {
  const configs = model.configs ?? [];
  if (!configs.length) return null;
  firmware = firmware ?? DEMO_FIRMWARE[model.id.toUpperCase()] ?? null;
  if (firmware) {
    const hit = configs.find((c) => isInVersion(firmware, c.minFirmware, c.maxFirmware));
    if (hit) return hit;
  }
  let best = configs[0];
  for (const c of configs) {
    if (!c.minFirmware) continue;
    if (!best.minFirmware || compareVersion(c.minFirmware, best.minFirmware) > 0) best = c;
  }
  return best;
}

/** `x == 1` (ConfigsExt.isSupport*: absent/0 → false). */
/** Fixed filter shape of the official simple custom EQ (0xF041). */
const OFFICIAL_SIMPLE_EQ_SHAPE: SimpleEqShape = {
  freqLow: 140,
  qLow: 0.8,
  freqPeak: 980,
  qPeak: 0.7,
  freqHigh: 6900,
  qHigh: 1.0,
};

const isOne = (v: number | undefined) => v === 1;
/** Flags whose absence means "supported" (isSupportEarDetection, isSupportDualConnect; low lag). */
const absentOrOne = (v: number | undefined) => v === undefined || v === null || v === 1;

// ancLevel bitmask (initAnc closures, nt_connect_device_record.dart 0x2c1ca50 / 0x2c1caec / supportOn):
// bit0 high, bit1 mid, bit2 low, bit3 adaptive → ANC "on" if any of bits 0-3; bit4 transparency; bit5 off.
const ANC_LEVEL_BITS: AncLevel[] = ['high', 'mid', 'low', 'adaptive'];

// eq bitmask (EarEqSimplePresetsBuilder.build, List<EQMode> pp+0x194678):
// bit0 balanced, bit1 voice, bit2 moreTreble, bit3 moreBass, bit4 simpleCustomEq, bit5 newVoice, bit6 newInstrument.
// Display order (_sortPresetsNativeOrder, pp+0x1946b0): balanced, moreBass, moreTreble, voice, newVoice,
// newInstrument, custom. newVoice / newInstrument have no EqPreset counterpart and are skipped.
const EQ_BIT_TO_PRESET: (EqPreset | null)[] = ['balanced', 'voice', 'moreTreble', 'moreBass', 'custom', null, null];
const EQ_NATIVE_ORDER: EqPreset[] = ['balanced', 'moreBass', 'moreTreble', 'voice', 'custom'];
/** Fallback list when `eq` is absent / 0 (builder default branch). */
const EQ_DEFAULT: EqPreset[] = ['balanced', 'moreBass', 'moreTreble', 'voice', 'custom'];

// diracOpteo bitmask (_buildDiracPresets, List<DiracEQMode> pp+0x1946c8):
// bit0 dirac, bit1 opteo, bit2 rock, bit3 electronic, bit4 pop, bit5 enhanceVocals, bit6 classical,
// bit7 customEq, bit8 immersionBoost.
const DIRAC_BITS: DiracMode[] = [
  'dirac', 'opteo', 'rock', 'electronic', 'pop', 'enhanceVocals', 'classical', 'customEq', 'immersionBoost',
];
// Display order (pp+0x1946a8).
const DIRAC_NATIVE_ORDER: DiracMode[] = [
  'immersionBoost', 'dirac', 'opteo', 'pop', 'rock', 'electronic', 'enhanceVocals', 'classical', 'customEq',
];

// spatialAudio bitmask (supportSpatialAudioEffect*): 1 head tracking, 2 fixed, 8 concert, 16 movie, 32 game.
const SPATIAL_BITS: [number, Exclude<SpatialMode, 'off'>][] = [
  [2, 'fixed'],
  [1, 'headTracking'],
  [8, 'concert'],
  [16, 'cinema'],
  [32, 'game'],
];

const OP_BY_CODE = new Map<number, GestureOpName>(
  (Object.entries(GESTURE_OPS) as [GestureOpName, number][]).map(([name, code]) => [code, name]),
);

const GESTURE_KEY_MAP: Record<string, string> = {
  control_double_tap: 'doubleTap',
  control_triple_tap: 'tripleTap',
  control_tap_hold: 'tapHold',
  control_double_tap_hold: 'doubleTapHold',
  double_tap_hole: 'doubleTapHold',
  control_double_press: 'doublePress',
  double_press: 'doublePress',
  control_triple_press: 'triplePress',
  triple_press: 'triplePress',
  control_press_hold: 'pressHold',
  press_hold: 'pressHold',
  hold: 'pressHold',
  control_double_press_hold: 'doublePressHold',
  double_press_hold: 'doublePressHold',
  control_single_press: 'singlePress',
  single_press: 'singlePress',
  rotate: 'rotate',
  control_slider: 'slider',
  control_slide_on_system: 'slide',
  pinch_both_buds: 'pinchBoth',
};

const GESTURE_KEY_BY_CODE: Record<number, string> = {
  1: 'singlePress',
  2: 'doublePress',
  3: 'triplePress',
  5: 'slider',
  7: 'pressHold',
  9: 'doublePressHold',
  10: 'rotate',
  11: 'pinchBoth',
};

function gestureKeyFor(nameKey: string | undefined, gesture: number): string {
  const k = (nameKey ?? '').toLowerCase().replace(/_\d{8}$/, '');
  if (GESTURE_KEY_MAP[k]) return GESTURE_KEY_MAP[k];
  if (GESTURE_KEY_BY_CODE[gesture]) return GESTURE_KEY_BY_CODE[gesture];
  return (
    k.replace(/^control_/, '').replace(/_([a-z0-9])/g, (_m, c: string) => c.toUpperCase()) ||
    `gesture${gesture}`
  );
}

/** Parse `defaultControl` hex ("[count][dev btn gesture op]*") into a lookup. */
function parseDefaultControl(hex: string | undefined): Map<string, number> {
  const out = new Map<string, number>();
  if (!hex || !/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2) return out;
  const b: number[] = [];
  for (let i = 0; i < hex.length; i += 2) b.push(parseInt(hex.slice(i, i + 2), 16));
  for (let i = 1; i + 3 < b.length; i += 4) out.set(`${b[i]}-${b[i + 1]}-${b[i + 2]}`, b[i + 3]);
  return out;
}

interface NoiseCaps {
  anc: boolean;
  transparency: boolean;
}

/** Writable ops of one gesture row, mapped to GESTURE_OPS names in display order. */
function collectOps(ops: WlOperation[], firmware: string | null, noise: NoiseCaps): GestureOpName[] {
  const out: GestureOpName[] = [];
  const push = (n: GestureOpName) => {
    if (!out.includes(n)) out.push(n);
  };
  for (const op of ops) {
    if (op.isCustom === false) continue; // display-only row
    if (op.supportPlatform != null) continue; // platform-limited (News / Radio / Essential Space: Android-only)
    if (op.limitVersion && firmware && compareVersion(firmware, op.limitVersion) < 0) continue;
    if (op.operation === GESTURE_OPS.noiseControlAll) {
      // Op 10 is the noise-control family; the app's sub-page picks the cycle (10/20/21/22),
      // except where isCanSelectNoiseReduction=false (Ear (1): only the full cycle).
      if (op.isCanSelectNoiseReduction === false) {
        if (noise.anc || noise.transparency) push('noiseControlAll');
      } else if (noise.anc && noise.transparency) {
        push('noiseControlAll');
        push('noiseAncTrans');
        push('noiseAncOff');
        push('noiseTransOff');
      } else if (noise.anc) push('noiseAncOff');
      else if (noise.transparency) push('noiseTransOff');
      continue;
    }
    const name = OP_BY_CODE.get(op.operation);
    if (name) push(name);
  }
  return out;
}

function pickDefault(code: number | undefined, allowed: GestureOpName[]): GestureOpName {
  const name = code !== undefined ? OP_BY_CODE.get(code) : undefined;
  if (name && allowed.includes(name)) return name;
  return allowed.includes('noAction') ? 'noAction' : allowed[0];
}

function buildGestureSlots(
  cfg: WlConfig,
  firmware: string | null,
  noise: NoiseCaps,
  tws: boolean,
): GestureSlot[] {
  const slots: GestureSlot[] = [];
  const seen = new Set<string>();
  const defaults = parseDefaultControl(cfg.defaultControl);
  const add = (slot: GestureSlot) => {
    if (seen.has(slot.id) || slot.allowed.length < 2) return; // <2 options → nothing to choose
    seen.add(slot.id);
    slots.push(slot);
  };
  for (const group of cfg.controls?.earGestureGroups ?? []) {
    for (const g of group.gestures ?? []) {
      if (!g.isCustom || !(g.gesture > 0) || ![2, 3, 4, 6, 7].includes(g.deviceType)) continue;
      const key = gestureKeyFor(g.gestureNameKey, g.gesture);
      const mainOps: WlOperation[] = [];
      const callGroups: WlOperationGroup[] = [];
      for (const og of g.operationGroups ?? []) {
        if (og.isDefaultCallControls) callGroups.push(og);
        else if (og.isCustom !== false) mainOps.push(...(og.operations ?? []));
      }
      const allowed = collectOps(mainOps, firmware, noise);
      // Bud rows are listed once (device 2); the app shows Left/Right tabs and writes device 2 or 3.
      const devices: GestureDeviceId[] =
        g.deviceType === 2 && tws ? [2, 3] : [g.deviceType as GestureDeviceId];
      for (const device of devices) {
        const d = g.defaultOperation ?? {};
        const code =
          (device === 2 ? d.left : device === 3 ? d.right : undefined) ??
          d.default ??
          defaults.get(`${device}-${g.button}-${g.gesture}`);
        add({
          id: `${device}-${g.button}-${g.gesture}`,
          device,
          button: g.button,
          gesture: g.gesture,
          gestureKey: key,
          allowed,
          defaultOp: pickDefault(code, allowed),
        });
      }
      // "Default call controls" sub-group: same gesture, written to the hidden call button (04 09 xx).
      for (const og of callGroups) {
        const button = og.callControlsButton;
        if (typeof button !== 'number') continue;
        const callAllowed = collectOps(og.operations ?? [], firmware, noise);
        const device = g.deviceType as GestureDeviceId;
        add({
          id: `${device}-${button}-${g.gesture}`,
          device,
          button,
          gesture: g.gesture,
          gestureKey: `call${key.charAt(0).toUpperCase()}${key.slice(1)}`,
          allowed: callAllowed,
          defaultOp: pickDefault(defaults.get(`${device}-${button}-${g.gesture}`), callAllowed),
        });
      }
    }
  }
  return slots;
}

function unknownCapabilities(modelId: string): DeviceCapabilities {
  return {
    modelId,
    known: false,
    anc: true,
    ancLevels: ['high', 'mid', 'low'],
    transparency: true,
    personalAnc: false,
    earTipFitTest: false,
    eqPresets: ['balanced', 'moreBass', 'moreTreble', 'voice', 'custom'],
    simpleCustomEq: { ...OFFICIAL_SIMPLE_EQ_SHAPE },
    advancedEq: false,
    advancedEqTotalGain: null,
    dirac: null,
    ultraBass: null,
    spatialModes: [],
    spatialOnDevice: false,
    highResCodecs: [],
    gestureSlots: [],
    smartDial: false,
    inEarDetection: true,
    lowLatency: true,
    dualConnection: false,
    findTargets: ['left', 'right'],
    batteryLayout: 'tws',
  };
}

const capsCache = new Map<string, DeviceCapabilities>();

/**
 * Resolve capabilities for a model + firmware (firmware may be null in demo mode / before probe).
 * Must never throw; unknown models get conservative defaults (`known: false`).
 * Results are cached per (model, firmware) and returned as the same object — treat as read-only.
 */
export function getDeviceCapabilities(
  modelId: string,
  firmware: string | null,
): DeviceCapabilities {
  const id = String(modelId ?? '').trim();
  const fw = typeof firmware === 'string' && firmware.trim() ? firmware.trim() : null;
  const cacheKey = `${id.toUpperCase()}|${fw ?? ''}`;
  const hit = capsCache.get(cacheKey);
  if (hit) return hit;
  let caps: DeviceCapabilities;
  try {
    caps = computeCapabilities(id, fw);
  } catch {
    caps = unknownCapabilities(id);
  }
  capsCache.set(cacheKey, caps);
  return caps;
}

function computeCapabilities(modelId: string, firmware: string | null): DeviceCapabilities {
  const model = MODEL_INDEX.get(modelId.toUpperCase());
  const cfg = model ? pickConfig(model, firmware) : null;
  if (!cfg) return unknownCapabilities(modelId);

  const single = cfg.deviceType === 6 || cfg.deviceType === 7; // 6 headphone/neckband, 7 speaker

  // Noise control
  const ancMask = cfg.ancLevel ?? 0;
  const anc = (ancMask & 0x0f) !== 0;
  const transparency = (ancMask & 0x10) !== 0;
  const ancLevels = ANC_LEVEL_BITS.filter((_, i) => (ancMask & (1 << i)) !== 0);

  // Dirac: isDiracEq = diracOpteo > 0 → the preset list is built from the Dirac mask only, and
  // supportDiracOpteo (diracOpteoSupport ∈ {1,2}, a plain boolean everywhere in the app) blocks 0xF041.
  // No code path distinguishes 1 from 2, so both replace the normal EQ.
  const diracMask = cfg.diracOpteo ?? 0;
  const dirac: DeviceCapabilities['dirac'] =
    diracMask > 0 || cfg.diracOpteoSupport === 1 || cfg.diracOpteoSupport === 2
      ? {
          support: cfg.diracOpteoSupport === 2 ? 2 : 1,
          replacesEq: true,
          modes: DIRAC_NATIVE_ORDER.filter((m) => (diracMask & (1 << DIRAC_BITS.indexOf(m))) !== 0),
        }
      : null;

  // EQ presets
  let eqPresets: EqPreset[] = [];
  if (!dirac) {
    const eqMask = cfg.eq ?? 0;
    if (eqMask > 0) {
      const set = new Set<EqPreset>();
      EQ_BIT_TO_PRESET.forEach((p, i) => {
        if (p && (eqMask & (1 << i)) !== 0) set.add(p);
      });
      eqPresets = EQ_NATIVE_ORDER.filter((p) => set.has(p));
    }
    if (!eqPresets.length) eqPresets = [...EQ_DEFAULT];
  }
  // The official app's NtEarSimpleCustomEq.buildSetPayload hardcodes 140/980/6900 Hz (Q 0.8/0.7/1.0);
  // the config's `customEQ` frequencies are parsed but never used for the 0xF041 payload.
  const simpleCustomEq: SimpleEqShape | null =
    !dirac && cfg.customEQ && eqPresets.includes('custom') ? { ...OFFICIAL_SIMPLE_EQ_SHAPE } : null;

  // Ultra Bass (useBassBoostV2 = privateCode == 247 || ultraBassType == 3)
  const ultraBass: DeviceCapabilities['ultraBass'] = isOne(cfg.ultraBass)
    ? { encoding: cfg.privateCode === 247 || cfg.ultraBassType === 3 ? 'v2' : 'v1', maxLevel: 5 }
    : null;

  // Spatial. setSpatialAudioByRecord sends 0xF052 only when notUsePhoneSpatial; models with
  // useAudiodoSpatial go through the Audiodo path (0xF079) instead, which we don't implement.
  const spatialMask = cfg.spatialAudio ?? 0;
  const spatialModes = SPATIAL_BITS.filter(([bit]) => (spatialMask & bit) !== 0).map(([, m]) => m);
  const spatialOnDevice =
    spatialModes.length > 0 && isOne(cfg.notUsePhoneSpatial) && !isOne(cfg.useAudiodoSpatial);

  // Hi-Res (supportLDAC: mask & 4, supportLHDC: mask & 2)
  const hq = cfg.highQualityAudio ?? 0;
  const highResCodecs: ('ldac' | 'lhdc')[] = [];
  if (hq & 4) highResCodecs.push('ldac');
  if (hq & 2) highResCodecs.push('lhdc');

  return {
    modelId,
    known: true,
    anc,
    ancLevels: anc ? ancLevels : [],
    transparency,
    personalAnc: isOne(cfg.personalizedAnc),
    earTipFitTest: isOne(cfg.earTipFitTest),
    eqPresets,
    simpleCustomEq,
    advancedEq: !dirac && isOne(cfg.advancedEq),
    advancedEqTotalGain: typeof cfg.advancedEqTotalGain === 'number' ? cfg.advancedEqTotalGain : null,
    dirac,
    ultraBass,
    spatialModes,
    spatialOnDevice,
    highResCodecs,
    gestureSlots: buildGestureSlots(cfg, firmware, { anc, transparency }, !single),
    smartDial: isOne(cfg.smartKnob) || isOne(cfg.clipSmartDial),
    inEarDetection: absentOrOne(cfg.earDetection),
    lowLatency: absentOrOne(cfg.lowLagMode),
    dualConnection: absentOrOne(cfg.dualConnection),
    findTargets: single ? ['body'] : ['left', 'right'],
    batteryLayout: single ? 'single' : 'tws',
  };
}
