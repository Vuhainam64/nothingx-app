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
  ancFromByte,
  parseBatteryPayload,
  type AncMode,
  type AncLevel,
  type EqPreset,
  type ParametricBand,
  type BatteryState,
  type NothingFrame,
} from './bluetoothProtocol';
import { isDesktop } from './isDesktop';
import {
  OP,
  eqPresetCommands,
  eqPresetFromMode,
  encodeSimpleCustomEq,
  decodeSimpleCustomEq,
  encodeAdvancedEq,
  encodeSpatialAudio,
  decodeSpatialAudio,
  encodeHighQualityAudio,
  decodeHighQualityAudio,
  encodePinchGesture,
  decodeGestures,
  supportsPinchGestures,
  PINCH_ALLOWED_ACTIONS,
  smartDialWritable,
  DIAL_PRESS_ALLOWED,
  encodeSmartDialRotate,
  encodeSmartDialPress,
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
  decodeFitResult,
  type SpatialMode,
  type HwCommand,
} from './nothingCommands';

export type SpatialAudioMode = SpatialMode;
export type AppViewMode = 'full' | 'mini';
export type AutoDetectStatus = 'scanning' | 'detected' | 'not_found';
export type EarFitStatus = 'good' | 'poor';
export interface EarFitResult {
  left: EarFitStatus;
  right: EarFitStatus;
}

export interface DetectedNothingDevice {
  name: string;
  mac_address: string;
  mac_u64: number;
  connected: boolean;
  remembered: boolean;
  matched_model_id: string;
  matched_color_sku: string | null;
  fast_pair_id: string | null;
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

export type GestureAction =
  | 'playPause'
  | 'nextTrack'
  | 'prevTrack'
  | 'noiseControl'
  | 'voiceAssistant'
  | 'volumeUp'
  | 'volumeDown'
  | 'noAction';

export interface GestureSideState {
  doublePinch: GestureAction;
  triplePinch: GestureAction;
  pinchHold: GestureAction;
  doublePinchHold: GestureAction;
}

/** Factory pinch mapping (Ear (2) defaultControl: 2x next, 3x previous, hold ANC↔Transparency, 2x-hold none). */
export const DEFAULT_GESTURES: GestureSideState = {
  doublePinch: 'nextTrack',
  triplePinch: 'prevTrack',
  pinchHold: 'noiseControl',
  doublePinchHold: 'noAction',
};

function sanitizeGestures(g: Partial<GestureSideState> | undefined): GestureSideState {
  const out = { ...DEFAULT_GESTURES };
  for (const key of Object.keys(out) as (keyof GestureSideState)[]) {
    const v = g?.[key];
    if (v && PINCH_ALLOWED_ACTIONS[key].includes(v)) out[key] = v;
  }
  return out;
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

async function applyWindowGeometryForMode(mode: AppViewMode, alwaysOnTopMini: boolean) {
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
        await win.setSize(new LogicalSize(1280, 840));
        await win.center();
      }
      return;
    } catch {
      // fallback to browser window APIs
    }
  }

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
// Hardware command channel
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

/**
 * Send a Nothing Link command to the active device.
 * Only sends when actually connected (connectionMode === 'connected' and a MAC is set);
 * otherwise resolves null immediately (demo mode / merely paired devices).
 * Failures are surfaced via `lastCommandError` + toast unless `silent`.
 */
// Sliders fire onChange on every tick; the backend serialises commands per device and a write
// with no reply waits ~800ms, so only the last value within the window is sent.
const debouncedCommandTimers = new Map<number, ReturnType<typeof setTimeout>>();
function sendHardwareCommandDebounced(command: number, payload: number[], delayMs = 250) {
  const prev = debouncedCommandTimers.get(command);
  if (prev) clearTimeout(prev);
  debouncedCommandTimers.set(
    command,
    setTimeout(() => {
      debouncedCommandTimers.delete(command);
      void sendHardwareCommand(command, payload);
    }, delayMs),
  );
}

async function sendHardwareCommand(
  command: number,
  payload: number[] = [],
  opts: { silent?: boolean } = {},
): Promise<NothingFrame | null> {
  const { connectionMode, activeMacU64 } = useDeviceStore.getState();
  if (!isDesktop() || connectionMode !== 'connected' || !activeMacU64) return null;
  try {
    const frame = await tauriInvoke<NothingFrame | null>('send_bluetooth_command', {
      macU64: activeMacU64,
      command,
      payload,
    });
    return frame ?? null;
  } catch (err) {
    if (!opts.silent && useDeviceStore.getState().connectionMode === 'connected') {
      reportCommandError(err);
    }
    return null;
  }
}

/** Send several commands in order (e.g. EQ mode switch = F04F [00] then F010 [mode]). */
async function sendHardwareCommands(list: HwCommand[]): Promise<void> {
  for (const c of list) await sendHardwareCommand(c.command, c.payload);
}

/** Debounced multi-command send keyed by a logical name (slider drags). */
const debouncedSequenceTimers = new Map<string, ReturnType<typeof setTimeout>>();
function sendHardwareCommandsDebounced(key: string, build: () => HwCommand[], delayMs = 250) {
  const prev = debouncedSequenceTimers.get(key);
  if (prev) clearTimeout(prev);
  debouncedSequenceTimers.set(
    key,
    setTimeout(() => {
      debouncedSequenceTimers.delete(key);
      void sendHardwareCommands(build());
    }, delayMs),
  );
}

/** Headphones / neckband ring as one body (device id 6); buds ring per side. */
function findSide(side: 'left' | 'right'): 'left' | 'right' | 'body' {
  const { selectedModelId } = useDeviceStore.getState();
  return getCurrentDevice(selectedModelId).formFactor === 'tws' ? side : 'body';
}

function isHardwareActive(): boolean {
  const { connectionMode, activeMacU64 } = useDeviceStore.getState();
  return isDesktop() && connectionMode === 'connected' && !!activeMacU64;
}

function parseAncFromHardware(raw: number[] | null): {
  mode: AncMode;
  level: AncLevel | null;
} | null {
  if (!raw || raw.length < 2) return null;
  return ancFromByte(raw[1]);
}

function parseEqFromHardware(presetIndex: number | null): EqPreset | null {
  return eqPresetFromMode(presetIndex);
}

/** 0xE00D notification `[left, right]`: 0 good seal, 1 poor seal, 2 not worn, 3 in call, 4 busy. */
function parseEarFitResult(frame: NothingFrame | null): EarFitResult | null {
  const r = frame?.payload ? decodeFitResult(frame.payload) : null;
  if (!r) return null;
  // 2 = not worn, 3 = in a call, 4 = repeated operation → no seal verdict.
  const ok = (c: string): c is EarFitStatus => c === 'good' || c === 'poor';
  return ok(r.left) && ok(r.right) ? { left: r.left, right: r.right } : null;
}

/** Fit test: send 0xF014 [1] and wait for the 0xE00D result notification. */
async function runHardwareFitTest(): Promise<NothingFrame | null> {
  const { activeMacU64 } = useDeviceStore.getState();
  if (!isHardwareActive() || !activeMacU64) return null;
  try {
    return await tauriInvoke<NothingFrame | null>('send_and_await_notification', {
      macU64: activeMacU64,
      command: OP.FIT_TEST,
      payload: [0x01],
      notifyCmd: OP.NOTIFY_FIT_RESULT,
      timeoutMs: EAR_FIT_TIMEOUT_MS,
    });
  } catch (err) {
    reportCommandError(err);
    return null;
  }
}

const EAR_FIT_TIMEOUT_MS = 15000;
const BATTERY_POLL_MS = 60_000;
const TRAY_DEBOUNCE_MS = 300;

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
/** Calibration byte from 0xC020, echoed back on 0xF011 so toggling never resets it. */
let personalAncCalibration: number | null = null;

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
  earFitResult: EarFitResult | null;
  /** True when earFitResult came from the demo simulation, not hardware. */
  earFitSimulated: boolean;

  eqPreset: EqPreset;
  customBands: { bass: number; mid: number; treble: number };
  parametricBands: ParametricBand[];
  ultraBassEnabled: boolean;
  ultraBassLevel: number;
  spatialAudio: SpatialAudioMode;

  leftGestures: GestureSideState;
  rightGestures: GestureSideState;
  smartDialEnabled: boolean;
  smartDialPress: GestureAction;

  inEarDetection: boolean;
  lowLatencyMode: boolean;
  dualConnection: boolean;
  highResCodec: boolean;
  ringingLeft: boolean;
  ringingRight: boolean;
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

  selectDevice: (modelId: string) => void;
  selectColor: (sku: string) => void;
  setAncMode: (mode: AncMode) => void;
  setAncLevel: (level: AncLevel) => void;
  setPersonalAnc: (enabled: boolean) => void;
  runEarFitTest: () => void;
  /** Read current settings back from the connected device (EQ, spatial, codec, gestures). */
  syncFromDevice: () => Promise<void>;

  setEqPreset: (preset: EqPreset) => void;
  setCustomBands: (bands: { bass: number; mid: number; treble: number }) => void;
  updateParametricBand: (index: number, patch: Partial<ParametricBand>) => void;
  resetParametricBands: () => void;
  setUltraBass: (enabled: boolean, level?: number) => void;
  setSpatialAudio: (mode: SpatialAudioMode) => void;

  setGesture: (
    side: 'left' | 'right',
    gesture: keyof GestureSideState,
    action: GestureAction,
  ) => void;
  setSmartDialEnabled: (enabled: boolean) => void;
  setSmartDialPress: (action: GestureAction) => void;

  setInEarDetection: (enabled: boolean) => void;
  setLowLatencyMode: (enabled: boolean) => void;
  setDualConnection: (enabled: boolean) => void;
  setHighResCodec: (enabled: boolean) => void;
  toggleFindMyEarbud: (side: 'left' | 'right') => void;

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
  | 'eqPreset'
  | 'customBands'
  | 'parametricBands'
  | 'ultraBassEnabled'
  | 'ultraBassLevel'
  | 'spatialAudio'
  | 'leftGestures'
  | 'rightGestures'
  | 'smartDialEnabled'
  | 'smartDialPress'
  | 'inEarDetection'
  | 'lowLatencyMode'
  | 'dualConnection'
  | 'highResCodec'
  | 'ancMode'
  | 'ancLevel'
  | 'personalAnc'
>;

const PERSIST_VERSION = 2;

const initialUrlMode: AppViewMode =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('mode') === 'mini'
    ? 'mini'
    : 'full';

export const useDeviceStore = create<DeviceStoreState>()(
  persist(
    (set, get) => ({
      selectedModelId: 'B170',
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

      battery: { ...DEMO_BATTERY_SINGLE },
      ancMode: 'anc',
      ancLevel: 'high',
      personalAnc: true,
      earFitRunning: false,
      earFitResult: null,
      earFitSimulated: false,

      eqPreset: 'balanced',
      customBands: { bass: 3, mid: 0, treble: 2 },
      parametricBands: DEFAULT_PARAMETRIC_BANDS,
      ultraBassEnabled: true,
      ultraBassLevel: 3,
      spatialAudio: 'headTracking',

      leftGestures: { ...DEFAULT_GESTURES },
      rightGestures: { ...DEFAULT_GESTURES },
      // Smart Dial ships disabled (all case-dial entries = op 1 in defaultControl).
      smartDialEnabled: false,
      smartDialPress: 'playPause',

      inEarDetection: true,
      lowLatencyMode: false,
      dualConnection: true,
      highResCodec: true,
      ringingLeft: false,
      ringingRight: false,
      firmwareVersion: null,
      lastCommandError: null,

      setSetupModalOpen: (open) => set({ setupModalOpen: open }),
      clearCommandError: () => set({ lastCommandError: null }),

      connectDetectedDevice: async (dev) => {
        const catalogDev = getCurrentDevice(dev.matched_model_id);
        const matchedSku =
          dev.matched_color_sku &&
          catalogDev.colors.some((c) => c.sku === dev.matched_color_sku)
            ? dev.matched_color_sku
            : catalogDev.colors[0]?.sku ?? '';

        const parsedAnc = parseAncFromHardware(dev.anc_raw);
        const parsedEq = parseEqFromHardware(dev.eq_preset_index);

        set((state) => {
          const sameDevice = state.activeMacAddress === dev.mac_address;
          const singleBattery =
            dev.is_headphone_single_battery || catalogDev.formFactor !== 'tws';
          return {
            selectedModelId: catalogDev.modelId,
            selectedColorSku: matchedSku,
            connectionMode: dev.connected ? 'connected' : 'demo',
            autoDetectStatus: dev.connected ? 'detected' : 'not_found',
            activeMacAddress: dev.mac_address,
            // Only a live Nothing Link connection gets a command target.
            activeMacU64: dev.connected ? dev.mac_u64 : null,
            fastPairId: dev.fast_pair_id ?? (sameDevice ? state.fastPairId : null),
            firmwareVersion:
              dev.firmware_version ?? (sameDevice ? state.firmwareVersion : null),
            serialNumber: dev.serial_number ?? (sameDevice ? state.serialNumber : null),
            battery: {
              left: dev.battery_left ?? state.battery.left,
              leftCharging: dev.battery_left_charging ?? false,
              right: dev.battery_right ?? dev.battery_left ?? state.battery.right,
              rightCharging: dev.battery_right_charging ?? false,
              caseLevel: singleBattery
                ? 0
                : (dev.battery_case ?? state.battery.caseLevel),
              caseCharging: singleBattery ? false : (dev.battery_case_charging ?? false),
            },
            ancMode: parsedAnc ? parsedAnc.mode : state.ancMode,
            ancLevel: parsedAnc?.level ?? state.ancLevel,
            eqPreset: parsedEq ?? state.eqPreset,
            lastCommandError: null,
            setupModalOpen: false,
          };
        });
        if (dev.connected) void get().syncFromDevice();
      },

      syncFromDevice: async () => {
        if (!isHardwareActive()) return;
        const device = getCurrentDevice(get().selectedModelId);
        const q = (cmd: number, payload: number[] = []) =>
          sendHardwareCommand(cmd, payload, { silent: true });

        {
          const f = await q(OP.GET_IN_EAR);
          const v = f?.payload ? decodeInEarDetection(f.payload) : null;
          if (v !== null) set({ inEarDetection: v });
        }
        {
          const f = await q(OP.GET_LOW_LAG);
          const v = f?.payload ? decodeLowLag(f.payload) : null;
          if (v !== null) set({ lowLatencyMode: v });
        }
        if (device.supportsDualConnection) {
          const f = await q(OP.GET_DUAL);
          const v = f?.payload ? decodeDualConnection(f.payload) : null;
          if (v !== null) set({ dualConnection: v });
        }
        if (device.supportsPersonalAnc) {
          const f = await q(OP.GET_PERSONAL_ANC);
          const v = f?.payload ? decodePersonalAnc(f.payload) : null;
          if (v) {
            personalAncCalibration = v.calibration;
            set({ personalAnc: v.enabled });
          }
        }
        if (device.supportsUltraBass) {
          const f = await q(OP.GET_BASS_BOOST);
          const v = f?.payload ? decodeBassBoost(f.payload) : null;
          if (v) set({ ultraBassEnabled: v.enabled, ultraBassLevel: v.level });
        }
        if (device.supportsSpatialAudio) {
          const f = await q(OP.GET_SPATIAL_AUDIO);
          if (f?.payload?.length) set({ spatialAudio: decodeSpatialAudio(f.payload) });
        }
        if (device.highResCodec) {
          const f = await q(OP.GET_HIGH_QUALITY_AUDIO);
          if (f?.payload?.length) set({ highResCodec: decodeHighQualityAudio(f.payload) });
        }
        {
          const f = await q(OP.GET_SIMPLE_CUSTOM_EQ);
          const bands = f?.payload ? decodeSimpleCustomEq(f.payload) : null;
          if (bands) set({ customBands: bands });
        }
        if (device.supportsParametricEq) {
          const f = await q(OP.GET_ADVANCE_EQ_MODE);
          if (f?.payload?.length && f.payload[0] === 0x01) set({ eqPreset: 'advanced' });
        }
        {
          const f = await q(OP.GET_GESTURE);
          if (f?.payload?.length) {
            const g = decodeGestures(f.payload);
            set((s) => ({
              leftGestures: sanitizeGestures({ ...s.leftGestures, ...g.left }),
              rightGestures: sanitizeGestures({ ...s.rightGestures, ...g.right }),
              smartDialEnabled: g.dialRotateOn ?? s.smartDialEnabled,
              smartDialPress:
                g.dialPress && DIAL_PRESS_ALLOWED.includes(g.dialPress)
                  ? g.dialPress
                  : s.smartDialPress,
            }));
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
                const catalogDev = getCurrentDevice(first.matched_model_id);
                const matchedSku =
                  first.matched_color_sku &&
                  catalogDev.colors.some((c) => c.sku === first.matched_color_sku)
                    ? first.matched_color_sku
                    : catalogDev.colors[0]?.sku ?? '';
                set({
                  selectedModelId: catalogDev.modelId,
                  selectedColorSku: matchedSku,
                  activeMacAddress: first.mac_address,
                  activeMacU64: null,
                  connectionMode: 'demo',
                  autoDetectStatus: 'not_found',
                  setupModalOpen: openSetupIfNotFound,
                });
                return;
              }
            } catch {
              // fall through to not_found
            }
          }

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
        const nextMode = mode ?? get().viewMode;
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
        void applyWindowGeometryForMode(nextMode, get().alwaysOnTopMini);
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
        const dev = getCurrentDevice(modelId);
        const connected = get().connectionMode === 'connected';
        set({
          selectedModelId: modelId,
          selectedColorSku: dev.colors[0]?.sku ?? '',
          earFitResult: null,
          earFitSimulated: false,
          // Only fabricate battery numbers in demo mode; real values come from hardware.
          ...(connected
            ? {}
            : {
                battery:
                  dev.formFactor === 'tws'
                    ? { ...DEMO_BATTERY_TWS }
                    : { ...DEMO_BATTERY_SINGLE },
              }),
        });
      },

      selectColor: (sku) => set({ selectedColorSku: sku }),

      setAncMode: (mode) => {
        set({ ancMode: mode });
        void sendHardwareCommand(OP.SET_ANC, [0x01, ancByte(mode, get().ancLevel), 0x00]);
      },

      setAncLevel: (level) => {
        set({ ancLevel: level, ancMode: 'anc' });
        void sendHardwareCommand(OP.SET_ANC, [0x01, ancByte('anc', level), 0x00]);
      },

      setPersonalAnc: (enabled) => {
        set({ personalAnc: enabled });
        void sendHardwareCommand(OP.SET_PERSONAL_ANC, encodePersonalAnc(enabled, personalAncCalibration));
      },

      runEarFitTest: () => {
        if (get().earFitRunning) return;
        playFitTestAudio();

        if (isHardwareActive()) {
          set({ earFitRunning: true, earFitResult: null, earFitSimulated: false });
          void runHardwareFitTest().then(
            (frame) => {
              set({
                earFitRunning: false,
                earFitResult: parseEarFitResult(frame),
                earFitSimulated: false,
              });
            },
          );
          return;
        }

        // Demo mode: simulated result.
        set({ earFitRunning: true, earFitResult: null, earFitSimulated: true });
        setTimeout(() => {
          set({
            earFitRunning: false,
            earFitResult: { left: 'good', right: 'good' },
            earFitSimulated: true,
          });
        }, 2400);
      },

      setEqPreset: (preset) => {
        const previous = get().eqPreset;
        set({ eqPreset: preset });
        const cmds: HwCommand[] = [];
        // Advanced mode plays the stored bands, so upload ours before switching to it.
        if (preset === 'advanced') {
          cmds.push({
            command: OP.SET_ADVANCE_CUSTOM_EQ,
            payload: encodeAdvancedEq(get().parametricBands, get().firmwareVersion),
          });
        }
        cmds.push(...eqPresetCommands(preset, previous));
        void sendHardwareCommands(cmds);
      },

      setCustomBands: (bands) => {
        const previous = get().eqPreset;
        set({ customBands: bands, eqPreset: 'custom' });
        sendHardwareCommandsDebounced('simple-eq', () => [
          { command: OP.SET_SIMPLE_CUSTOM_EQ, payload: encodeSimpleCustomEq(bands, get().firmwareVersion) },
          ...(previous !== 'custom' ? eqPresetCommands('custom', previous) : []),
        ]);
      },

      updateParametricBand: (index, patch) => {
        const previous = get().eqPreset;
        const next = get().parametricBands.map((b, i) =>
          i === index ? { ...b, ...patch } : b,
        );
        set({ parametricBands: next, eqPreset: 'advanced' });
        sendHardwareCommandsDebounced('advanced-eq', () => [
          { command: OP.SET_ADVANCE_CUSTOM_EQ, payload: encodeAdvancedEq(next, get().firmwareVersion) },
          ...(previous !== 'advanced' ? eqPresetCommands('advanced', previous) : []),
        ]);
      },

      resetParametricBands: () => {
        const flat = DEFAULT_PARAMETRIC_BANDS.map((b) => ({ ...b, gain: 0 }));
        set({ parametricBands: flat });
        if (get().eqPreset === 'advanced') {
          sendHardwareCommandsDebounced('advanced-eq', () => [
            { command: OP.SET_ADVANCE_CUSTOM_EQ, payload: encodeAdvancedEq(flat, get().firmwareVersion) },
          ]);
        }
      },

      setUltraBass: (enabled, level) => {
        const nextLevel = level ?? get().ultraBassLevel;
        set({ ultraBassEnabled: enabled, ultraBassLevel: nextLevel });
        sendHardwareCommandDebounced(OP.SET_BASS_BOOST, encodeBassBoost(enabled, nextLevel));
      },

      setSpatialAudio: (mode) => {
        set({ spatialAudio: mode });
        void sendHardwareCommand(OP.SET_SPATIAL_AUDIO, encodeSpatialAudio(mode));
      },

      setGesture: (side, gesture, action) => {
        if (!PINCH_ALLOWED_ACTIONS[gesture].includes(action)) return;
        if (side === 'left') {
          set({ leftGestures: { ...get().leftGestures, [gesture]: action } });
        } else {
          set({ rightGestures: { ...get().rightGestures, [gesture]: action } });
        }
        if (supportsPinchGestures(getCurrentDevice(get().selectedModelId))) {
          void sendHardwareCommand(OP.SET_GESTURE, encodePinchGesture(side, gesture, action));
        }
      },

      setSmartDialEnabled: (enabled) => {
        set({ smartDialEnabled: enabled });
        if (smartDialWritable(getCurrentDevice(get().selectedModelId))) {
          void sendHardwareCommand(OP.SET_GESTURE, encodeSmartDialRotate(enabled));
        }
      },

      setSmartDialPress: (action) => {
        if (!DIAL_PRESS_ALLOWED.includes(action)) return;
        set({ smartDialPress: action });
        if (smartDialWritable(getCurrentDevice(get().selectedModelId))) {
          void sendHardwareCommand(OP.SET_GESTURE, encodeSmartDialPress(action));
        }
      },

      setInEarDetection: (enabled) => {
        set({ inEarDetection: enabled });
        void sendHardwareCommand(OP.SET_IN_EAR, encodeInEarDetection(enabled));
      },

      setLowLatencyMode: (enabled) => {
        set({ lowLatencyMode: enabled });
        void sendHardwareCommand(OP.SET_LOW_LAG, encodeLowLag(enabled));
      },

      setDualConnection: (enabled) => {
        set({ dualConnection: enabled });
        void sendHardwareCommand(OP.SET_DUAL, encodeDualConnection(enabled));
      },

      setHighResCodec: (enabled) => {
        set({ highResCodec: enabled });
        const device = getCurrentDevice(get().selectedModelId);
        void sendHardwareCommand(OP.SET_HIGH_QUALITY_AUDIO, encodeHighQualityAudio(enabled, device));
      },

      toggleFindMyEarbud: (side) => {
        if (side === 'left') {
          const next = !get().ringingLeft;
          set({ ringingLeft: next });
          setFindTonePlaying(next || get().ringingRight);
          void sendHardwareCommand(OP.FIND_DEVICE, encodeFindDevice(findSide('left'), next));
        } else {
          const next = !get().ringingRight;
          set({ ringingRight: next });
          setFindTonePlaying(next || get().ringingLeft);
          void sendHardwareCommand(OP.FIND_DEVICE, encodeFindDevice(findSide('right'), next));
        }
      },

      connectBluetoothDevice: async () => {
        await get().scanAndAutoConnect(true);
        if (get().connectionMode === 'connected') {
          return { ok: true };
        }
        return { ok: false, reason: 'unsupported' };
      },

      disconnectBluetoothDevice: async () => {
        setFindTonePlaying(false);
        set({
          connectionMode: 'demo',
          autoDetectStatus: 'not_found',
          activeMacU64: null,
          ringingLeft: false,
          ringingRight: false,
          lastCommandError: null,
        });
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
        eqPreset: s.eqPreset,
        customBands: s.customBands,
        parametricBands: s.parametricBands,
        ultraBassEnabled: s.ultraBassEnabled,
        ultraBassLevel: s.ultraBassLevel,
        spatialAudio: s.spatialAudio,
        leftGestures: s.leftGestures,
        rightGestures: s.rightGestures,
        smartDialEnabled: s.smartDialEnabled,
        smartDialPress: s.smartDialPress,
        inEarDetection: s.inEarDetection,
        lowLatencyMode: s.lowLatencyMode,
        dualConnection: s.dualConnection,
        highResCodec: s.highResCodec,
        ancMode: s.ancMode,
        ancLevel: s.ancLevel,
        personalAnc: s.personalAnc,
      }),
      migrate: (persisted, version) => {
        const p = { ...((persisted ?? {}) as Record<string, unknown>) };
        if (version < 2) {
          // v2: wind-noise toggle removed (no such command exists); gesture actions restricted
          // to what the buds accept; spatial modes extended.
          delete p.windNoiseReduction;
          p.leftGestures = sanitizeGestures(p.leftGestures as Partial<GestureSideState>);
          p.rightGestures = sanitizeGestures(p.rightGestures as Partial<GestureSideState>);
          if (!DIAL_PRESS_ALLOWED.includes(p.smartDialPress as GestureAction)) {
            p.smartDialPress = 'playPause';
          }
        }
        return p as unknown as PersistedDeviceState;
      },
    },
  ),
);

// ---------------------------------------------------------------------------
// Battery polling (only while connected)
// ---------------------------------------------------------------------------

let batteryTimer: ReturnType<typeof setInterval> | null = null;

async function pollBattery() {
  if (!isHardwareActive()) return;
  const frame = await sendHardwareCommand(OP.GET_BATTERY, [], { silent: true });
  const parsed = parseBatteryPayload(frame?.payload);
  if (!parsed || !isHardwareActive()) return;
  useDeviceStore.setState((state) => {
    const single =
      parsed.singleBattery || getCurrentDevice(state.selectedModelId).formFactor !== 'tws';
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
  const { formFactor } = getCurrentDevice(s.selectedModelId);
  const b = s.battery;
  if (formFactor === 'tws') {
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

  // Auto-detect connected Nothing / CMF Bluetooth devices on startup and
  // push persisted preferences to the backend.
  setTimeout(() => {
    const s = useDeviceStore.getState();
    void safeInvoke('set_close_to_tray', { enabled: s.closeToTray });
    scheduleTrayUpdate();
    void s.scanAndAutoConnect(false);
  }, 150);
}
