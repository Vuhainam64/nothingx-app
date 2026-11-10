import { useMemo } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { toast } from 'sonner';
import i18n from '@/i18n';
import {
  DEVICE_CATALOG,
  type DeviceCatalogEntry,
  type DeviceColorVariant,
} from './deviceCatalog';
import {
  ancByte,
  parseAncPayload,
  parseBatteryPayload,
  type AncMode,
  type AncLevel,
  type EqPreset,
  type ParametricBand,
  type BatteryState,
  type NothingFrame,
  type ParsedBattery,
} from './bluetoothProtocol';
import {
  getDeviceCapabilities,
  type DeviceCapabilities,
  type DiracMode,
  type FindTarget,
  type GestureOpName,
} from './deviceCapabilities';
import { isDesktop } from './isDesktop';
import {
  OP,
  EQ_MODE,
  eqPresetCommands,
  eqPresetFromMode,
  decodeAdvancedEqMode,
  decodeDiracMode,
  encodeSimpleCustomEq,
  decodeSimpleCustomEq,
  encodeAdvancedEq,
  decodeAdvancedEq,
  ADVANCED_EQ_QUERY_PAYLOAD,
  ADVANCED_EQ_MAX_BANDS,
  encodeSpatialAudio,
  decodeSpatialAudio,
  encodeHighQualityAudio,
  decodeHighQualityAudio,
  encodeGesture,
  decodeGestures,
  encodeBassBoost,
  decodeBassBoost,
  encodeInEarDetection,
  decodeInEarDetection,
  encodeLowLag,
  decodeLowLag,
  encodeDualConnection,
  decodeDualConnection,
  encodePersonalAnc,
  decodePersonalAnc,
  encodeFindDevice,
  encodeFitTest,
  decodeFitResult,
  decodeFitStartAck,
  type FitCode,
  type SpatialMode,
  type HwCommand,
} from './nothingCommands';

export type { FitCode } from './nothingCommands';
export type SpatialAudioMode = SpatialMode;
export type AppViewMode = 'full' | 'mini';
export type AutoDetectStatus = 'scanning' | 'detected' | 'not_found';
/** @deprecated use FitCode */
export type EarFitStatus = FitCode;
export interface EarFitResult {
  left: FitCode;
  right: FitCode;
}

export interface DetectedNothingDevice {
  name: string;
  mac_address: string;
  mac_u64: number;
  connected: boolean;
  remembered: boolean;
  /** Best model id (C01C > Fast Pair > name); may be absent from DEVICE_CATALOG. */
  matched_model_id: string;
  matched_color_sku: string | null;
  fast_pair_id: string | null;
  /** Model code read over the Nothing link (0xC01C), e.g. "B171". */
  device_model_code?: string | null;
  /** Color id read over the Nothing link (0xC00C), 2-digit hex e.g. "01". */
  device_color_id?: string | null;
  firmware_version: string | null;
  serial_number: string | null;
  battery_left: number | null;
  battery_left_charging: boolean;
  battery_right: number | null;
  battery_right_charging: boolean;
  battery_case: number | null;
  battery_case_charging: boolean;
  is_headphone_single_battery: boolean;
  anc_raw: number[] | null;
  eq_preset_index: number | null;
}

export interface BluetoothScanResult {
  devices: DetectedNothingDevice[];
  active_device: DetectedNothingDevice | null;
}

export const DEFAULT_PARAMETRIC_BANDS: ParametricBand[] = [
  { freq: 32, gain: 2.0, q: 0.7, type: 'peak' },
  { freq: 64, gain: 1.5, q: 1.0, type: 'peak' },
  { freq: 125, gain: 0.0, q: 1.2, type: 'peak' },
  { freq: 250, gain: -0.5, q: 1.4, type: 'peak' },
  { freq: 500, gain: 0.0, q: 1.2, type: 'peak' },
  { freq: 1000, gain: 1.0, q: 1.0, type: 'peak' },
  { freq: 4000, gain: 2.5, q: 1.2, type: 'peak' },
  { freq: 12000, gain: 1.5, q: 0.8, type: 'peak' },
];

const DEFAULT_CUSTOM_BANDS = { bass: 3, mid: 0, treble: 2 };

export function getCurrentDevice(modelId: string): DeviceCatalogEntry {
  return DEVICE_CATALOG.find((d) => d.modelId === modelId) ?? DEVICE_CATALOG[0];
}

export function getCurrentColor(
  device: DeviceCatalogEntry,
  sku: string,
): DeviceColorVariant {
  return device.colors.find((c) => c.sku === sku) ?? device.colors[0];
}

// ---------------------------------------------------------------------------
// Capabilities
// ---------------------------------------------------------------------------

let capsCache: { key: string; caps: DeviceCapabilities } | null = null;

/** Memoised (single entry) capabilities lookup; `getDeviceCapabilities` is pure. */
function capsFor(modelId: string, firmware: string | null): DeviceCapabilities {
  const key = `${modelId}\u0000${firmware ?? ''}`;
  if (capsCache?.key === key) return capsCache.caps;
  const caps = getDeviceCapabilities(modelId, firmware);
  capsCache = { key, caps };
  return caps;
}

function currentCaps(): DeviceCapabilities {
  const { selectedModelId, firmwareVersion } = useDeviceStore.getState();
  return capsFor(selectedModelId, firmwareVersion);
}

/** Capabilities of the selected model + firmware (memoised on both). */
export function useCapabilities(): DeviceCapabilities {
  const modelId = useDeviceStore((s) => s.selectedModelId);
  const firmware = useDeviceStore((s) => s.firmwareVersion);
  return useMemo(() => getDeviceCapabilities(modelId, firmware), [modelId, firmware]);
}

function isDiracOnly(caps: DeviceCapabilities): boolean {
  return !!caps.dirac?.replacesEq;
}

/** Whether `preset` can be selected on this model. */
function presetSupported(caps: DeviceCapabilities, preset: EqPreset): boolean {
  if (preset === 'diracOpteo') return !!caps.dirac;
  if (isDiracOnly(caps)) return false;
  if (preset === 'advanced') return caps.advancedEq;
  if (preset === 'custom') return caps.simpleCustomEq !== null || caps.eqPresets.includes('custom');
  return caps.eqPresets.includes(preset);
}

function defaultPreset(caps: DeviceCapabilities): EqPreset {
  if (isDiracOnly(caps)) return 'diracOpteo';
  if (caps.eqPresets.includes('balanced')) return 'balanced';
  return caps.eqPresets[0] ?? 'balanced';
}

function defaultDiracMode(caps: DeviceCapabilities): DiracMode {
  const modes = caps.dirac?.modes ?? [];
  return modes.includes('opteo') ? 'opteo' : (modes[0] ?? 'opteo');
}

function defaultGestures(caps: DeviceCapabilities): Record<string, GestureOpName> {
  const out: Record<string, GestureOpName> = {};
  for (const slot of caps.gestureSlots) out[slot.id] = slot.defaultOp;
  return out;
}

const emptyRinging = (): Record<FindTarget, boolean> => ({ left: false, right: false, body: false });

/**
 * Bring device-specific state in line with `caps`. With `reset` (model changed) the per-device
 * values go back to the model's defaults; otherwise only invalid values are replaced.
 */
function normalizeForCaps(
  s: DeviceStoreState,
  caps: DeviceCapabilities,
  reset: boolean,
): Partial<DeviceStoreState> {
  const patch: Partial<DeviceStoreState> = {};

  if (reset || !presetSupported(caps, s.eqPreset)) patch.eqPreset = defaultPreset(caps);
  if (caps.dirac) {
    if (reset || !caps.dirac.modes.includes(s.diracMode)) patch.diracMode = defaultDiracMode(caps);
  }

  if (reset || (s.spatialAudio !== 'off' && !caps.spatialModes.includes(s.spatialAudio))) {
    patch.spatialAudio = 'off';
  }

  const gestures = defaultGestures(caps);
  if (!reset) {
    for (const slot of caps.gestureSlots) {
      const cur = s.gestures[slot.id];
      if (cur && slot.allowed.includes(cur)) gestures[slot.id] = cur;
    }
  }
  patch.gestures = gestures;

  if (s.ancMode === 'anc' && !caps.anc) patch.ancMode = caps.transparency ? 'transparency' : 'off';
  if (s.ancMode === 'transparency' && !caps.transparency) patch.ancMode = caps.anc ? 'anc' : 'off';
  if (caps.ancLevels.length && !caps.ancLevels.includes(s.ancLevel)) patch.ancLevel = caps.ancLevels[0];

  if (!caps.ultraBass) {
    if (s.ultraBassEnabled) patch.ultraBassEnabled = false;
  } else if (s.ultraBassLevel < 1 || s.ultraBassLevel > caps.ultraBass.maxLevel) {
    patch.ultraBassLevel = Math.min(caps.ultraBass.maxLevel, Math.max(1, Math.round(s.ultraBassLevel)));
  }
  if (!caps.highResCodecs.length && s.highResCodec) patch.highResCodec = false;
  if (!caps.personalAnc && s.personalAnc) patch.personalAnc = false;
  if (!caps.lowLatency && s.lowLatencyMode) patch.lowLatencyMode = false;
  if (!caps.dualConnection && s.dualConnection) patch.dualConnection = false;
  if (!caps.inEarDetection && s.inEarDetection) patch.inEarDetection = false;

  return patch;
}

// ---------------------------------------------------------------------------
// Tauri helpers
// ---------------------------------------------------------------------------

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
}

/** Fire-and-forget invoke: skipped outside Tauri, errors swallowed. */
async function safeInvoke(cmd: string, args?: Record<string, unknown>): Promise<void> {
  if (!isDesktop()) return;
  try {
    await tauriInvoke(cmd, args);
  } catch {
    // ignore (backend may not implement the command yet)
  }
}

async function applyAlwaysOnTop(enabled: boolean) {
  if (!isDesktop()) return;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().setAlwaysOnTop(enabled);
  } catch {
    // ignore
  }
}

/**
 * Apply window size limits / placement for a view mode. `resize: false` (startup in full mode)
 * only enforces the min size and always-on-top flag, keeping the size the window opened with.
 */
async function applyWindowGeometryForMode(
  mode: AppViewMode,
  alwaysOnTopMini: boolean,
  opts: { resize?: boolean } = {},
) {
  const resize = opts.resize ?? true;
  if (isDesktop()) {
    try {
      const { getCurrentWindow, LogicalSize, LogicalPosition } = await import(
        '@tauri-apps/api/window'
      );
      const win = getCurrentWindow();
      if (mode === 'mini') {
        await win.setMinSize(new LogicalSize(360, 520));
        await win.setSize(new LogicalSize(390, 600));
        await win.setAlwaysOnTop(alwaysOnTopMini);
        const availW = window.screen.availWidth || 1920;
        const availH = window.screen.availHeight || 1040;
        await win.setPosition(new LogicalPosition(availW - 410, availH - 620));
      } else {
        await win.setAlwaysOnTop(false);
        await win.setMinSize(new LogicalSize(1024, 680));
        if (resize) {
          await win.setSize(new LogicalSize(1280, 840));
          await win.center();
        }
      }
      return;
    } catch {
      // fallback to browser window APIs
    }
  }

  if (!resize && mode === 'full') return;
  try {
    if (mode === 'mini') {
      const w = 400;
      const h = 640;
      const left = Math.max(0, window.screen.availWidth - w - 16);
      const top = Math.max(0, window.screen.availHeight - h - 16);
      window.resizeTo(w, h);
      window.moveTo(left, top);
    } else {
      const w = 1280;
      const h = 840;
      const left = Math.max(0, Math.round((window.screen.availWidth - w) / 2));
      const top = Math.max(0, Math.round((window.screen.availHeight - h) / 2));
      window.resizeTo(w, h);
      window.moveTo(left, top);
    }
  } catch {
    // Standard browser tab may ignore resizeTo
  }
}

// ---------------------------------------------------------------------------
// Audio helpers
// ---------------------------------------------------------------------------

let findAudioPlayer: HTMLAudioElement | null = null;
let fitTestAudioPlayer: HTMLAudioElement | null = null;

function setFindTonePlaying(play: boolean) {
  if (typeof window === 'undefined') return;
  try {
    if (play) {
      if (!findAudioPlayer) {
        findAudioPlayer = new Audio('/assets/voice/find.m4a');
        findAudioPlayer.loop = true;
      }
      findAudioPlayer.currentTime = 0;
      void findAudioPlayer.play().catch(() => {});
    } else if (findAudioPlayer) {
      findAudioPlayer.pause();
      findAudioPlayer.currentTime = 0;
    }
  } catch {
    // ignore audio playback restriction
  }
}

function playFitTestAudio() {
  if (typeof window === 'undefined') return;
  try {
    if (!fitTestAudioPlayer) {
      fitTestAudioPlayer = new Audio('/assets/voice/self_check_volume.mp3');
    }
    fitTestAudioPlayer.currentTime = 0;
    void fitTestAudioPlayer.play().catch(() => {});
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Errors / toasts
// ---------------------------------------------------------------------------

function errorMessage(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function reportCommandError(err: unknown) {
  const msg = errorMessage(err);
  useDeviceStore.setState({ lastCommandError: msg });
  try {
    toast.error(i18n.t('errors.commandFailed'), {
      id: 'nothingx-command-error',
      description: msg,
    });
  } catch {
    // ignore toast failures
  }
}

function toastError(key: string, fallback: string, id: string) {
  try {
    toast.error(i18n.t(key, { defaultValue: fallback }), { id });
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Hardware command channel
// ---------------------------------------------------------------------------

function isHardwareActive(): boolean {
  const { connectionMode, activeMacU64 } = useDeviceStore.getState();
  return isDesktop() && connectionMode === 'connected' && !!activeMacU64;
}

type SendResult = { ok: boolean; frame: NothingFrame | null };

/**
 * Send a Nothing Link command to the active device. Only sends when actually connected
 * (connectionMode === 'connected' and a MAC is set); otherwise resolves `{ ok: false }`.
 * `ok` = the backend accepted the write (a missing reply is not a failure).
 * Failures are surfaced via `lastCommandError` + toast unless `silent`.
 */
async function sendCommand(
  command: number,
  payload: number[] = [],
  opts: { silent?: boolean } = {},
): Promise<SendResult> {
  const { activeMacU64 } = useDeviceStore.getState();
  if (!isHardwareActive() || !activeMacU64) return { ok: false, frame: null };
  try {
    const frame = await tauriInvoke<NothingFrame | null>('send_bluetooth_command', {
      macU64: activeMacU64,
      command,
      payload,
    });
    return { ok: true, frame: frame ?? null };
  } catch (err) {
    if (!opts.silent && useDeviceStore.getState().connectionMode === 'connected') {
      reportCommandError(err);
    }
    return { ok: false, frame: null };
  }
}

async function sendHardwareCommand(
  command: number,
  payload: number[] = [],
  opts: { silent?: boolean } = {},
): Promise<NothingFrame | null> {
  return (await sendCommand(command, payload, opts)).frame;
}

/** Send several commands in order; stops at the first failed step. Returns true if all were sent. */
async function sendHardwareCommands(list: HwCommand[]): Promise<boolean> {
  for (const c of list) {
    const r = await sendCommand(c.command, c.payload);
    if (!r.ok) return false;
  }
  return true;
}

// Sliders fire onChange on every tick; the backend serialises commands per device and a write
// with no reply waits ~800ms, so only the last value within the window is sent.
const debouncedCommandTimers = new Map<number, ReturnType<typeof setTimeout>>();
function sendHardwareCommandDebounced(command: number, build: () => number[] | null, delayMs = 250) {
  const prev = debouncedCommandTimers.get(command);
  if (prev) clearTimeout(prev);
  debouncedCommandTimers.set(
    command,
    setTimeout(() => {
      debouncedCommandTimers.delete(command);
      const payload = build();
      if (payload) void sendHardwareCommand(command, payload);
    }, delayMs),
  );
}

function cancelDebouncedCommands() {
  for (const t of debouncedCommandTimers.values()) clearTimeout(t);
  debouncedCommandTimers.clear();
}

// ---------------------------------------------------------------------------
// Per-device module state (reset whenever the device / link changes)
// ---------------------------------------------------------------------------

/** Calibration byte from 0xC020, echoed back on 0xF011 so toggling never resets it. */
let personalAncCalibration: number | null = null;
/** EQ preset last applied on the device (sent successfully or read back); null = unknown. */
let appliedEqPreset: EqPreset | null = null;
/** Wire byte for `voice`: 1, or 6 when the device reported newVoice. */
let voiceModeByte: number = EQ_MODE.voice;
/** Bumped to abort an in-flight sync / fit test / EQ sequence when the link changes. */
let linkGeneration = 0;
/** Bumped per sync so a newer sync aborts an older one. */
let syncGeneration = 0;

function resetDeviceSession() {
  personalAncCalibration = null;
  appliedEqPreset = null;
  voiceModeByte = EQ_MODE.voice;
  linkGeneration++;
  cancelEqDebounce();
  cancelDebouncedCommands();
}

// ---------------------------------------------------------------------------
// Local edit tracking (so a sync never overwrites a change the user made meanwhile)
// ---------------------------------------------------------------------------

let editSeq = 0;
const lastEdit = new Map<string, number>();

function markEdited(...fields: string[]) {
  editSeq++;
  for (const f of fields) lastEdit.set(f, editSeq);
}

// ---------------------------------------------------------------------------
// EQ pipeline: one serialized queue + one debounce slot
// ---------------------------------------------------------------------------

let eqChain: Promise<void> = Promise.resolve();
let eqDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function enqueueEq(task: () => Promise<void>) {
  eqChain = eqChain.then(task).catch(() => {});
}

function cancelEqDebounce() {
  if (eqDebounceTimer) {
    clearTimeout(eqDebounceTimer);
    eqDebounceTimer = null;
  }
}

function eqModeOptions(caps: DeviceCapabilities, diracMode: DiracMode) {
  return {
    advancedEq: caps.advancedEq && !isDiracOnly(caps),
    diracMode,
    voiceByte: voiceModeByte,
  };
}

/** Run an EQ command sequence on the queue; records the applied preset on success. */
function queueEqSequence(build: () => { cmds: HwCommand[]; target: EqPreset } | null) {
  const gen = linkGeneration;
  enqueueEq(async () => {
    if (gen !== linkGeneration || !isHardwareActive()) return;
    const job = build();
    if (!job || !job.cmds.length) return;
    const ok = await sendHardwareCommands(job.cmds);
    if (gen !== linkGeneration) return;
    appliedEqPreset = ok ? job.target : null;
  });
}

/** Explicit preset pick: always (re)sends the mode switch. */
function queueEqSelect(preset: EqPreset) {
  cancelEqDebounce();
  queueEqSequence(() => {
    const s = useDeviceStore.getState();
    const caps = currentCaps();
    if (!presetSupported(caps, preset)) return null;
    const cmds: HwCommand[] = [];
    // Advanced mode plays the stored bands, so upload ours before switching to it.
    if (preset === 'advanced') {
      cmds.push({
        command: OP.SET_ADVANCE_CUSTOM_EQ,
        payload: encodeAdvancedEq(s.parametricBands, s.firmwareVersion),
      });
    }
    cmds.push(...eqPresetCommands(preset, appliedEqPreset, eqModeOptions(caps, s.diracMode)));
    return { cmds, target: preset };
  });
}

/**
 * Slider edit: debounce, then upload the current values and switch mode only if the device is
 * not already in that mode (computed when the sequence runs, so it is sent exactly once).
 */
function scheduleEqValues(kind: 'custom' | 'advanced', delayMs = 250) {
  cancelEqDebounce();
  eqDebounceTimer = setTimeout(() => {
    eqDebounceTimer = null;
    queueEqSequence(() => {
      const s = useDeviceStore.getState();
      const caps = currentCaps();
      if (s.eqPreset !== kind || !presetSupported(caps, kind)) return null;
      const cmds: HwCommand[] =
        kind === 'custom'
          ? [
              {
                command: OP.SET_SIMPLE_CUSTOM_EQ,
                payload: encodeSimpleCustomEq(
                  s.customBands,
                  s.firmwareVersion,
                  caps.simpleCustomEq ?? undefined,
                ),
              },
            ]
          : [
              {
                command: OP.SET_ADVANCE_CUSTOM_EQ,
                payload: encodeAdvancedEq(s.parametricBands, s.firmwareVersion),
              },
            ];
      if (appliedEqPreset !== kind) {
        cmds.push(...eqPresetCommands(kind, appliedEqPreset, eqModeOptions(caps, s.diracMode)));
      }
      return { cmds, target: kind };
    });
  }, delayMs);
}

// ---------------------------------------------------------------------------
// Notifications from the backend (`nothing://notification`, `nothing://link-lost`)
// ---------------------------------------------------------------------------

interface NotificationEvent {
  macU64: number;
  command: number;
  payload: number[];
}

type NotifyWaiter = { mac: number; command: number; resolve: (payload: number[] | null) => void };
const notifyWaiters = new Set<NotifyWaiter>();

/** Resolve with the payload of the next `command` notification from `mac`, or null on timeout/cancel. */
function waitForNotification(mac: number, command: number, timeoutMs: number) {
  let settle: (payload: number[] | null) => void = () => {};
  const promise = new Promise<number[] | null>((resolve) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const waiter: NotifyWaiter = {
      mac,
      command,
      resolve: (p) => {
        if (timer) clearTimeout(timer);
        notifyWaiters.delete(waiter);
        resolve(p);
      },
    };
    settle = waiter.resolve;
    notifyWaiters.add(waiter);
    timer = setTimeout(() => waiter.resolve(null), timeoutMs);
  });
  return { promise, cancel: () => settle(null) };
}

function handleNotification(ev: NotificationEvent) {
  for (const w of [...notifyWaiters]) {
    if (w.mac === ev.macU64 && w.command === ev.command) w.resolve(ev.payload);
  }
  const s = useDeviceStore.getState();
  if (!isHardwareActive() || s.activeMacU64 !== ev.macU64) return;
  if (ev.command === OP.NOTIFY_BATTERY) {
    applyBattery(parseBatteryPayload(ev.payload));
  } else if (ev.command === OP.NOTIFY_ANC) {
    const anc = parseAncPayload(ev.payload);
    if (anc) {
      useDeviceStore.setState((st) => ({
        ancMode: anc.mode ?? st.ancMode,
        ancLevel: anc.level ?? st.ancLevel,
      }));
    }
  }
}

let rescanTimer: ReturnType<typeof setTimeout> | null = null;
const LINK_LOST_RESCAN_MS = 4000;

function handleLinkLost(macU64: number) {
  const s = useDeviceStore.getState();
  if (s.connectionMode !== 'connected' || s.activeMacU64 !== macU64) return;
  // The link is gone: nothing can be sent, just drop to the disconnected state.
  void teardownLink(false);
  if (rescanTimer) clearTimeout(rescanTimer);
  rescanTimer = setTimeout(() => {
    rescanTimer = null;
    if (useDeviceStore.getState().connectionMode !== 'connected') {
      void useDeviceStore.getState().scanAndAutoConnect(false);
    }
  }, LINK_LOST_RESCAN_MS);
}

async function registerBackendListeners() {
  if (!isDesktop()) return;
  try {
    const { listen } = await import('@tauri-apps/api/event');
    await listen<NotificationEvent>('nothing://notification', (e) => {
      const p = e.payload;
      if (p && typeof p.command === 'number' && Array.isArray(p.payload)) handleNotification(p);
    });
    await listen<{ macU64: number }>('nothing://link-lost', (e) => {
      if (e.payload && typeof e.payload.macU64 === 'number') handleLinkLost(e.payload.macU64);
    });
  } catch {
    // older backend / not in Tauri
  }
}

// ---------------------------------------------------------------------------
// Link teardown (disconnect, device switch, link lost)
// ---------------------------------------------------------------------------

/**
 * Drop to demo mode. When `sendStops` and the link is still up, stop every ringing target on the
 * device first (captured MAC, sent before the state is cleared).
 */
async function teardownLink(sendStops: boolean): Promise<void> {
  const s = useDeviceStore.getState();
  const mac = s.activeMacU64;
  const wasActive = isHardwareActive();
  const ringing = (Object.keys(s.ringing) as FindTarget[]).filter((t) => s.ringing[t]);

  setFindTonePlaying(false);
  resetDeviceSession();
  useDeviceStore.setState({
    connectionMode: 'demo',
    autoDetectStatus: 'not_found',
    activeMacU64: null,
    ringing: emptyRinging(),
    earFitRunning: false,
    lastCommandError: null,
  });

  if (sendStops && wasActive && mac && ringing.length) {
    for (const t of ringing) {
      try {
        await tauriInvoke('send_bluetooth_command', {
          macU64: mac,
          command: OP.FIND_DEVICE,
          payload: encodeFindDevice(t, false),
        });
      } catch {
        // best effort
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Battery
// ---------------------------------------------------------------------------

function applyBattery(parsed: ParsedBattery | null) {
  if (!parsed || !isHardwareActive()) return;
  useDeviceStore.setState((state) => {
    const caps = capsFor(state.selectedModelId, state.firmwareVersion);
    const single = parsed.singleBattery || caps.batteryLayout === 'single';
    return {
      battery: {
        left: parsed.left ?? state.battery.left,
        leftCharging: parsed.left !== null ? parsed.leftCharging : state.battery.leftCharging,
        right: parsed.right ?? parsed.left ?? state.battery.right,
        rightCharging:
          parsed.right !== null ? parsed.rightCharging : state.battery.rightCharging,
        caseLevel: single ? 0 : (parsed.caseLevel ?? state.battery.caseLevel),
        caseCharging: single
          ? false
          : parsed.caseLevel !== null
            ? parsed.caseCharging
            : state.battery.caseCharging,
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Fit test
// ---------------------------------------------------------------------------

const EAR_FIT_TIMEOUT_MS = 15000;
const BATTERY_POLL_MS = 60_000;
const TRAY_DEBOUNCE_MS = 300;

type FitOutcome =
  | { kind: 'result'; result: EarFitResult }
  | { kind: 'busy' }
  | { kind: 'rejected' }
  | { kind: 'timeout' }
  | { kind: 'error' };

/** Resolve with the first non-null value, or null once every promise resolved null. */
function firstNonNull<T>(promises: Promise<T | null>[]): Promise<T | null> {
  return new Promise((resolve) => {
    let pending = promises.length;
    for (const p of promises) {
      p.then(
        (v) => {
          if (v !== null) resolve(v);
          else if (--pending === 0) resolve(null);
        },
        () => {
          if (--pending === 0) resolve(null);
        },
      );
    }
  });
}

/**
 * Fit test: 0xF014 [1] via `send_and_await_notification` (result notification 0xE00D). The result
 * may also arrive through the `nothing://notification` event, whichever is first. If the backend
 * hands back the 0x7014 start ack instead, its status is honoured (1/3 → busy).
 */
async function runHardwareFitTest(mac: number): Promise<FitOutcome> {
  const viaEvent = waitForNotification(mac, OP.NOTIFY_FIT_RESULT, EAR_FIT_TIMEOUT_MS + 1000);
  let invokeError: unknown = null;
  const viaInvoke = tauriInvoke<NothingFrame | null>('send_and_await_notification', {
    macU64: mac,
    command: OP.FIT_TEST,
    payload: encodeFitTest(true),
    notifyCmd: OP.NOTIFY_FIT_RESULT,
    timeoutMs: EAR_FIT_TIMEOUT_MS,
  }).then(
    (f) => {
      // Backend timed out: the event (if any) would have arrived by now.
      if (!f) viaEvent.cancel();
      return f ?? null;
    },
    (err: unknown) => {
      invokeError = err;
      viaEvent.cancel();
      return null;
    },
  );

  type Got = { command: number; payload: number[] };
  const got = await firstNonNull<Got>([
    viaInvoke.then((f) => (f ? { command: f.command, payload: f.payload ?? [] } : null)),
    viaEvent.promise.then((p) => (p ? { command: OP.NOTIFY_FIT_RESULT, payload: p } : null)),
  ]);
  viaEvent.cancel();

  if (got?.command === OP.FIT_TEST_ACK) {
    const status = decodeFitStartAck(got.payload);
    if (status === 'anotherTesting' || status === 'personalSoundTesting') return { kind: 'busy' };
    if (status === 'other') return { kind: 'rejected' };
    // Started fine but the backend returned early: wait for the result notification.
    const late = await waitForNotification(mac, OP.NOTIFY_FIT_RESULT, EAR_FIT_TIMEOUT_MS).promise;
    const r = late ? decodeFitResult(late) : null;
    return r ? { kind: 'result', result: r } : { kind: 'timeout' };
  }
  if (got) {
    const r = decodeFitResult(got.payload);
    return r ? { kind: 'result', result: r } : { kind: 'timeout' };
  }
  if (invokeError !== null) {
    reportCommandError(invokeError);
    return { kind: 'error' };
  }
  return { kind: 'timeout' };
}

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------

const DEMO_BATTERY_TWS: BatteryState = {
  left: 90,
  leftCharging: false,
  right: 85,
  rightCharging: false,
  caseLevel: 75,
  caseCharging: true,
};
const DEMO_BATTERY_SINGLE: BatteryState = {
  left: 90,
  leftCharging: false,
  right: 90,
  rightCharging: false,
  caseLevel: 0,
  caseCharging: false,
};

let scanInFlight: Promise<void> | null = null;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export interface DeviceStoreState {
  selectedModelId: string;
  selectedColorSku: string;
  connectionMode: 'demo' | 'connected';
  autoDetectStatus: AutoDetectStatus;
  detectedDevices: DetectedNothingDevice[];
  activeMacAddress: string | null;
  activeMacU64: number | null;
  fastPairId: string | null;
  serialNumber: string | null;
  setupModalOpen: boolean;

  viewMode: AppViewMode;
  isMinimizedToTray: boolean;
  closeToTray: boolean;
  alwaysOnTopMini: boolean;

  battery: BatteryState;
  ancMode: AncMode;
  ancLevel: AncLevel;
  personalAnc: boolean;
  earFitRunning: boolean;
  earFitResult: { left: FitCode; right: FitCode } | null;
  /** True when earFitResult came from the demo simulation, not hardware. */
  earFitSimulated: boolean;

  eqPreset: EqPreset;
  /** Active Dirac Opteo mode (models with capabilities.dirac). */
  diracMode: DiracMode;
  customBands: { bass: number; mid: number; treble: number };
  parametricBands: ParametricBand[];
  ultraBassEnabled: boolean;
  ultraBassLevel: number;
  spatialAudio: SpatialAudioMode;

  /** Operation per writable control slot, keyed by `GestureSlot.id`. */
  gestures: Record<string, GestureOpName>;

  inEarDetection: boolean;
  lowLatencyMode: boolean;
  dualConnection: boolean;
  highResCodec: boolean;
  ringing: Record<FindTarget, boolean>;
  firmwareVersion: string | null;
  /** Last hardware command failure while connected (null when none). */
  lastCommandError: string | null;

  setSetupModalOpen: (open: boolean) => void;
  clearCommandError: () => void;
  scanAndAutoConnect: (openSetupIfNotFound?: boolean) => Promise<void>;
  connectDetectedDevice: (device: DetectedNothingDevice) => Promise<void>;
  openWindowsBluetoothSettings: () => Promise<void>;

  setViewMode: (mode: AppViewMode) => void;
  hideToSystemTray: () => Promise<void>;
  restoreFromSystemTray: (mode?: AppViewMode) => Promise<void>;
  setCloseToTray: (enabled: boolean) => void;
  setAlwaysOnTopMini: (enabled: boolean) => void;

  /** Switch the previewed model. If a device is connected it is disconnected first. */
  selectDevice: (modelId: string) => void;
  selectColor: (sku: string) => void;
  setAncMode: (mode: AncMode) => void;
  setAncLevel: (level: AncLevel) => void;
  setPersonalAnc: (enabled: boolean) => void;
  runEarFitTest: () => void;
  /** Read current settings back from the connected device (only features the model has). */
  syncFromDevice: () => Promise<void>;

  setEqPreset: (preset: EqPreset) => void;
  setDiracMode: (mode: DiracMode) => void;
  setCustomBands: (bands: { bass: number; mid: number; treble: number }) => void;
  updateParametricBand: (index: number, patch: Partial<ParametricBand>) => void;
  resetParametricBands: () => void;
  setUltraBass: (enabled: boolean, level?: number) => void;
  setSpatialAudio: (mode: SpatialAudioMode) => void;

  setGestureOp: (slotId: string, op: GestureOpName) => void;

  setInEarDetection: (enabled: boolean) => void;
  setLowLatencyMode: (enabled: boolean) => void;
  setDualConnection: (enabled: boolean) => void;
  setHighResCodec: (enabled: boolean) => void;
  toggleFind: (target: FindTarget) => void;

  connectBluetoothDevice: () => Promise<{ ok: boolean; reason?: 'unsupported' | 'cancelled' }>;
  disconnectBluetoothDevice: () => Promise<void>;
}

/** Keys persisted to localStorage — user preferences only, never live device state. */
type PersistedDeviceState = Pick<
  DeviceStoreState,
  | 'selectedModelId'
  | 'selectedColorSku'
  | 'closeToTray'
  | 'alwaysOnTopMini'
  | 'customBands'
  | 'parametricBands'
>;

const PERSIST_VERSION = 3;

const isFiniteNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function sanitizeCustomBands(v: unknown): DeviceStoreState['customBands'] | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (!isFiniteNum(o.bass) || !isFiniteNum(o.mid) || !isFiniteNum(o.treble)) return null;
  const c = (x: number) => Math.min(6, Math.max(-6, x));
  return { bass: c(o.bass), mid: c(o.mid), treble: c(o.treble) };
}

function sanitizeParametricBands(v: unknown): ParametricBand[] | null {
  if (!Array.isArray(v) || v.length < 2 || v.length > ADVANCED_EQ_MAX_BANDS) return null;
  const out: ParametricBand[] = [];
  for (const b of v) {
    if (!b || typeof b !== 'object') return null;
    const o = b as Record<string, unknown>;
    if (!isFiniteNum(o.freq) || !isFiniteNum(o.gain) || !isFiniteNum(o.q)) return null;
    if (o.freq < 20 || o.freq > 20000 || o.q <= 0) return null;
    const type = o.type === 'lowShelf' || o.type === 'highShelf' ? o.type : 'peak';
    out.push({ freq: o.freq, gain: Math.min(12, Math.max(-12, o.gain)), q: o.q, type });
  }
  return out;
}

/** Validate a persisted blob (any version) down to the v3 preference set. */
function sanitizePersisted(raw: unknown): Partial<PersistedDeviceState> {
  const p = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: Partial<PersistedDeviceState> = {};
  if (typeof p.selectedModelId === 'string' && p.selectedModelId) out.selectedModelId = p.selectedModelId;
  if (typeof p.selectedColorSku === 'string') out.selectedColorSku = p.selectedColorSku;
  if (typeof p.closeToTray === 'boolean') out.closeToTray = p.closeToTray;
  if (typeof p.alwaysOnTopMini === 'boolean') out.alwaysOnTopMini = p.alwaysOnTopMini;
  const cb = sanitizeCustomBands(p.customBands);
  if (cb) out.customBands = cb;
  const pb = sanitizeParametricBands(p.parametricBands);
  if (pb) out.parametricBands = pb;
  return out;
}

const initialUrlMode: AppViewMode =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('mode') === 'mini'
    ? 'mini'
    : 'full';

const DEFAULT_MODEL_ID = 'B170';
const initialCaps = getDeviceCapabilities(DEFAULT_MODEL_ID, null);

/** Resolve the model id / color SKU for a detected device (new protocol fields first). */
function resolveDetected(dev: DetectedNothingDevice): { modelId: string; sku: string } {
  const modelId = dev.matched_model_id || dev.device_model_code || DEFAULT_MODEL_ID;
  const catalogDev = getCurrentDevice(modelId);
  const skus = catalogDev.colors.map((c) => c.sku);
  let sku: string | null = null;
  if (dev.device_color_id) {
    const candidate = `${catalogDev.modelId}_${dev.device_color_id.toUpperCase()}`;
    if (skus.includes(candidate)) sku = candidate;
  }
  if (!sku && dev.matched_color_sku && skus.includes(dev.matched_color_sku)) {
    sku = dev.matched_color_sku;
  }
  return { modelId, sku: sku ?? skus[0] ?? '' };
}

export const useDeviceStore = create<DeviceStoreState>()(
  persist(
    (set, get) => ({
      selectedModelId: DEFAULT_MODEL_ID,
      selectedColorSku: 'B170_09',
      connectionMode: 'demo',
      autoDetectStatus: 'scanning',
      detectedDevices: [],
      activeMacAddress: null,
      activeMacU64: null,
      fastPairId: null,
      serialNumber: null,
      setupModalOpen: false,

      viewMode: initialUrlMode,
      isMinimizedToTray: false,
      closeToTray: true,
      alwaysOnTopMini: true,

      battery:
        initialCaps.batteryLayout === 'tws' ? { ...DEMO_BATTERY_TWS } : { ...DEMO_BATTERY_SINGLE },
      ancMode: initialCaps.anc ? 'anc' : 'off',
      ancLevel: initialCaps.ancLevels[0] ?? 'high',
      personalAnc: false,
      earFitRunning: false,
      earFitResult: null,
      earFitSimulated: false,

      eqPreset: defaultPreset(initialCaps),
      diracMode: defaultDiracMode(initialCaps),
      customBands: { ...DEFAULT_CUSTOM_BANDS },
      parametricBands: DEFAULT_PARAMETRIC_BANDS,
      ultraBassEnabled: false,
      ultraBassLevel: 3,
      spatialAudio: 'off',

      gestures: defaultGestures(initialCaps),

      inEarDetection: initialCaps.inEarDetection,
      lowLatencyMode: false,
      dualConnection: initialCaps.dualConnection,
      highResCodec: false,
      ringing: emptyRinging(),
      firmwareVersion: null,
      lastCommandError: null,

      setSetupModalOpen: (open) => set({ setupModalOpen: open }),
      clearCommandError: () => set({ lastCommandError: null }),

      connectDetectedDevice: async (dev) => {
        const { modelId, sku } = resolveDetected(dev);
        const prev = get();
        const sameDevice = prev.activeMacAddress === dev.mac_address;
        const modelChanged = prev.selectedModelId !== modelId;

        // Switching away from a live device: stop its ringing before retargeting.
        if (!sameDevice && prev.connectionMode === 'connected') await teardownLink(true);
        if (!sameDevice || modelChanged) resetDeviceSession();

        const firmware = dev.firmware_version ?? (sameDevice ? get().firmwareVersion : null);
        const caps = capsFor(modelId, firmware);
        const parsedAnc = parseAncPayload(dev.anc_raw);
        let parsedEq: EqPreset | null = null;
        if (isDiracOnly(caps)) parsedEq = 'diracOpteo';
        else if (dev.eq_preset_index !== null && dev.eq_preset_index !== undefined) {
          parsedEq = eqPresetFromMode(dev.eq_preset_index);
          if (dev.eq_preset_index === EQ_MODE.newVoice) voiceModeByte = EQ_MODE.newVoice;
          if (parsedEq && !presetSupported(caps, parsedEq)) parsedEq = null;
        }
        if (dev.connected && parsedEq) appliedEqPreset = parsedEq;

        set((state) => {
          const single = dev.is_headphone_single_battery || caps.batteryLayout === 'single';
          const base: DeviceStoreState = {
            ...state,
            selectedModelId: modelId,
            selectedColorSku: sku,
            firmwareVersion: firmware,
          };
          return {
            ...normalizeForCaps(base, caps, modelChanged),
            selectedModelId: modelId,
            selectedColorSku: sku,
            connectionMode: dev.connected ? 'connected' : 'demo',
            autoDetectStatus: dev.connected ? 'detected' : 'not_found',
            activeMacAddress: dev.mac_address,
            // Only a live Nothing Link connection gets a command target.
            activeMacU64: dev.connected ? dev.mac_u64 : null,
            fastPairId: dev.fast_pair_id ?? (sameDevice ? state.fastPairId : null),
            firmwareVersion: firmware,
            serialNumber: dev.serial_number ?? (sameDevice ? state.serialNumber : null),
            battery: {
              left: dev.battery_left ?? state.battery.left,
              leftCharging: dev.battery_left_charging ?? false,
              right: dev.battery_right ?? dev.battery_left ?? state.battery.right,
              rightCharging: dev.battery_right_charging ?? false,
              caseLevel: single ? 0 : (dev.battery_case ?? state.battery.caseLevel),
              caseCharging: single ? false : (dev.battery_case_charging ?? false),
            },
            ...(parsedAnc?.mode ? { ancMode: parsedAnc.mode } : {}),
            ...(parsedAnc?.level ? { ancLevel: parsedAnc.level } : {}),
            ...(parsedEq ? { eqPreset: parsedEq } : {}),
            ...(sameDevice ? {} : { earFitResult: null, earFitSimulated: false }),
            lastCommandError: null,
            setupModalOpen: false,
          };
        });
        if (dev.connected) void get().syncFromDevice();
      },

      syncFromDevice: async () => {
        if (!isHardwareActive()) return;
        const gen = linkGeneration;
        const sgen = ++syncGeneration;
        const mac = get().activeMacU64;
        const modelId = get().selectedModelId;
        const startSeq = editSeq;
        const caps = capsFor(modelId, get().firmwareVersion);
        const alive = () =>
          gen === linkGeneration &&
          sgen === syncGeneration &&
          isHardwareActive() &&
          get().activeMacU64 === mac &&
          get().selectedModelId === modelId;
        /** Field untouched by the user since the sync started. */
        const fresh = (field: string) => (lastEdit.get(field) ?? 0) <= startSeq;
        const q = async (cmd: number, payload: number[] = []) => {
          if (!alive()) return null;
          const f = await sendHardwareCommand(cmd, payload, { silent: true });
          return alive() ? f : null;
        };

        if (caps.anc || caps.transparency) {
          const f = await q(OP.GET_ANC, [0x03]);
          const v = f?.payload ? parseAncPayload(f.payload) : null;
          if (v && fresh('anc')) {
            set((s) => ({ ancMode: v.mode ?? s.ancMode, ancLevel: v.level ?? s.ancLevel }));
          }
        }
        if (caps.inEarDetection) {
          const f = await q(OP.GET_IN_EAR);
          const v = f?.payload ? decodeInEarDetection(f.payload) : null;
          if (v !== null && fresh('inEar')) set({ inEarDetection: v });
        }
        if (caps.lowLatency) {
          const f = await q(OP.GET_LOW_LAG);
          const v = f?.payload ? decodeLowLag(f.payload) : null;
          if (v !== null && fresh('lowLag')) set({ lowLatencyMode: v });
        }
        if (caps.dualConnection) {
          const f = await q(OP.GET_DUAL);
          const v = f?.payload ? decodeDualConnection(f.payload) : null;
          if (v !== null && fresh('dual')) set({ dualConnection: v });
        }
        if (caps.personalAnc) {
          const f = await q(OP.GET_PERSONAL_ANC);
          const v = f?.payload ? decodePersonalAnc(f.payload) : null;
          if (v) {
            personalAncCalibration = v.calibration;
            if (fresh('personalAnc')) set({ personalAnc: v.enabled });
          }
        }
        if (caps.ultraBass) {
          const ub = caps.ultraBass;
          const f = await q(OP.GET_BASS_BOOST);
          const v = f?.payload ? decodeBassBoost(f.payload, ub.encoding, ub.maxLevel) : null;
          if (v && fresh('ultraBass')) set({ ultraBassEnabled: v.enabled, ultraBassLevel: v.level });
        }
        if (caps.spatialOnDevice && caps.spatialModes.length) {
          const f = await q(OP.GET_SPATIAL_AUDIO);
          if (f?.payload?.length && fresh('spatial')) {
            const mode = decodeSpatialAudio(f.payload);
            if (mode === 'off' || caps.spatialModes.includes(mode)) set({ spatialAudio: mode });
          }
        }
        if (caps.highResCodecs.length) {
          const f = await q(OP.GET_HIGH_QUALITY_AUDIO);
          if (f?.payload?.length && fresh('hiRes')) {
            set({ highResCodec: decodeHighQualityAudio(f.payload) });
          }
        }

        // --- EQ ---------------------------------------------------------------
        let reportedPreset: EqPreset | null = null;
        if (caps.dirac) {
          const f = await q(OP.GET_DIRAC_EQ);
          const mode = f?.payload ? decodeDiracMode(f.payload) : null;
          if (mode && caps.dirac.modes.includes(mode) && fresh('eq')) set({ diracMode: mode });
          if (isDiracOnly(caps)) reportedPreset = 'diracOpteo';
        }
        if (!isDiracOnly(caps)) {
          if (caps.simpleCustomEq) {
            const f = await q(OP.GET_SIMPLE_CUSTOM_EQ);
            const bands = f?.payload ? decodeSimpleCustomEq(f.payload) : null;
            if (bands && fresh('customBands')) set({ customBands: bands });
          }
          {
            const f = await q(OP.GET_EQ_MODE);
            const byte = f?.payload?.length ? f.payload[0] : null;
            if (byte !== null && byte !== 0xff) {
              if (byte === EQ_MODE.newVoice) voiceModeByte = EQ_MODE.newVoice;
              else if (byte === EQ_MODE.voice) voiceModeByte = EQ_MODE.voice;
              const p = eqPresetFromMode(byte);
              if (p && presetSupported(caps, p)) reportedPreset = p;
            }
          }
          if (caps.advancedEq) {
            const f = await q(OP.GET_ADVANCE_EQ_MODE);
            const on = f?.payload ? decodeAdvancedEqMode(f.payload) : null;
            if (on === true) reportedPreset = 'advanced';
            else if (on === false && reportedPreset === 'advanced') reportedPreset = null;
            const fb = await q(OP.GET_ADVANCE_CUSTOM_EQ, ADVANCED_EQ_QUERY_PAYLOAD);
            const bands = fb?.payload ? decodeAdvancedEq(fb.payload) : null;
            if (bands && fresh('parametricBands')) set({ parametricBands: bands });
            // Advanced reported off but our state says advanced (e.g. stale): fall back.
            if (on === false && !reportedPreset && get().eqPreset === 'advanced' && fresh('eq')) {
              reportedPreset = defaultPreset(caps);
            }
          }
        }
        if (reportedPreset && alive() && fresh('eq')) {
          appliedEqPreset = reportedPreset;
          set({ eqPreset: reportedPreset });
        }

        // --- Gestures ---------------------------------------------------------
        if (caps.gestureSlots.length) {
          const f = await q(OP.GET_GESTURE);
          if (f?.payload?.length) {
            const decoded = decodeGestures(f.payload, caps.gestureSlots);
            set((s) => {
              const next = { ...s.gestures };
              for (const [id, op] of Object.entries(decoded)) {
                if (fresh(`gesture:${id}`)) next[id] = op;
              }
              return { gestures: next };
            });
          }
        }
      },

      scanAndAutoConnect: (openSetupIfNotFound = false) => {
        if (scanInFlight) {
          if (!openSetupIfNotFound) return scanInFlight;
          return scanInFlight.then(() => {
            if (get().connectionMode !== 'connected') set({ setupModalOpen: true });
          });
        }

        const run = async () => {
          set({ autoDetectStatus: 'scanning' });
          if (isDesktop()) {
            try {
              const res = await tauriInvoke<BluetoothScanResult>('scan_bluetooth_devices');
              const devices = res?.devices ?? [];
              set({ detectedDevices: devices });

              if (res?.active_device) {
                await get().connectDetectedDevice(res.active_device);
                return;
              }

              if (devices.length > 0) {
                // Paired/remembered but not connected: pre-select model/color only.
                const first = devices[0];
                const { modelId, sku } = resolveDetected(first);
                if (get().connectionMode === 'connected') await teardownLink(true);
                const modelChanged = get().selectedModelId !== modelId;
                if (modelChanged) resetDeviceSession();
                set((s) => ({
                  ...normalizeForCaps(
                    { ...s, selectedModelId: modelId },
                    capsFor(modelId, s.firmwareVersion),
                    modelChanged,
                  ),
                  selectedModelId: modelId,
                  selectedColorSku: sku,
                  activeMacAddress: first.mac_address,
                  activeMacU64: null,
                  connectionMode: 'demo',
                  autoDetectStatus: 'not_found',
                  setupModalOpen: openSetupIfNotFound,
                }));
                return;
              }
            } catch {
              // fall through to not_found
            }
          }

          if (get().connectionMode === 'connected') await teardownLink(false);
          set({
            autoDetectStatus: 'not_found',
            connectionMode: 'demo',
            activeMacU64: null,
            setupModalOpen: openSetupIfNotFound,
          });
        };

        const p = run().finally(() => {
          scanInFlight = null;
        });
        scanInFlight = p;
        return p;
      },

      openWindowsBluetoothSettings: async () => {
        await safeInvoke('open_windows_bluetooth_settings');
      },

      setViewMode: (mode) => {
        set({ viewMode: mode, isMinimizedToTray: false });
        void applyWindowGeometryForMode(mode, get().alwaysOnTopMini);
      },

      hideToSystemTray: async () => {
        set({ isMinimizedToTray: true });
        if (isDesktop()) {
          try {
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            await getCurrentWindow().hide();
          } catch {
            // ignore
          }
        }
      },

      restoreFromSystemTray: async (mode) => {
        const prevMode = get().viewMode;
        const nextMode = mode ?? prevMode;
        set({ isMinimizedToTray: false, viewMode: nextMode });
        if (isDesktop()) {
          try {
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            const win = getCurrentWindow();
            await win.show();
            await win.setFocus();
          } catch {
            // ignore
          }
        }
        // Only re-apply geometry when the mode actually changes (keeps the user's size/position).
        if (nextMode !== prevMode) void applyWindowGeometryForMode(nextMode, get().alwaysOnTopMini);
      },

      setCloseToTray: (enabled) => {
        set({ closeToTray: enabled });
        void safeInvoke('set_close_to_tray', { enabled });
      },

      setAlwaysOnTopMini: (enabled) => {
        set({ alwaysOnTopMini: enabled });
        if (get().viewMode === 'mini') void applyAlwaysOnTop(enabled);
      },

      selectDevice: (modelId) => {
        const prev = get();
        const modelChanged = prev.selectedModelId !== modelId;
        // Re-picking the connected model is a no-op; any other model is a demo preview.
        if (prev.connectionMode === 'connected') {
          if (!modelChanged) return;
          void teardownLink(true);
        }
        if (modelChanged) resetDeviceSession();
        const dev = getCurrentDevice(modelId);
        set((s) => {
          // A different model's firmware is unknown in preview.
          const firmware = modelChanged ? null : s.firmwareVersion;
          const caps = capsFor(modelId, firmware);
          return {
            ...normalizeForCaps({ ...s, selectedModelId: modelId }, caps, modelChanged),
            selectedModelId: modelId,
            selectedColorSku: dev.colors[0]?.sku ?? '',
            firmwareVersion: firmware,
            ...(modelChanged ? { serialNumber: null, fastPairId: null } : {}),
            earFitResult: null,
            earFitSimulated: false,
            ringing: emptyRinging(),
            battery:
              caps.batteryLayout === 'tws' ? { ...DEMO_BATTERY_TWS } : { ...DEMO_BATTERY_SINGLE },
          };
        });
        setFindTonePlaying(false);
      },

      selectColor: (sku) => set({ selectedColorSku: sku }),

      setAncMode: (mode) => {
        const caps = currentCaps();
        if (mode === 'anc' && !caps.anc) return;
        if (mode === 'transparency' && !caps.transparency) return;
        if (mode === 'off' && !caps.anc && !caps.transparency) return;
        markEdited('anc');
        set({ ancMode: mode });
        const level = caps.ancLevels.includes(get().ancLevel)
          ? get().ancLevel
          : (caps.ancLevels[0] ?? 'high');
        void sendHardwareCommand(OP.SET_ANC, [0x01, ancByte(mode, level), 0x00]);
      },

      setAncLevel: (level) => {
        const caps = currentCaps();
        if (!caps.anc || !caps.ancLevels.includes(level)) return;
        markEdited('anc');
        set({ ancLevel: level, ancMode: 'anc' });
        void sendHardwareCommand(OP.SET_ANC, [0x01, ancByte('anc', level), 0x00]);
      },

      setPersonalAnc: (enabled) => {
        if (!currentCaps().personalAnc) return;
        markEdited('personalAnc');
        set({ personalAnc: enabled });
        void sendHardwareCommand(OP.SET_PERSONAL_ANC, encodePersonalAnc(enabled, personalAncCalibration));
      },

      runEarFitTest: () => {
        if (get().earFitRunning) return;
        if (!currentCaps().earTipFitTest) return;
        playFitTestAudio();

        const mac = get().activeMacU64;
        if (isHardwareActive() && mac) {
          const gen = linkGeneration;
          set({ earFitRunning: true, earFitResult: null, earFitSimulated: false });
          void runHardwareFitTest(mac).then(async (outcome) => {
            if (gen !== linkGeneration) return;
            if (outcome.kind === 'timeout') {
              // Make sure the buds leave test mode.
              await sendHardwareCommand(OP.FIT_TEST, encodeFitTest(false), { silent: true });
              toastError('errors.fitTestTimeout', 'The fit test did not finish. Try again.', 'nothingx-fit');
            } else if (outcome.kind === 'busy') {
              toastError('errors.fitTestBusy', 'Another test is running on the earbuds.', 'nothingx-fit');
            } else if (outcome.kind === 'rejected') {
              toastError('errors.fitTestFailed', 'The earbuds could not start the fit test.', 'nothingx-fit');
            }
            if (gen !== linkGeneration) return;
            set({
              earFitRunning: false,
              earFitResult: outcome.kind === 'result' ? outcome.result : null,
              earFitSimulated: false,
            });
          });
          return;
        }

        // Demo mode: simulated result.
        set({ earFitRunning: true, earFitResult: null, earFitSimulated: true });
        setTimeout(() => {
          if (!get().earFitSimulated) return;
          set({
            earFitRunning: false,
            earFitResult: { left: 'good', right: 'good' },
            earFitSimulated: true,
          });
        }, 2400);
      },

      setEqPreset: (preset) => {
        const caps = currentCaps();
        if (!presetSupported(caps, preset)) return;
        markEdited('eq');
        set({ eqPreset: preset });
        queueEqSelect(preset);
      },

      setDiracMode: (mode) => {
        const caps = currentCaps();
        if (!caps.dirac || !caps.dirac.modes.includes(mode)) return;
        markEdited('eq');
        set({ diracMode: mode, eqPreset: 'diracOpteo' });
        queueEqSelect('diracOpteo');
      },

      setCustomBands: (bands) => {
        const caps = currentCaps();
        if (!presetSupported(caps, 'custom')) return;
        const c = (x: number) => Math.min(6, Math.max(-6, Number.isFinite(x) ? x : 0));
        markEdited('customBands', 'eq');
        set({ customBands: { bass: c(bands.bass), mid: c(bands.mid), treble: c(bands.treble) }, eqPreset: 'custom' });
        scheduleEqValues('custom');
      },

      updateParametricBand: (index, patch) => {
        const caps = currentCaps();
        if (!presetSupported(caps, 'advanced')) return;
        const next = get().parametricBands.map((b, i) => (i === index ? { ...b, ...patch } : b));
        markEdited('parametricBands', 'eq');
        set({ parametricBands: next, eqPreset: 'advanced' });
        scheduleEqValues('advanced');
      },

      resetParametricBands: () => {
        const flat = DEFAULT_PARAMETRIC_BANDS.map((b) => ({ ...b, gain: 0 }));
        markEdited('parametricBands');
        set({ parametricBands: flat });
        if (get().eqPreset === 'advanced' && presetSupported(currentCaps(), 'advanced')) {
          scheduleEqValues('advanced');
        }
      },

      setUltraBass: (enabled, level) => {
        const ub = currentCaps().ultraBass;
        if (!ub) return;
        const nextLevel = Math.min(ub.maxLevel, Math.max(1, Math.round(level ?? get().ultraBassLevel)));
        markEdited('ultraBass');
        set({ ultraBassEnabled: enabled, ultraBassLevel: nextLevel });
        sendHardwareCommandDebounced(OP.SET_BASS_BOOST, () => {
          const cur = currentCaps().ultraBass;
          if (!cur) return null;
          const s = get();
          return encodeBassBoost(s.ultraBassEnabled, s.ultraBassLevel, cur.encoding, cur.maxLevel);
        });
      },

      setSpatialAudio: (mode) => {
        const caps = currentCaps();
        if (mode !== 'off' && !caps.spatialModes.includes(mode)) return;
        markEdited('spatial');
        set({ spatialAudio: mode });
        // Phone-side spatial models: state only (the official app never sends 0xF052 to them).
        if (caps.spatialOnDevice) {
          void sendHardwareCommand(OP.SET_SPATIAL_AUDIO, encodeSpatialAudio(mode));
        }
      },

      setGestureOp: (slotId, op) => {
        const slot = currentCaps().gestureSlots.find((s) => s.id === slotId);
        if (!slot || !slot.allowed.includes(op)) return;
        markEdited(`gesture:${slotId}`);
        set((s) => ({ gestures: { ...s.gestures, [slotId]: op } }));
        void sendHardwareCommand(OP.SET_GESTURE, encodeGesture(slot, op));
      },

      setInEarDetection: (enabled) => {
        if (!currentCaps().inEarDetection) return;
        markEdited('inEar');
        set({ inEarDetection: enabled });
        void sendHardwareCommand(OP.SET_IN_EAR, encodeInEarDetection(enabled));
      },

      setLowLatencyMode: (enabled) => {
        if (!currentCaps().lowLatency) return;
        markEdited('lowLag');
        set({ lowLatencyMode: enabled });
        void sendHardwareCommand(OP.SET_LOW_LAG, encodeLowLag(enabled));
      },

      setDualConnection: (enabled) => {
        if (!currentCaps().dualConnection) return;
        markEdited('dual');
        set({ dualConnection: enabled });
        void sendHardwareCommand(OP.SET_DUAL, encodeDualConnection(enabled));
      },

      setHighResCodec: (enabled) => {
        const codecs = currentCaps().highResCodecs;
        if (!codecs.length) return;
        markEdited('hiRes');
        set({ highResCodec: enabled });
        void sendHardwareCommand(OP.SET_HIGH_QUALITY_AUDIO, encodeHighQualityAudio(enabled, codecs));
      },

      toggleFind: (target) => {
        if (!currentCaps().findTargets.includes(target)) return;
        const next = !get().ringing[target];
        const ringing = { ...get().ringing, [target]: next };
        set({ ringing });
        setFindTonePlaying(Object.values(ringing).some(Boolean));
        void sendHardwareCommand(OP.FIND_DEVICE, encodeFindDevice(target, next));
      },

      connectBluetoothDevice: async () => {
        await get().scanAndAutoConnect(true);
        if (get().connectionMode === 'connected') {
          return { ok: true };
        }
        return { ok: false, reason: 'unsupported' };
      },

      disconnectBluetoothDevice: async () => {
        await teardownLink(true);
      },
    }),
    {
      name: 'nothingx.device',
      version: PERSIST_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (s): PersistedDeviceState => ({
        selectedModelId: s.selectedModelId,
        selectedColorSku: s.selectedColorSku,
        closeToTray: s.closeToTray,
        alwaysOnTopMini: s.alwaysOnTopMini,
        customBands: s.customBands,
        parametricBands: s.parametricBands,
      }),
      // v3: only preferences are persisted; v1/v2 device state (EQ preset, ANC, spatial,
      // gestures, smart dial, toggles…) is dropped and re-derived from the model / device.
      migrate: (persisted) => sanitizePersisted(persisted) as PersistedDeviceState,
      merge: (persisted, current) => {
        const merged: DeviceStoreState = { ...current, ...sanitizePersisted(persisted) };
        const caps = getDeviceCapabilities(merged.selectedModelId, null);
        const modelChanged = merged.selectedModelId !== current.selectedModelId;
        return {
          ...merged,
          ...normalizeForCaps(merged, caps, modelChanged),
          battery:
            caps.batteryLayout === 'tws' ? { ...DEMO_BATTERY_TWS } : { ...DEMO_BATTERY_SINGLE },
          ...(modelChanged
            ? {
                ancMode: caps.anc ? 'anc' : caps.transparency ? 'transparency' : 'off',
                ancLevel: caps.ancLevels[0] ?? 'high',
                inEarDetection: caps.inEarDetection,
                dualConnection: caps.dualConnection,
              }
            : {}),
        };
      },
    },
  ),
);

// ---------------------------------------------------------------------------
// Battery polling (only while connected; push notifications 0xE001 are primary)
// ---------------------------------------------------------------------------

let batteryTimer: ReturnType<typeof setInterval> | null = null;

async function pollBattery() {
  if (!isHardwareActive()) return;
  const frame = await sendHardwareCommand(OP.GET_BATTERY, [], { silent: true });
  applyBattery(parseBatteryPayload(frame?.payload));
}

function startBatteryPolling() {
  if (batteryTimer) return;
  batteryTimer = setInterval(() => void pollBattery(), BATTERY_POLL_MS);
}

function stopBatteryPolling() {
  if (batteryTimer) {
    clearInterval(batteryTimer);
    batteryTimer = null;
  }
}

// ---------------------------------------------------------------------------
// Tray sync
// ---------------------------------------------------------------------------

function buildTrayTooltip(s: DeviceStoreState): string {
  if (s.connectionMode !== 'connected') return 'Nothing X';
  const { batteryLayout } = capsFor(s.selectedModelId, s.firmwareVersion);
  const b = s.battery;
  if (batteryLayout === 'tws') {
    return `Nothing X • L ${b.left}% | R ${b.right}% | Case ${b.caseLevel}%`;
  }
  return `Nothing X • ${b.left}%`;
}

let trayTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleTrayUpdate() {
  if (!isDesktop()) return;
  if (trayTimer) clearTimeout(trayTimer);
  trayTimer = setTimeout(() => {
    trayTimer = null;
    const s = useDeviceStore.getState();
    void safeInvoke('update_tray', {
      tooltip: buildTrayTooltip(s),
      labels: {
        openMini: i18n.t('tray.menu.openMini'),
        openFull: i18n.t('tray.menu.openFull'),
        ancOn: i18n.t('tray.menu.ancOn'),
        ancTrans: i18n.t('tray.menu.ancTrans'),
        ancOff: i18n.t('tray.menu.ancOff'),
        quit: i18n.t('tray.menu.quit'),
      },
    });
  }, TRAY_DEBOUNCE_MS);
}

// ---------------------------------------------------------------------------
// Startup wiring
// ---------------------------------------------------------------------------

if (typeof window !== 'undefined') {
  useDeviceStore.subscribe((state, prev) => {
    const linkChanged =
      state.connectionMode !== prev.connectionMode ||
      state.activeMacU64 !== prev.activeMacU64;
    if (linkChanged) {
      if (state.connectionMode === 'connected' && state.activeMacU64) {
        startBatteryPolling();
        void pollBattery(); // immediate read; polling is only a fallback for 0xE001 pushes
      } else {
        stopBatteryPolling();
      }
    }
    if (
      linkChanged ||
      state.battery !== prev.battery ||
      state.ancMode !== prev.ancMode ||
      state.selectedModelId !== prev.selectedModelId
    ) {
      scheduleTrayUpdate();
    }
  });

  try {
    i18n.on('languageChanged', () => scheduleTrayUpdate());
  } catch {
    // ignore
  }

  void registerBackendListeners();

  // Apply the initial view mode's window geometry once (min size / mini placement), detect
  // connected Nothing / CMF devices and push persisted preferences to the backend.
  setTimeout(() => {
    const s = useDeviceStore.getState();
    void applyWindowGeometryForMode(s.viewMode, s.alwaysOnTopMini, { resize: s.viewMode === 'mini' });
    void safeInvoke('set_close_to_tray', { enabled: s.closeToTray });
    scheduleTrayUpdate();
    void s.scanAndAutoConnect(false);
  }, 150);
}
