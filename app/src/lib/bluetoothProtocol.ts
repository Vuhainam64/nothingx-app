export type AncMode = 'anc' | 'transparency' | 'off';
export type AncLevel = 'high' | 'mid' | 'low' | 'adaptive';

export type EqPreset =
  | 'balanced'
  | 'moreBass'
  | 'moreTreble'
  | 'voice'
  | 'diracOpteo'
  | 'custom'
  | 'advanced';

export interface ParametricBand {
  freq: number;
  gain: number;
  q: number;
  type: 'peak' | 'lowShelf' | 'highShelf';
}

export interface BatteryState {
  left: number;
  leftCharging: boolean;
  right: number;
  rightCharging: boolean;
  caseLevel: number;
  caseCharging: boolean;
}

export function crc16Modbus(bytes: Uint8Array): number {
  let crc = 0xffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i] & 0xff;
    for (let bit = 0; bit < 8; bit++) {
      if ((crc & 0x0001) !== 0) {
        crc = (crc >>> 1) ^ 0xa001;
      } else {
        crc = crc >>> 1;
      }
    }
  }
  return crc & 0xffff;
}

/** Wire byte for ANC/transparency/off as used by command 0xF00F / status 0xC01E. */
const ANC_LEVEL_BYTES: Record<AncLevel, number> = {
  high: 0x01,
  mid: 0x02,
  low: 0x03,
  adaptive: 0x04,
};
const ANC_OFF_BYTE = 0x05;
const ANC_TRANSPARENCY_BYTE = 0x07;

export function ancByte(mode: AncMode, level: AncLevel): number {
  if (mode === 'off') return ANC_OFF_BYTE;
  if (mode === 'transparency') return ANC_TRANSPARENCY_BYTE;
  return ANC_LEVEL_BYTES[level] ?? ANC_LEVEL_BYTES.high;
}

/** Inverse of {@link ancByte} for one mode byte. `level` is null for off/transparency (keep current level). */
export function ancFromByte(b: number): { mode: AncMode; level: AncLevel | null } | null {
  if (b === 0x00 || b === ANC_OFF_BYTE) return { mode: 'off', level: null };
  if (b === ANC_TRANSPARENCY_BYTE || b === 0xfe) return { mode: 'transparency', level: null };
  for (const [level, byte] of Object.entries(ANC_LEVEL_BYTES) as [AncLevel, number][]) {
    if (byte === b) return { mode: 'anc', level };
  }
  return null;
}

function ancLevelFromByte(b: number): AncLevel | null {
  for (const [level, byte] of Object.entries(ANC_LEVEL_BYTES) as [AncLevel, number][]) {
    if (byte === b) return level;
  }
  return null;
}

/**
 * Parse a 0x401E reply / 0xE003 notification: a sequence of 3-byte TLVs `[type, value, x]`
 * (`NtEarAnc.parser`). type 1 = mode (1-4 ANC + level, 0/5 off, 7/0xFE transparency, others
 * ignored); type 2 = level only (1-4). Other types are ignored. `mode` / `level` are null when
 * the payload did not report them. Returns null when nothing usable was found.
 */
export function parseAncPayload(
  payload: ArrayLike<number> | null | undefined,
): { mode: AncMode | null; level: AncLevel | null } | null {
  if (!payload || payload.length < 3) return null;
  let mode: AncMode | null = null;
  let level: AncLevel | null = null;
  for (let i = 0; i + 3 <= payload.length; i += 3) {
    const type = payload[i];
    const value = payload[i + 1];
    if (type === 0x01) {
      const parsed = ancFromByte(value);
      if (parsed) {
        mode = parsed.mode;
        if (parsed.level) level = parsed.level;
      }
    } else if (type === 0x02) {
      const l = ancLevelFromByte(value);
      if (l) level = l;
    }
  }
  return mode === null && level === null ? null : { mode, level };
}

/** Frame returned by the Rust `send_bluetooth_command` invoke (serde default field names). */
export interface NothingFrame {
  sof: number;
  control: number;
  command: number;
  length: number;
  fsn: number;
  payload: number[];
  crc16: number | null;
  raw_bytes: number[];
}

export interface ParsedBattery {
  left: number | null;
  leftCharging: boolean;
  right: number | null;
  rightCharging: boolean;
  caseLevel: number | null;
  caseCharging: boolean;
  singleBattery: boolean;
}

/**
 * Parse a 0x4007 battery reply / 0xE001 notification (`NtEarBattery.parser`):
 * payload[0] = count (ignored, like the app), then `(id, raw)` pairs walked by payload length;
 * level = raw & 0x7F, charging = raw & 0x80. Ids: 2 left, 3 right, 4 case, 1/6/7 single battery
 * (headphone, neckband, speaker); 5 and unknown ids are ignored.
 */
export function parseBatteryPayload(payload: ArrayLike<number> | null | undefined): ParsedBattery | null {
  if (!payload || payload.length < 3) return null;
  const out: ParsedBattery = {
    left: null,
    leftCharging: false,
    right: null,
    rightCharging: false,
    caseLevel: null,
    caseCharging: false,
    singleBattery: false,
  };
  let any = false;
  for (let idx = 1; idx + 1 < payload.length; idx += 2) {
    const id = payload[idx];
    const raw = payload[idx + 1];
    const level = raw & 0x7f;
    const charging = (raw & 0x80) !== 0;
    switch (id) {
      case 0x02:
        out.left = level;
        out.leftCharging = charging;
        any = true;
        break;
      case 0x03:
        out.right = level;
        out.rightCharging = charging;
        any = true;
        break;
      case 0x04:
        out.caseLevel = level;
        out.caseCharging = charging;
        any = true;
        break;
      case 0x01:
      case 0x06:
      case 0x07:
        out.singleBattery = true;
        out.left = level;
        out.leftCharging = charging;
        out.right = level;
        out.rightCharging = charging;
        out.caseLevel = 0;
        out.caseCharging = false;
        any = true;
        break;
      default:
        break;
    }
  }
  return any ? out : null;
}
