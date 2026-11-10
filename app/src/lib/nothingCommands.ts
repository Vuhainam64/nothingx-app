/**
 * Payload encoders for Nothing / CMF earbud commands.
 *
 * Every opcode and byte layout here was verified against the Nothing X 3.10.2 Android app
 * (blutter-disassembled Flutter AOT, `flutter_nothing_link/.../ear/ear_helper.dart` and `cmd/*`).
 * Replies to a request `cmd` come back as `cmd & 0x7FFF` (query 0xC0xx → 0x40xx, set 0xF0xx → ack 0x70xx).
 *
 * This module is pure (no store / catalog access): per-model behaviour is passed in by the caller
 * from `DeviceCapabilities`.
 */
import type { EqPreset, ParametricBand } from './bluetoothProtocol';
import {
  DIRAC_MODE_BYTE,
  GESTURE_OPS,
  type DiracMode,
  type GestureOpName,
  type GestureSlot,
  type SimpleEqShape,
  type FindTarget,
} from './deviceCapabilities';

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
  // Noise control
  GET_ANC: 0xc01e, // [0x03]
  SET_ANC: 0xf00f, // [0x01, mode, 0x00]
  NOTIFY_ANC: 0xe003, // same TLV payload as the 0x401E reply
  GET_PERSONAL_ANC: 0xc020, // → [switch, calibration]
  SET_PERSONAL_ANC: 0xf011, // [switch, calibration]
  FIT_TEST: 0xf014, // [1] start / [0] stop; ack 0x7014 [status]
  FIT_TEST_ACK: 0x7014,
  NOTIFY_FIT_RESULT: 0xe00d, // [left, right]
  // Sound
  GET_BASS_BOOST: 0xc04e, // → [enable, raw]
  SET_BASS_BOOST: 0xf051, // [enable, level*2] (V1) / [enable, level*5] (V2)
  // Settings
  GET_IN_EAR: 0xc00e, // → payload[2] == 1
  SET_IN_EAR: 0xf004, // [0x01, 0x01, enable]
  GET_LOW_LAG: 0xc041, // → [1 on | 2 off]
  SET_LOW_LAG: 0xf040, // [1] on / [2] off
  GET_DUAL: 0xc027, // → [enable]
  SET_DUAL: 0xf01a, // [enable]
  FIND_DEVICE: 0xf002, // [side, on]; 2 = L, 3 = R, 6 = single body
  // Telemetry
  GET_BATTERY: 0xc007,
  NOTIFY_BATTERY: 0xe001,
} as const;

export type HwCommand = { command: number; payload: number[] };

/* ------------------------------------------------------------------ helpers */

function clampInt(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, Math.round(v)));
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

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

/** Round a float read off the wire to 0.1 (f32 noise like 2.4999998 → 2.5). */
const round1 = (v: number) => Math.round(v * 10) / 10;

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

/* ------------------------------------------------------------------ simple toggles */

export type UltraBassEncoding = 'v1' | 'v2';

/**
 * Ultra Bass 0xF051 `[enable, raw]`. V1 raw = level*2, V2 raw = level*5
 * (`useBassBoostV2` = privateCode 247 || ultraBassType 3; resolved by the capabilities).
 */
export function encodeBassBoost(
  enabled: boolean,
  level: number,
  encoding: UltraBassEncoding = 'v1',
  maxLevel = 5,
): number[] {
  const lvl = clampInt(level, 1, Math.max(1, maxLevel));
  return [enabled ? 0x01 : 0x00, lvl * (encoding === 'v2' ? 5 : 2)];
}

/** 0x404E reply. V1: level = raw/2, 0 → 5 (app default). V2: level = raw/5. */
export function decodeBassBoost(
  payload: number[],
  encoding: UltraBassEncoding = 'v1',
  maxLevel = 5,
): { enabled: boolean; level: number } | null {
  if (payload.length < 2) return null;
  const raw = payload[1];
  let level: number;
  if (encoding === 'v2') level = Math.round(raw / 5);
  else level = raw === 0 ? 5 : Math.round(raw / 2);
  level = clampInt(level, 1, Math.max(1, maxLevel));
  return { enabled: payload[0] === 0x01, level };
}

export function encodeInEarDetection(enabled: boolean): number[] {
  return [0x01, 0x01, enabled ? 0x01 : 0x00];
}

export function decodeInEarDetection(payload: number[]): boolean | null {
  return payload.length >= 3 ? payload[2] === 0x01 : null;
}

export function encodeLowLag(enabled: boolean): number[] {
  return [enabled ? 0x01 : 0x02];
}

export function decodeLowLag(payload: number[]): boolean | null {
  return payload.length ? payload[0] === 0x01 : null;
}

export function encodeDualConnection(enabled: boolean): number[] {
  return [enabled ? 0x01 : 0x00];
}

export function decodeDualConnection(payload: number[]): boolean | null {
  return payload.length ? payload[0] === 0x01 : null;
}

/** Personalised ANC keeps the device's calibration byte; only the switch is toggled. */
export function encodePersonalAnc(enabled: boolean, calibration: number | null): number[] {
  return calibration === null ? [enabled ? 0x01 : 0x00] : [enabled ? 0x01 : 0x00, calibration];
}

export function decodePersonalAnc(payload: number[]): { enabled: boolean; calibration: number | null } | null {
  if (!payload.length) return null;
  return { enabled: payload[0] === 0x01, calibration: payload.length > 1 ? payload[1] : null };
}

/** Find 0xF002 `[side, on]`: 2 = left, 3 = right, 6 = single body (headphone / neckband). */
export const FIND_TARGET_ID: Record<FindTarget, number> = { left: 0x02, right: 0x03, body: 0x06 };

export function encodeFindDevice(target: FindTarget, on: boolean): number[] {
  return [FIND_TARGET_ID[target], on ? 0x01 : 0x00];
}

/* ------------------------------------------------------------------ ear-tip fit test */

export type FitCode = 'good' | 'poor' | 'notWorn' | 'inCall' | 'busy';
/** Per-ear result codes (objs.txt): 0 success, 1 fail, 2 unWear, 3 calling, 4 repeatedOperationError. */
const FIT_CODES: FitCode[] = ['good', 'poor', 'notWorn', 'inCall', 'busy'];

export function encodeFitTest(start: boolean): number[] {
  return [start ? 0x01 : 0x00];
}

/** 0xE00D notification `[left, right]`. Unknown codes → null. */
export function decodeFitResult(payload: number[]): { left: FitCode; right: FitCode } | null {
  if (payload.length < 2) return null;
  const l = FIT_CODES[payload[0]];
  const r = FIT_CODES[payload[1]];
  return l && r ? { left: l, right: r } : null;
}

export type FitStartStatus = 'ok' | 'anotherTesting' | 'other' | 'personalSoundTesting';

/** 0x7014 ack `[status]`: 0 success, 1 another test running, 3 personal-sound test, else other. */
export function decodeFitStartAck(payload: number[]): FitStartStatus | null {
  if (!payload.length) return null;
  switch (payload[0]) {
    case 0:
      return 'ok';
    case 1:
      return 'anotherTesting';
    case 3:
      return 'personalSoundTesting';
    default:
      return 'other';
  }
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

export interface EqModeOptions {
  /** Model has 8-band advanced EQ (0xF04F is only ever sent when true). */
  advancedEq: boolean;
  /** Dirac mode to send with 0xF01D when the target is `diracOpteo`. */
  diracMode?: DiracMode;
  /** Wire byte for `voice` (1, or 6 when the device reported newVoice). */
  voiceByte?: number;
}

/**
 * Command sequence to switch the device to `preset`, mirroring `setSimpleMode` in
 * ear_eq_repository.dart:
 * - advanced → F04F [01] (no F010);
 * - Dirac → (F04F [00] if advanced may be on) then F01D [diracMode];
 * - anything else → (F04F [00] if advanced may be on) then F010 [mode].
 * `applied` is the last preset actually applied on the device (null = unknown, treated as
 * "advanced may be on"). Does not upload band values (callers prepend F041/F050).
 */
export function eqPresetCommands(
  preset: EqPreset,
  applied: EqPreset | null,
  opts: EqModeOptions,
): HwCommand[] {
  if (preset === 'advanced') {
    return opts.advancedEq ? [{ command: OP.SET_ADVANCE_EQ_MODE, payload: [0x01] }] : [];
  }
  const out: HwCommand[] = [];
  if (opts.advancedEq && (applied === 'advanced' || applied === null)) {
    out.push({ command: OP.SET_ADVANCE_EQ_MODE, payload: [0x00] });
  }
  if (preset === 'diracOpteo') {
    out.push({ command: OP.SET_DIRAC_EQ, payload: encodeDiracMode(opts.diracMode ?? 'opteo') });
    return out;
  }
  const mode: Record<Exclude<EqPreset, 'advanced' | 'diracOpteo'>, number> = {
    balanced: EQ_MODE.balanced,
    voice: opts.voiceByte ?? EQ_MODE.voice,
    moreTreble: EQ_MODE.moreTreble,
    moreBass: EQ_MODE.moreBass,
    custom: EQ_MODE.simpleCustomEq,
  };
  out.push({ command: OP.SET_EQ_MODE, payload: [mode[preset]] });
  return out;
}

/**
 * 0xC01F reply byte → preset. newVoice (6) maps to `voice` (callers remember the byte so
 * re-selecting sends 6); newInstrument (7) and 0xFF (invalid) → null.
 */
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

/** 0xC04C reply: advanced EQ on when payload[0] == 1. */
export function decodeAdvancedEqMode(payload: number[]): boolean | null {
  return payload.length ? payload[0] === 0x01 : null;
}

/* ------------------------------------------------------------------ Dirac Opteo (0xF01D) */

export function encodeDiracMode(mode: DiracMode): number[] {
  return [DIRAC_MODE_BYTE[mode]];
}

/** 0xC050 reply `[diracMode]` → mode (null when out of range). */
export function decodeDiracMode(payload: number[]): DiracMode | null {
  if (!payload.length) return null;
  for (const [mode, byte] of Object.entries(DIRAC_MODE_BYTE) as [DiracMode, number][]) {
    if (byte === payload[0]) return mode;
  }
  return null;
}

/* ------------------------------------------------------------------ simple 3-band custom EQ (0xF041) */

export type SimpleEqBands = { bass: number; mid: number; treble: number };

/** Fixed filter parameters hardcoded in nt_ear_simple_custom_equaliser.dart buildSetPayload. */
export const DEFAULT_SIMPLE_EQ_SHAPE: SimpleEqShape = {
  freqLow: 140,
  qLow: 0.8,
  freqPeak: 980,
  qPeak: 0.7,
  freqHigh: 6900,
  qHigh: 1.0,
};

/**
 * 44-byte payload: `[3][f32 total]` then records in the app's order
 * mid (type 1, peak), treble (type 2, high), bass (type 0, low): `u8 type | f32 gain | f32 freq | f32 Q`.
 */
export function encodeSimpleCustomEq(
  bands: SimpleEqBands,
  firmware: string | null,
  shape: SimpleEqShape = DEFAULT_SIMPLE_EQ_SHAPE,
): number[] {
  const g = {
    bass: clamp(bands.bass, -6, 6),
    mid: clamp(bands.mid, -6, 6),
    treble: clamp(bands.treble, -6, 6),
  };
  const maxGain = Math.max(g.bass, g.mid, g.treble);
  const total = isNewGainFirmware(firmware) ? maxGain : maxGain > 0 ? -maxGain : 0;
  const records = [
    { type: 1, gain: g.mid, freq: shape.freqPeak, q: shape.qPeak },
    { type: 2, gain: g.treble, freq: shape.freqHigh, q: shape.qHigh },
    { type: 0, gain: g.bass, freq: shape.freqLow, q: shape.qLow },
  ];
  const out = [records.length, ...f32le(total)];
  for (const rec of records) {
    out.push(rec.type, ...f32le(rec.gain), ...f32le(rec.freq), ...f32le(rec.q));
  }
  return out; // 1 + 4 + 3*13 = 44 bytes
}

/** 0xC044 reply → gains (records read by type byte, not position; 0.1 dB precision). */
export function decodeSimpleCustomEq(payload: number[]): SimpleEqBands | null {
  if (payload.length < 5) return null;
  const count = payload[0];
  const out: SimpleEqBands = { bass: 0, mid: 0, treble: 0 };
  let any = false;
  for (let i = 0; i < count; i++) {
    const at = 5 + i * 13;
    if (at + 13 > payload.length) break;
    const raw = readF32le(payload, at + 1);
    if (!Number.isFinite(raw)) continue;
    const gain = clamp(round1(raw), -6, 6);
    if (payload[at] === 0) out.bass = gain;
    else if (payload[at] === 1) out.mid = gain;
    else if (payload[at] === 2) out.treble = gain;
    else continue;
    any = true;
  }
  return any ? out : null;
}

/* ------------------------------------------------------------------ advanced / parametric EQ (0xF050) */

/** RBJ peaking biquad magnitude (dB) at `f`, fs = 44100, freq & gain rounded like the app. */
function peakingResponseDb(f: number, band: ParametricBand): number {
  const fs = 44100;
  // `_peakingMatrixFromBand`: fc clamped to 20..20000, Q ≤ 0 replaced with 0.1.
  const f0 = clamp(Math.round(band.freq), 20, 20000);
  const gain = Math.round(band.gain);
  const q = band.q > 0 ? band.q : 0.1;
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

/** Max bands in the main advanced set (provider caps at 8 points). */
export const ADVANCED_EQ_MAX_BANDS = 8;

/**
 * 0xF050 `[00][n][f32 total][n × (u8 type=1 | f32 gain | f32 freq | f32 Q)]`.
 * The device stores peaking filters only (type byte is always 1 in the app), so UI shelf types
 * are sent as peaking bands. Total gain follows the firmware rule (`totalGainForWaveDispatch`).
 */
export function encodeAdvancedEq(bands: ParametricBand[], firmware: string | null): number[] {
  const list = bands.slice(0, ADVANCED_EQ_MAX_BANDS);
  const peak = parametricPeakDb(list);
  const total = isNewGainFirmware(firmware) ? Math.min(0, 6 - peak) : -(Math.trunc(peak) + 1);
  const out = [0x00, list.length, ...f32le(total)];
  for (const b of list) {
    out.push(0x01, ...f32le(b.gain), ...f32le(b.freq), ...f32le(b.q > 0 ? b.q : 1));
  }
  return out; // 6 + 13n bytes (110 for 8 bands)
}

/** 0xC04D query payload: profile index 0 (both app callers pass 0). */
export const ADVANCED_EQ_QUERY_PAYLOAD = [0x00];

/**
 * 0xC04D reply → bands. `[profile][count][f32 total]` then 13-byte records. A count of 0 means
 * "factory default" → null (keep local bands). Q 0 is read as 1.0 like the app.
 */
export function decodeAdvancedEq(payload: number[]): ParametricBand[] | null {
  if (payload.length < 6) return null;
  const count = payload[1];
  if (count === 0) return null;
  const out: ParametricBand[] = [];
  for (let i = 0; i < count && out.length < ADVANCED_EQ_MAX_BANDS; i++) {
    const at = 6 + i * 13;
    if (at + 13 > payload.length) break;
    const gain = readF32le(payload, at + 1);
    const freq = readF32le(payload, at + 5);
    const q = readF32le(payload, at + 9);
    if (!Number.isFinite(gain) || !Number.isFinite(freq) || freq <= 0) continue;
    out.push({
      freq: Math.round(freq),
      gain: round1(gain),
      q: Number.isFinite(q) && q > 0 ? Math.round(q * 100) / 100 : 1,
      type: 'peak',
    });
  }
  return out.length >= 2 ? out : null;
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

export type HighResCodecName = 'ldac' | 'lhdc';

/**
 * Codec the model uses for "Hi-Res on". The official app has no documented preference when a
 * model supports both, so LDAC is preferred; null when the model has no hi-res codec.
 */
export function preferredHighResCodec(codecs: readonly HighResCodecName[]): HighResCodecName | null {
  if (codecs.includes('ldac')) return 'ldac';
  if (codecs.includes('lhdc')) return 'lhdc';
  return null;
}

/** `[0]` AAC (off), `[1]` LHDC, `[2]` LDAC. */
export function encodeHighQualityAudio(enabled: boolean, codecs: readonly HighResCodecName[]): number[] {
  const codec = enabled ? preferredHighResCodec(codecs) : null;
  if (!codec) return [0x00];
  return [codec === 'ldac' ? 0x02 : 0x01];
}

export function decodeHighQualityAudio(payload: number[]): boolean {
  const v = payload[0] ?? 0;
  return v === 0x01 || v === 0x02;
}

/* ------------------------------------------------------------------ gestures (0xF003 / 0xC018) */

/** Stable slot key used in store state (matches `GestureSlot.id`). */
export function gestureSlotId(device: number, button: number, gesture: number): string {
  return `${device}-${button}-${gesture}`;
}

// Built lazily so this module never touches deviceCapabilities values at import time.
let opNameByCode: Map<number, GestureOpName> | null = null;

/** Operation byte → name (exact; 10/20/21/22 stay distinct). Unknown codes → null. */
export function gestureOpFromCode(code: number): GestureOpName | null {
  opNameByCode ??= new Map(
    (Object.entries(GESTURE_OPS) as [GestureOpName, number][]).map(([name, code]) => [code, name]),
  );
  return opNameByCode.get(code) ?? null;
}

/** One entry per write, like the app's setGesture: `[1, device, button, gesture, op]`. */
export function encodeGesture(
  slot: Pick<GestureSlot, 'device' | 'button' | 'gesture'>,
  op: GestureOpName,
): number[] {
  return [0x01, slot.device, slot.button, slot.gesture, GESTURE_OPS[op]];
}

export interface GestureEntry {
  device: number;
  button: number;
  gesture: number;
  op: number;
}

/** 0xC018 reply: `[count, (device, button, gesture, op)*]`. */
export function decodeGestureEntries(payload: number[]): GestureEntry[] {
  const out: GestureEntry[] = [];
  const count = payload[0] ?? 0;
  for (let i = 0; i < count; i++) {
    const at = 1 + i * 4;
    if (at + 4 > payload.length) break;
    const [device, button, gesture, op] = payload.slice(at, at + 4);
    out.push({ device, button, gesture, op });
  }
  return out;
}

/**
 * Decode a 0xC018 reply into `{ slotId: op }` for the given slots only. Ops not known to
 * GESTURE_OPS are skipped; known ops are kept exactly as reported (even if outside `allowed`).
 */
export function decodeGestures(
  payload: number[],
  slots: readonly GestureSlot[],
): Record<string, GestureOpName> {
  const ids = new Set(slots.map((s) => s.id));
  const out: Record<string, GestureOpName> = {};
  for (const e of decodeGestureEntries(payload)) {
    const id = gestureSlotId(e.device, e.button, e.gesture);
    if (!ids.has(id)) continue;
    const name = gestureOpFromCode(e.op);
    if (name) out[id] = name;
  }
  return out;
}
