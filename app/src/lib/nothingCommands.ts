/**
 * Payload encoders for Nothing / CMF earbud commands.
 *
 * Every opcode and byte layout here was verified against the Nothing X 3.10.2 Android app
 * (blutter-disassembled Flutter AOT, `flutter_nothing_link/.../ear/ear_helper.dart` and `cmd/*`).
 * Replies to a request `cmd` come back as `cmd & 0x7FFF` (query 0xC0xx → 0x40xx, set 0xF0xx → ack 0x70xx).
 */
import type { DeviceCatalogEntry } from './deviceCatalog';
import type { EqPreset, ParametricBand } from './bluetoothProtocol';

export const OP = {
  // EQ
  GET_EQ_MODE: 0xc01f,
  SET_EQ_MODE: 0xf010, // [mode]
  GET_ADVANCE_EQ_MODE: 0xc04c,
  SET_ADVANCE_EQ_MODE: 0xf04f, // [1] on / [0] off
  GET_SIMPLE_CUSTOM_EQ: 0xc044,
  SET_SIMPLE_CUSTOM_EQ: 0xf041, // 44 bytes
  GET_ADVANCE_CUSTOM_EQ: 0xc04d, // [profile = 0]
  SET_ADVANCE_CUSTOM_EQ: 0xf050, // 6 + 13n bytes
  GET_DIRAC_EQ: 0xc050,
  SET_DIRAC_EQ: 0xf01d, // [diracMode]
  // Spatial / codec
  GET_SPATIAL_AUDIO: 0xc04f,
  SET_SPATIAL_AUDIO: 0xf052, // [spatial, head]
  GET_HIGH_QUALITY_AUDIO: 0xc029,
  SET_HIGH_QUALITY_AUDIO: 0xf01c, // [0 aac | 1 lhdc | 2 ldac]
  // Controls
  GET_GESTURE: 0xc018,
  SET_GESTURE: 0xf003, // [count, (device, button, gesture, operation)*]
} as const;

/* ------------------------------------------------------------------ little-endian helpers */

function f32le(value: number): number[] {
  const buf = new DataView(new ArrayBuffer(4));
  buf.setFloat32(0, value, true);
  return [buf.getUint8(0), buf.getUint8(1), buf.getUint8(2), buf.getUint8(3)];
}

function readF32le(bytes: number[], offset: number): number {
  const buf = new DataView(new ArrayBuffer(4));
  for (let i = 0; i < 4; i++) buf.setUint8(i, bytes[offset + i] ?? 0);
  return buf.getFloat32(0, true);
}

/** Compare dotted firmware versions ("1.0.1.46"). Missing/blank sorts as oldest. */
export function compareFirmware(a: string | null | undefined, b: string): number {
  if (!a || !a.trim()) return -1;
  const pa = a.trim().split('.').map((x) => parseInt(x, 10) || 0);
  const pb = b.split('.').map((x) => parseInt(x, 10) || 0);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

/** Firmware 1.0.1.46+ uses the "new" total-gain rule for both simple and advanced EQ. */
function isNewGainFirmware(firmware: string | null | undefined): boolean {
  return compareFirmware(firmware, '1.0.1.46') >= 0;
}

/* ------------------------------------------------------------------ EQ mode */

/** EQMode values from the app (pp.txt EQMode objects). `advance` (100) is never sent via 0xF010. */
export const EQ_MODE = {
  balanced: 0,
  voice: 1,
  moreTreble: 2,
  moreBass: 3,
  diracEq: 4,
  simpleCustomEq: 5,
  newVoice: 6,
  newInstrument: 7,
  advance: 100,
} as const;

export type HwCommand = { command: number; payload: number[] };

/**
 * Command sequence to select a preset, mirroring `setSimpleMode` in ear_eq_repository.dart:
 * advanced → F04F [01]; anything else → (F04F [00] if advanced was on) then F010 [mode];
 * Dirac Opteo devices use F01D instead of F010.
 */
export function eqPresetCommands(preset: EqPreset, previous: EqPreset): HwCommand[] {
  if (preset === 'advanced') {
    return [{ command: OP.SET_ADVANCE_EQ_MODE, payload: [0x01] }];
  }
  const out: HwCommand[] = [];
  if (previous === 'advanced') out.push({ command: OP.SET_ADVANCE_EQ_MODE, payload: [0x00] });
  if (preset === 'diracOpteo') {
    out.push({ command: OP.SET_DIRAC_EQ, payload: [0x00] }); // DiracMode.opteo = 0
    return out;
  }
  const mode: Record<Exclude<EqPreset, 'advanced' | 'diracOpteo'>, number> = {
    balanced: EQ_MODE.balanced,
    voice: EQ_MODE.voice,
    moreTreble: EQ_MODE.moreTreble,
    moreBass: EQ_MODE.moreBass,
    custom: EQ_MODE.simpleCustomEq,
  };
  out.push({ command: OP.SET_EQ_MODE, payload: [mode[preset]] });
  return out;
}

/** 0xC01F reply → preset. 0x64 (advance) is reported by 0xC04C separately on most firmware. */
export function eqPresetFromMode(mode: number | null | undefined): EqPreset | null {
  switch (mode) {
    case EQ_MODE.balanced:
      return 'balanced';
    case EQ_MODE.voice:
    case EQ_MODE.newVoice:
      return 'voice';
    case EQ_MODE.moreTreble:
      return 'moreTreble';
    case EQ_MODE.moreBass:
      return 'moreBass';
    case EQ_MODE.diracEq:
      return 'diracOpteo';
    case EQ_MODE.simpleCustomEq:
      return 'custom';
    case EQ_MODE.advance:
      return 'advanced';
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ simple 3-band custom EQ (0xF041) */

export type SimpleEqBands = { bass: number; mid: number; treble: number };

// Record order and fixed filter parameters from nt_ear_simple_custom_equaliser.dart buildSetPayload.
const SIMPLE_EQ_LAYOUT = [
  { key: 'mid' as const, type: 1, freq: 980, q: 0.7 },
  { key: 'treble' as const, type: 2, freq: 6900, q: 1.0 },
  { key: 'bass' as const, type: 0, freq: 140, q: 0.8 },
];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function encodeSimpleCustomEq(bands: SimpleEqBands, firmware: string | null): number[] {
  const g = {
    bass: clamp(bands.bass, -6, 6),
    mid: clamp(bands.mid, -6, 6),
    treble: clamp(bands.treble, -6, 6),
  };
  const maxGain = Math.max(g.bass, g.mid, g.treble);
  const total = isNewGainFirmware(firmware) ? maxGain : maxGain > 0 ? -maxGain : 0;

  const out = [SIMPLE_EQ_LAYOUT.length, ...f32le(total)];
  for (const rec of SIMPLE_EQ_LAYOUT) {
    out.push(rec.type, ...f32le(g[rec.key]), ...f32le(rec.freq), ...f32le(rec.q));
  }
  return out; // 1 + 4 + 3*13 = 44 bytes
}

/** 0xC044 reply → gains (records read by type byte, not position). */
export function decodeSimpleCustomEq(payload: number[]): SimpleEqBands | null {
  if (payload.length < 5) return null;
  const count = payload[0];
  const out: SimpleEqBands = { bass: 0, mid: 0, treble: 0 };
  for (let i = 0; i < count; i++) {
    const at = 5 + i * 13;
    if (at + 13 > payload.length) break;
    const gain = Math.round(readF32le(payload, at + 1));
    if (payload[at] === 0) out.bass = gain;
    else if (payload[at] === 1) out.mid = gain;
    else if (payload[at] === 2) out.treble = gain;
  }
  return out;
}

/* ------------------------------------------------------------------ advanced / parametric EQ (0xF050) */

/** RBJ peaking biquad magnitude (dB) at `f`, fs = 44100, freq & gain rounded like the app. */
function peakingResponseDb(f: number, band: ParametricBand): number {
  const fs = 44100;
  const f0 = Math.round(band.freq);
  const gain = Math.round(band.gain);
  const q = band.q > 0 ? band.q : 1;
  const A = Math.pow(10, gain / 40);
  const w0 = (2 * Math.PI * f0) / fs;
  const alpha = Math.sin(w0) / (2 * q);
  const b0 = 1 + alpha * A;
  const b1 = -2 * Math.cos(w0);
  const b2 = 1 - alpha * A;
  const a0 = 1 + alpha / A;
  const a1 = -2 * Math.cos(w0);
  const a2 = 1 - alpha / A;
  const w = (2 * Math.PI * f) / fs;
  const re = (c0: number, c1: number, c2: number) => c0 + c1 * Math.cos(w) + c2 * Math.cos(2 * w);
  const im = (c1: number, c2: number) => -(c1 * Math.sin(w) + c2 * Math.sin(2 * w));
  const num = Math.hypot(re(b0, b1, b2), im(b1, b2));
  const den = Math.hypot(re(a0, a1, a2), im(a1, a2));
  return 20 * Math.log10(num / den);
}

/** Peak of the summed response curve (grid 20 Hz–20 kHz + band centres), never below 0. */
export function parametricPeakDb(bands: ParametricBand[]): number {
  const freqs: number[] = [];
  for (let i = 0; i < 300; i++) freqs.push(20 * Math.pow(1000, i / 300));
  for (const b of bands) freqs.push(b.freq);
  let peak = 0;
  for (const f of freqs) {
    const sum = bands.reduce((acc, b) => acc + peakingResponseDb(f, b), 0);
    if (sum > peak) peak = sum;
  }
  return peak;
}

/**
 * The device stores peaking filters only (type byte is always 1 in the app), so the UI's
 * shelf types cannot be represented on the wire and are sent as peaking bands.
 */
export function encodeAdvancedEq(bands: ParametricBand[], firmware: string | null): number[] {
  const list = bands.slice(0, 8);
  const peak = parametricPeakDb(list);
  const total = isNewGainFirmware(firmware) ? Math.min(0, 6 - peak) : -(Math.trunc(peak) + 1);
  const out = [0x00, list.length, ...f32le(total)];
  for (const b of list) {
    out.push(0x01, ...f32le(b.gain), ...f32le(b.freq), ...f32le(b.q > 0 ? b.q : 1));
  }
  return out; // 6 + 13n bytes (110 for 8 bands)
}

/* ------------------------------------------------------------------ spatial audio (0xF052) */

export type SpatialMode = 'off' | 'fixed' | 'headTracking' | 'concert' | 'cinema' | 'game';

const SPATIAL_PAYLOAD: Record<SpatialMode, [number, number]> = {
  off: [0x00, 0x00],
  fixed: [0x01, 0x00],
  headTracking: [0x01, 0x01],
  concert: [0x02, 0x00],
  cinema: [0x03, 0x00],
  game: [0x04, 0x00],
};

export function encodeSpatialAudio(mode: SpatialMode): number[] {
  return [...SPATIAL_PAYLOAD[mode]];
}

export function decodeSpatialAudio(payload: number[]): SpatialMode {
  const b0 = payload[0] ?? 0;
  const b1 = payload[1] ?? 0;
  if (b0 === 0 && b1 === 0) return 'off';
  if (b1 === 1) return 'headTracking';
  if (b0 === 1) return 'fixed';
  if (b0 === 2) return 'concert';
  if (b0 === 3) return 'cinema';
  return 'game';
}

/* ------------------------------------------------------------------ high-res codec (0xF01C) */

export function encodeHighQualityAudio(enabled: boolean, device: DeviceCatalogEntry): number[] {
  if (!enabled || !device.highResCodec) return [0x00]; // AAC
  return [device.highResCodec === 'LDAC' ? 0x02 : 0x01];
}

export function decodeHighQualityAudio(payload: number[]): boolean {
  const v = payload[0] ?? 0;
  return v === 0x01 || v === 0x02;
}

/* ------------------------------------------------------------------ gestures (0xF003) */

export type GestureKey = 'doublePinch' | 'triplePinch' | 'pinchHold' | 'doublePinchHold';
export type GestureActionName =
  | 'playPause'
  | 'nextTrack'
  | 'prevTrack'
  | 'noiseControl'
  | 'voiceAssistant'
  | 'volumeUp'
  | 'volumeDown'
  | 'noAction';

export const GESTURE_DEVICE = { left: 0x02, right: 0x03, case: 0x04, body: 0x06 } as const;
const GESTURE_TYPE: Record<GestureKey, number> = {
  doublePinch: 2,
  triplePinch: 3,
  pinchHold: 7,
  doublePinchHold: 9,
};
const BUTTON_MAIN = 0x01;

export const ACTION_OP: Record<GestureActionName, number> = {
  noAction: 1,
  playPause: 2,
  prevTrack: 8,
  nextTrack: 9,
  noiseControl: 22, // ANC ↔ Transparency (app default for hold); 10 = ANC/Transparency/Off cycle
  voiceAssistant: 11,
  volumeUp: 18,
  volumeDown: 19,
};

const OP_ACTION = new Map<number, GestureActionName>([
  [1, 'noAction'],
  [2, 'playPause'],
  [8, 'prevTrack'],
  [9, 'nextTrack'],
  [10, 'noiseControl'],
  [20, 'noiseControl'],
  [21, 'noiseControl'],
  [22, 'noiseControl'],
  [11, 'voiceAssistant'],
  [18, 'volumeUp'],
  [19, 'volumeDown'],
]);

/**
 * Actions the app offers per pinch gesture on TWS buds (ear_white_list.json). Single pinch is fixed
 * to play/pause on the buds, so play/pause is not assignable to these gestures.
 */
export const PINCH_ALLOWED_ACTIONS: Record<GestureKey, GestureActionName[]> = {
  doublePinch: ['nextTrack', 'prevTrack', 'voiceAssistant'],
  triplePinch: ['nextTrack', 'prevTrack', 'voiceAssistant'],
  pinchHold: ['noiseControl', 'volumeUp', 'volumeDown', 'voiceAssistant', 'noAction'],
  doublePinchHold: ['noiseControl', 'volumeUp', 'volumeDown', 'voiceAssistant', 'noAction'],
};

export function supportsPinchGestures(device: DeviceCatalogEntry): boolean {
  return device.formFactor === 'tws';
}

/** One entry per write, like the app's setGesture: `[1, device, button, gesture, op]`. */
export function encodePinchGesture(
  side: 'left' | 'right',
  gesture: GestureKey,
  action: GestureActionName,
): number[] {
  return [
    0x01,
    side === 'left' ? GESTURE_DEVICE.left : GESTURE_DEVICE.right,
    BUTTON_MAIN,
    GESTURE_TYPE[gesture],
    ACTION_OP[action],
  ];
}

export type DecodedGestures = {
  left: Partial<Record<GestureKey, GestureActionName>>;
  right: Partial<Record<GestureKey, GestureActionName>>;
  dialRotateOn: boolean | null;
  dialPress: GestureActionName | null;
};

/** 0xC018 reply: `[count, (device, button, gesture, op)*]`. */
export function decodeGestures(payload: number[]): DecodedGestures {
  const out: DecodedGestures = { left: {}, right: {}, dialRotateOn: null, dialPress: null };
  const count = payload[0] ?? 0;
  const byType = new Map(Object.entries(GESTURE_TYPE).map(([k, v]) => [v, k as GestureKey]));
  for (let i = 0; i < count; i++) {
    const at = 1 + i * 4;
    if (at + 4 > payload.length) break;
    const [dev, btn, gest, op] = payload.slice(at, at + 4);
    const action = OP_ACTION.get(op);
    if (btn === BUTTON_MAIN && (dev === GESTURE_DEVICE.left || dev === GESTURE_DEVICE.right)) {
      const key = byType.get(gest);
      if (key && action) out[dev === GESTURE_DEVICE.left ? 'left' : 'right'][key] = action;
    } else if (dev === GESTURE_DEVICE.case && btn === BUTTON_MAIN) {
      if (gest === 10) out.dialRotateOn = op === 23;
      else if (gest === 1 && action) out.dialPress = action;
    }
  }
  return out;
}

/* ------------------------------------------------------------------ Smart Dial */

/**
 * Only the CMF Buds Pro 2 case dial (device 4, button 1) is writable. On Headphone (1),
 * Headphone Pro and Neckband Pro the dial/roller is fixed by firmware (volume + play/pause).
 */
export function smartDialWritable(device: DeviceCatalogEntry): boolean {
  return device.modelId === 'B172';
}

export const DIAL_PRESS_ALLOWED: GestureActionName[] = [
  'playPause',
  'nextTrack',
  'prevTrack',
  'voiceAssistant',
  'noAction',
];

/** Smart Dial "enabled" = rotate mapped to volume (op 23); off = op 1. */
export function encodeSmartDialRotate(enabled: boolean): number[] {
  return [0x01, GESTURE_DEVICE.case, BUTTON_MAIN, 10, enabled ? 23 : 1];
}

export function encodeSmartDialPress(action: GestureActionName): number[] {
  return [0x01, GESTURE_DEVICE.case, BUTTON_MAIN, 1, ACTION_OP[action]];
}
