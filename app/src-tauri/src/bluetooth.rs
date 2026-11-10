use crate::device_match::{
    classify_device, parse_color_id, parse_model_code, resolve_model, DeviceClass,
};
use crate::protocol::{NothingFrame, MAX_ENCODE_PAYLOAD_LEN};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::OnceLock;
use tauri::{AppHandle, Emitter};

pub use crate::device_match::is_nothing_or_cmf_device;

/// Event carrying every unsolicited 0xE0xx frame read from a cached NT-link connection.
pub const EVENT_NOTIFICATION: &str = "nothing://notification";
/// Event emitted when a cached NT-link connection dies.
pub const EVENT_LINK_LOST: &str = "nothing://link-lost";

static APP: OnceLock<AppHandle> = OnceLock::new();

/// Stores the app handle used to emit Bluetooth events. Call once from `setup`.
pub fn init(app: AppHandle) {
    let _ = APP.set(app);
}

#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
fn emit<S: Serialize + Clone>(event: &str, payload: S) {
    if let Some(app) = APP.get() {
        let _ = app.emit(event, payload);
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationEvent {
    pub mac_u64: u64,
    pub command: u16,
    pub payload: Vec<u8>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkLostEvent {
    pub mac_u64: u64,
}

static FSN_COUNTER: AtomicU8 = AtomicU8::new(1);

/// Next value of the 1..=255 frame sequence counter (never 0).
pub fn advance_fsn(v: u8) -> u8 {
    if v == 0 || v == u8::MAX {
        1
    } else {
        v + 1
    }
}

/// Returns a fresh FSN in 1..=255; each value is issued once per cycle.
#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
fn next_fsn() -> u8 {
    match FSN_COUNTER.fetch_update(Ordering::Relaxed, Ordering::Relaxed, |v| {
        Some(advance_fsn(v))
    }) {
        Ok(prev) | Err(prev) => prev.max(1),
    }
}

fn check_payload_len(payload: &[u8]) -> Result<(), String> {
    if payload.len() > MAX_ENCODE_PAYLOAD_LEN {
        Err(format!(
            "Payload too large: {} bytes (max {})",
            payload.len(),
            MAX_ENCODE_PAYLOAD_LEN
        ))
    } else {
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedNothingDevice {
    pub name: String,
    pub mac_address: String,
    pub mac_u64: u64,
    pub connected: bool,
    pub remembered: bool,
    /// Best model id: 0xC01C model code > Fast Pair > name > "unknown".
    pub matched_model_id: String,
    pub matched_color_sku: Option<String>,
    pub fast_pair_id: Option<String>,
    /// Model code reported by 0xC01C (e.g. "B171").
    pub device_model_code: Option<String>,
    /// Colour id reported by 0xC00C, 2-digit hex (e.g. "01").
    pub device_color_id: Option<String>,
    pub firmware_version: Option<String>,
    pub serial_number: Option<String>,
    pub battery_left: Option<u8>,
    pub battery_left_charging: bool,
    pub battery_right: Option<u8>,
    pub battery_right_charging: bool,
    pub battery_case: Option<u8>,
    pub battery_case_charging: bool,
    pub is_headphone_single_battery: bool,
    pub anc_raw: Option<Vec<u8>>,
    pub eq_preset_index: Option<u8>,
}

impl DetectedNothingDevice {
    #[cfg_attr(not(target_os = "windows"), allow(dead_code))]
    fn new(name: String, mac_u64: u64, connected: bool, remembered: bool) -> Self {
        let (model_id, color_sku) = resolve_model(None, None, None, &name);
        Self {
            name: if name.is_empty() {
                "Nothing Audio Device".into()
            } else {
                name
            },
            mac_address: format_mac(mac_u64),
            mac_u64,
            connected,
            remembered,
            matched_model_id: model_id,
            matched_color_sku: color_sku,
            fast_pair_id: None,
            device_model_code: None,
            device_color_id: None,
            firmware_version: None,
            serial_number: None,
            battery_left: None,
            battery_left_charging: false,
            battery_right: None,
            battery_right_charging: false,
            battery_case: None,
            battery_case_charging: false,
            is_headphone_single_battery: false,
            anc_raw: None,
            eq_preset_index: None,
        }
    }

    /// Recomputes `matched_model_id` / `matched_color_sku` from everything probed so far.
    #[cfg_attr(not(target_os = "windows"), allow(dead_code))]
    fn refresh_model(&mut self) {
        let (model, sku) = resolve_model(
            self.device_model_code.as_deref(),
            self.device_color_id.as_deref(),
            self.fast_pair_id.as_deref(),
            &self.name,
        );
        self.matched_model_id = model;
        self.matched_color_sku = sku;
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BluetoothScanResult {
    pub devices: Vec<DetectedNothingDevice>,
    pub active_device: Option<DetectedNothingDevice>,
}

/// Legacy helper: maps a Bluetooth name and optional Fast Pair id to `(model, color SKU)`.
pub fn match_model_and_color(
    bt_name: &str,
    fast_pair_id: Option<&str>,
) -> (String, Option<String>) {
    resolve_model(None, None, fast_pair_id, bt_name)
}

pub fn format_mac(mac_u64: u64) -> String {
    format!(
        "{:02X}:{:02X}:{:02X}:{:02X}:{:02X}:{:02X}",
        (mac_u64 >> 40) & 0xFF,
        (mac_u64 >> 32) & 0xFF,
        (mac_u64 >> 24) & 0xFF,
        (mac_u64 >> 16) & 0xFF,
        (mac_u64 >> 8) & 0xFF,
        mac_u64 & 0xFF
    )
}

/// Parses a 0x4007 reply / 0xE001 notification: `[count, (id, raw)...]`,
/// `raw & 0x80` = charging, `raw & 0x7F` = level. id 2 = left, 3 = right, 4 = case,
/// 1/6/7 = single battery (headphone, neckband, speaker); the case stays `None` then.
pub fn parse_battery_payload(payload: &[u8], dev: &mut DetectedNothingDevice) {
    let Some(body) = payload.get(1..) else {
        return;
    };
    let (pairs, _) = body.as_chunks::<2>();
    for &[id, raw] in pairs {
        let level = raw & 0x7F;
        let charging = (raw & 0x80) != 0;
        match id {
            0x02 => {
                dev.battery_left = Some(level);
                dev.battery_left_charging = charging;
            }
            0x03 => {
                dev.battery_right = Some(level);
                dev.battery_right_charging = charging;
            }
            0x04 => {
                dev.battery_case = Some(level);
                dev.battery_case_charging = charging;
            }
            0x01 | 0x06 | 0x07 => {
                dev.is_headphone_single_battery = true;
                dev.battery_left = Some(level);
                dev.battery_left_charging = charging;
                dev.battery_right = Some(level);
                dev.battery_right_charging = charging;
            }
            _ => {}
        }
    }
}

/// Parses Google Fast Pair message-stream bytes (`[group u8][code u8][len u16 BE][data]`)
/// and returns the Model ID (group 0x03, code 0x01, 3 bytes) as uppercase hex.
///
/// Complete messages are consumed from `buf`; a partial trailing message is kept
/// so the caller can append more bytes and call again.
pub fn parse_fast_pair_model_id(buf: &mut Vec<u8>) -> Option<String> {
    const MAX_MSG_LEN: usize = 1024;
    while buf.len() >= 4 {
        let group = buf[0];
        let code = buf[1];
        let len = u16::from_be_bytes([buf[2], buf[3]]) as usize;
        if len > MAX_MSG_LEN {
            // Desynchronised stream: skip a byte and try to resync.
            buf.drain(..1);
            continue;
        }
        if buf.len() < 4 + len {
            return None;
        }
        let found = if group == 0x03 && code == 0x01 && len >= 3 {
            Some(format!("{:02X}{:02X}{:02X}", buf[4], buf[5], buf[6]))
        } else {
            None
        };
        buf.drain(..4 + len);
        if found.is_some() {
            return found;
        }
    }
    None
}

#[cfg(target_os = "windows")]
mod win_bt {
    //! Windows RFCOMM transport.
    //!
    //! Each cached NT-link connection ([`Link`]) owns a background reader thread that
    //! is the only place calling `recv`. It splits the stream into frames, feeds them to
    //! the connection's [`Router`] (which wakes waiting requests) and emits 0xE0xx frames
    //! as `nothing://notification`. On EOF/error it marks the link dead, removes it from
    //! the cache and emits `nothing://link-lost`. Senders only hold a short write lock,
    //! so a long notification wait (fit test) never blocks other commands.

    use super::*;
    use crate::protocol::{extract_frames, is_notification_cmd};
    use crate::router::{Poll, Router};
    use std::collections::{HashMap, HashSet};
    use std::ffi::c_void;
    use std::mem::{size_of, zeroed};
    use std::sync::atomic::AtomicU64;
    use std::sync::{Arc, Condvar, Mutex, MutexGuard};
    use std::time::{Duration, Instant};

    #[repr(C)]
    #[allow(non_snake_case, clippy::upper_case_acronyms)]
    struct SYSTEMTIME {
        wYear: u16,
        wMonth: u16,
        wDayOfWeek: u16,
        wDay: u16,
        wHour: u16,
        wMinute: u16,
        wSecond: u16,
        wMilliseconds: u16,
    }

    #[repr(C)]
    #[allow(non_snake_case)]
    struct BLUETOOTH_DEVICE_SEARCH_PARAMS {
        dwSize: u32,
        fReturnAuthenticated: i32,
        fReturnRemembered: i32,
        fReturnUnknown: i32,
        fReturnConnected: i32,
        fIssueInquiry: i32,
        cTimeoutMultiplier: u8,
        hRadio: *mut c_void,
    }

    #[repr(C)]
    #[allow(non_snake_case)]
    struct BLUETOOTH_DEVICE_INFO {
        dwSize: u32,
        Address: u64,
        ulClassofDevice: u32,
        fConnected: i32,
        fRemembered: i32,
        fAuthenticated: i32,
        stLastSeen: SYSTEMTIME,
        stLastUsed: SYSTEMTIME,
        szName: [u16; 248],
    }

    #[repr(C, packed(1))]
    #[allow(non_snake_case, clippy::upper_case_acronyms)]
    struct GUID {
        Data1: u32,
        Data2: u16,
        Data3: u16,
        Data4: [u8; 8],
    }

    #[repr(C, packed(1))]
    #[allow(non_snake_case)]
    struct SOCKADDR_BTH {
        addressFamily: u16,
        btAddr: u64,
        serviceClassId: GUID,
        port: u32,
    }

    #[repr(C)]
    #[allow(clippy::upper_case_acronyms)]
    struct WSADATA {
        data: [u8; 512],
    }

    #[repr(C)]
    #[allow(non_camel_case_types)]
    struct FD_SET {
        fd_count: u32,
        fd_array: [usize; 64],
    }

    impl FD_SET {
        fn single(s: usize) -> Self {
            let mut set = FD_SET {
                fd_count: 1,
                fd_array: [0; 64],
            };
            set.fd_array[0] = s;
            set
        }
    }

    #[repr(C)]
    #[allow(clippy::upper_case_acronyms)]
    struct TIMEVAL {
        tv_sec: i32,
        tv_usec: i32,
    }

    impl TIMEVAL {
        fn from_duration(d: Duration) -> Self {
            let micros = d.as_micros().min(i32::MAX as u128) as i64;
            TIMEVAL {
                tv_sec: (micros / 1_000_000) as i32,
                tv_usec: (micros % 1_000_000) as i32,
            }
        }
    }

    #[link(name = "bthprops")]
    extern "system" {
        fn BluetoothFindFirstDevice(
            pbtsp: *const BLUETOOTH_DEVICE_SEARCH_PARAMS,
            pbtdi: *mut BLUETOOTH_DEVICE_INFO,
        ) -> *mut c_void;
        fn BluetoothFindNextDevice(hfind: *mut c_void, pbtdi: *mut BLUETOOTH_DEVICE_INFO) -> i32;
        fn BluetoothFindDeviceClose(hfind: *mut c_void) -> i32;
    }

    #[link(name = "ws2_32")]
    extern "system" {
        fn WSAStartup(wVersionRequested: u16, lpWSAData: *mut WSADATA) -> i32;
        fn WSAGetLastError() -> i32;
        fn socket(af: i32, sock_type: i32, protocol: i32) -> usize;
        fn connect(s: usize, name: *const SOCKADDR_BTH, namelen: i32) -> i32;
        fn send(s: usize, buf: *const u8, len: i32, flags: i32) -> i32;
        fn recv(s: usize, buf: *mut u8, len: i32, flags: i32) -> i32;
        fn select(
            nfds: i32,
            readfds: *mut FD_SET,
            writefds: *mut FD_SET,
            exceptfds: *mut FD_SET,
            timeout: *const TIMEVAL,
        ) -> i32;
        fn setsockopt(s: usize, level: i32, optname: i32, optval: *const i32, optlen: i32) -> i32;
        fn getsockopt(
            s: usize,
            level: i32,
            optname: i32,
            optval: *mut i32,
            optlen: *mut i32,
        ) -> i32;
        fn ioctlsocket(s: usize, cmd: i32, argp: *mut u32) -> i32;
        fn shutdown(s: usize, how: i32) -> i32;
        fn closesocket(s: usize) -> i32;
    }

    const AF_BTH: i32 = 32;
    const SOCK_STREAM: i32 = 1;
    const BTHPROTO_RFCOMM: i32 = 3;
    const SOL_SOCKET: i32 = 0xFFFF;
    const SO_SNDTIMEO: i32 = 0x1005;
    const SO_RCVTIMEO: i32 = 0x1006;
    const SO_ERROR: i32 = 0x1007;
    const FIONBIO: i32 = 0x8004_667Eu32 as i32;
    const WSAEWOULDBLOCK: i32 = 10035;
    const SD_BOTH: i32 = 2;
    const INVALID_SOCKET: usize = usize::MAX;

    /// Safety-net blocking timeouts; normal reads are gated by `select`.
    const SOCKET_IO_TIMEOUT_MS: i32 = 2000;
    /// Upper bound for opening an RFCOMM channel (SDP + page).
    const CONNECT_TIMEOUT: Duration = Duration::from_secs(3);
    /// Per-request wait when probing telemetry during a scan.
    const PROBE_TIMEOUT: Duration = Duration::from_millis(600);
    /// Wait for a reply to a user-issued command.
    const COMMAND_TIMEOUT: Duration = Duration::from_millis(800);
    /// Wait for the Fast Pair message stream to push its Model ID.
    const FAST_PAIR_TIMEOUT: Duration = Duration::from_millis(600);
    /// Reader thread poll interval (also bounds how long a closed socket lingers).
    const READER_POLL: Duration = Duration::from_millis(500);

    // NT LINK UUID: aeac4a03-dff5-498f-843a-34487cf133eb
    const GUID_NT_LINK: GUID = GUID {
        Data1: 0xaeac4a03,
        Data2: 0xdff5,
        Data3: 0x498f,
        Data4: [0x84, 0x3a, 0x34, 0x48, 0x7c, 0xf1, 0x33, 0xeb],
    };

    // Google Fast Pair message stream UUID: df21fe2c-2515-4fdb-8886-f12c4d67927c
    const GUID_FASTPAIR_RFCOMM: GUID = GUID {
        Data1: 0xdf21fe2c,
        Data2: 0x2515,
        Data3: 0x4fdb,
        Data4: [0x88, 0x86, 0xf1, 0x2c, 0x4d, 0x67, 0x92, 0x7c],
    };

    fn wsa_err() -> i32 {
        unsafe { WSAGetLastError() }
    }

    /// Runs `WSAStartup` once and caches the outcome.
    fn ensure_wsa() -> Result<(), String> {
        static WSA: OnceLock<Result<(), String>> = OnceLock::new();
        WSA.get_or_init(|| unsafe {
            let mut wsa: WSADATA = zeroed();
            match WSAStartup(0x0202, &mut wsa) {
                0 => Ok(()),
                rc => Err(format!("WSAStartup failed (error {rc})")),
            }
        })
        .clone()
    }

    fn lock<T>(m: &Mutex<T>) -> MutexGuard<'_, T> {
        m.lock().unwrap_or_else(|e| e.into_inner())
    }

    /// Owned Winsock `SOCKET`; closed on drop.
    struct RawSocket(usize);

    // SAFETY: a SOCKET is a process-wide kernel handle. Winsock allows one thread to
    // `recv` (the reader) while another `send`s (serialised by `Link::write`) and a third
    // calls `shutdown`; the handle is only closed in Drop, after every user is gone.
    unsafe impl Send for RawSocket {}
    unsafe impl Sync for RawSocket {}

    impl Drop for RawSocket {
        fn drop(&mut self) {
            unsafe {
                let _ = closesocket(self.0);
            }
        }
    }

    impl RawSocket {
        /// Opens an RFCOMM channel with a bounded connect time (non-blocking connect +
        /// `select`), then switches the socket back to blocking mode.
        fn open(bt_addr: u64, guid: GUID, timeout: Duration) -> Result<Self, String> {
            ensure_wsa()?;
            unsafe {
                let s = socket(AF_BTH, SOCK_STREAM, BTHPROTO_RFCOMM);
                if s == INVALID_SOCKET {
                    return Err(format!(
                        "Failed to create Bluetooth socket (WSA error {})",
                        wsa_err()
                    ));
                }
                let sock = RawSocket(s);
                let t = SOCKET_IO_TIMEOUT_MS;
                let _ = setsockopt(s, SOL_SOCKET, SO_RCVTIMEO, &t, 4);
                let _ = setsockopt(s, SOL_SOCKET, SO_SNDTIMEO, &t, 4);

                let mut non_blocking: u32 = 1;
                if ioctlsocket(s, FIONBIO, &mut non_blocking) != 0 {
                    return Err(format!(
                        "Failed to configure Bluetooth socket (WSA error {})",
                        wsa_err()
                    ));
                }
                let sa = SOCKADDR_BTH {
                    addressFamily: AF_BTH as u16,
                    btAddr: bt_addr,
                    serviceClassId: guid,
                    port: 0,
                };
                if connect(s, &sa, size_of::<SOCKADDR_BTH>() as i32) != 0 {
                    let err = wsa_err();
                    if err != WSAEWOULDBLOCK {
                        return Err(format!("Failed to open RFCOMM channel (WSA error {err})"));
                    }
                    let mut wset = FD_SET::single(s);
                    let mut eset = FD_SET::single(s);
                    let tv = TIMEVAL::from_duration(timeout);
                    let rc = select(0, std::ptr::null_mut(), &mut wset, &mut eset, &tv);
                    if rc == 0 {
                        return Err("Timed out opening RFCOMM channel".into());
                    }
                    if rc < 0 {
                        return Err(format!(
                            "Failed to open RFCOMM channel (select, WSA error {})",
                            wsa_err()
                        ));
                    }
                    if eset.fd_count > 0 || wset.fd_count == 0 {
                        let mut so_err: i32 = 0;
                        let mut len: i32 = 4;
                        let _ = getsockopt(s, SOL_SOCKET, SO_ERROR, &mut so_err, &mut len);
                        return Err(format!(
                            "Failed to open RFCOMM channel (WSA error {so_err})"
                        ));
                    }
                }
                let mut blocking: u32 = 0;
                if ioctlsocket(s, FIONBIO, &mut blocking) != 0 {
                    return Err(format!(
                        "Failed to configure Bluetooth socket (WSA error {})",
                        wsa_err()
                    ));
                }
                Ok(sock)
            }
        }

        fn send_all(&self, mut data: &[u8]) -> Result<(), String> {
            while !data.is_empty() {
                let n = unsafe { send(self.0, data.as_ptr(), data.len() as i32, 0) };
                if n <= 0 {
                    return Err(format!("Failed to send packet (WSA error {})", wsa_err()));
                }
                data = &data[n as usize..];
            }
            Ok(())
        }

        /// Waits until data is readable. `Ok(false)` on timeout.
        fn wait_readable(&self, timeout: Duration) -> Result<bool, String> {
            let mut set = FD_SET::single(self.0);
            let tv = TIMEVAL::from_duration(timeout);
            let rc =
                unsafe { select(0, &mut set, std::ptr::null_mut(), std::ptr::null_mut(), &tv) };
            match rc {
                0 => Ok(false),
                n if n > 0 => Ok(true),
                _ => Err(format!("Connection lost (select, WSA error {})", wsa_err())),
            }
        }

        /// Reads whatever is available (call after `wait_readable` returned true).
        fn recv_some(&self, buf: &mut [u8]) -> Result<usize, String> {
            let n = unsafe { recv(self.0, buf.as_mut_ptr(), buf.len() as i32, 0) };
            match n {
                0 => Err("Connection closed by device".into()),
                n if n < 0 => Err(format!("Connection lost (WSA error {})", wsa_err())),
                n => Ok(n as usize),
            }
        }

        /// Appends newly received bytes to `buf`; `Ok(false)` once `deadline` passes.
        fn read_more(&self, buf: &mut Vec<u8>, deadline: Instant) -> Result<bool, String> {
            let now = Instant::now();
            if now >= deadline || !self.wait_readable(deadline - now)? {
                return Ok(false);
            }
            let mut chunk = [0u8; 512];
            let n = self.recv_some(&mut chunk)?;
            buf.extend_from_slice(&chunk[..n]);
            Ok(true)
        }

        /// Wakes a blocked reader (select/recv return) without closing the handle.
        fn shutdown(&self) {
            unsafe {
                let _ = shutdown(self.0, SD_BOTH);
            }
        }
    }

    struct LinkState {
        router: Router,
        /// Set once the reader thread stopped; the reason is returned to waiters.
        dead: Option<String>,
    }

    /// A cached Nothing-Link RFCOMM connection with its own reader thread.
    struct Link {
        mac: u64,
        sock: RawSocket,
        write: Mutex<()>,
        state: Mutex<LinkState>,
        cv: Condvar,
    }

    impl Link {
        fn is_dead(&self) -> bool {
            lock(&self.state).dead.is_some()
        }

        fn send_frame(&self, raw: &[u8]) -> Result<(), String> {
            let _w = lock(&self.write);
            self.sock.send_all(raw)
        }

        /// Sends one request and waits for its routed reply (see `router` for the rule).
        /// `Ok(None)` = no reply before `timeout`; `Err` = the link is broken.
        fn request(
            &self,
            command: u16,
            payload: &[u8],
            timeout: Duration,
        ) -> Result<Option<NothingFrame>, String> {
            let fsn = next_fsn();
            let pkt = NothingFrame::encode(command, fsn, payload)?;
            let id = {
                let mut st = lock(&self.state);
                if let Some(reason) = &st.dead {
                    return Err(reason.clone());
                }
                st.router.register_request(command, fsn)
            };
            if let Err(e) = self.send_frame(&pkt.raw_bytes) {
                lock(&self.state).router.cancel_request(id);
                return Err(e);
            }
            let deadline = Instant::now() + timeout;
            let mut st = lock(&self.state);
            loop {
                let now = Instant::now();
                let wake = match st.router.poll_request(id, now) {
                    Poll::Ready(frame) => return Ok(Some(frame)),
                    Poll::Wait(wake) => wake,
                };
                if let Some(reason) = &st.dead {
                    let reason = reason.clone();
                    st.router.cancel_request(id);
                    return Err(reason);
                }
                if now >= deadline {
                    return Ok(st.router.finish_request(id, now));
                }
                let until = wake.map_or(deadline, |w| w.min(deadline));
                let wait = until
                    .saturating_duration_since(now)
                    .max(Duration::from_millis(1));
                st = self
                    .cv
                    .wait_timeout(st, wait)
                    .unwrap_or_else(|e| e.into_inner())
                    .0;
            }
        }

        /// Sends one request, then waits for the next frame with command `notify_cmd`
        /// (e.g. fit test 0xF014 -> 0xE00D). The state lock is released while waiting.
        fn request_notification(
            &self,
            command: u16,
            payload: &[u8],
            notify_cmd: u16,
            timeout: Duration,
        ) -> Result<Option<NothingFrame>, String> {
            let pkt = NothingFrame::encode(command, next_fsn(), payload)?;
            let id = {
                let mut st = lock(&self.state);
                if let Some(reason) = &st.dead {
                    return Err(reason.clone());
                }
                st.router.register_notify(notify_cmd)
            };
            if let Err(e) = self.send_frame(&pkt.raw_bytes) {
                lock(&self.state).router.cancel_notify(id);
                return Err(e);
            }
            let deadline = Instant::now() + timeout;
            let mut st = lock(&self.state);
            loop {
                if let Some(frame) = st.router.take_notify(id) {
                    return Ok(Some(frame));
                }
                if let Some(reason) = &st.dead {
                    let reason = reason.clone();
                    st.router.cancel_notify(id);
                    return Err(reason);
                }
                let now = Instant::now();
                if now >= deadline {
                    st.router.cancel_notify(id);
                    return Ok(None);
                }
                st = self
                    .cv
                    .wait_timeout(st, deadline - now)
                    .unwrap_or_else(|e| e.into_inner())
                    .0;
            }
        }
    }

    /// Background reader: the only `recv` caller for a link.
    fn reader_loop(link: Arc<Link>) {
        let mut buf: Vec<u8> = Vec::with_capacity(2048);
        let mut chunk = [0u8; 1024];
        let reason = loop {
            match link.sock.wait_readable(READER_POLL) {
                Ok(false) => continue,
                Ok(true) => {}
                Err(e) => break e,
            }
            let n = match link.sock.recv_some(&mut chunk) {
                Ok(n) => n,
                Err(e) => break e,
            };
            buf.extend_from_slice(&chunk[..n]);
            let frames = extract_frames(&mut buf);
            if frames.is_empty() {
                continue;
            }
            let now = Instant::now();
            {
                let mut st = lock(&link.state);
                for f in &frames {
                    st.router.on_frame(f, now);
                }
            }
            link.cv.notify_all();
            for f in frames {
                if is_notification_cmd(f.command) {
                    set_last_active(link.mac);
                    emit(
                        EVENT_NOTIFICATION,
                        NotificationEvent {
                            mac_u64: link.mac,
                            command: f.command,
                            payload: f.payload,
                        },
                    );
                }
            }
        };
        lock(&link.state).dead = Some(reason);
        link.cv.notify_all();
        remove_cached(link.mac, &link);
        emit(EVENT_LINK_LOST, LinkLostEvent { mac_u64: link.mac });
    }

    fn links() -> &'static Mutex<HashMap<u64, Arc<Link>>> {
        static LINKS: OnceLock<Mutex<HashMap<u64, Arc<Link>>>> = OnceLock::new();
        LINKS.get_or_init(|| Mutex::new(HashMap::new()))
    }

    /// Serialises *opening* a link per MAC so two callers never open two sockets.
    /// Requests on an already open link never take it.
    fn connect_gate(mac: u64) -> Arc<Mutex<()>> {
        static GATES: OnceLock<Mutex<HashMap<u64, Arc<Mutex<()>>>>> = OnceLock::new();
        let gates = GATES.get_or_init(|| Mutex::new(HashMap::new()));
        lock(gates).entry(mac).or_default().clone()
    }

    /// MACs whose NT-link connect succeeded this session (they are Nothing/CMF devices).
    fn verified() -> &'static Mutex<HashSet<u64>> {
        static VERIFIED: OnceLock<Mutex<HashSet<u64>>> = OnceLock::new();
        VERIFIED.get_or_init(|| Mutex::new(HashSet::new()))
    }

    static LAST_ACTIVE: AtomicU64 = AtomicU64::new(0);

    fn set_last_active(mac: u64) {
        LAST_ACTIVE.store(mac, Ordering::Relaxed);
    }

    fn cached_live(mac: u64) -> Option<Arc<Link>> {
        let map = lock(links());
        map.get(&mac).filter(|l| !l.is_dead()).cloned()
    }

    fn remove_cached(mac: u64, link: &Arc<Link>) {
        let mut map = lock(links());
        if map.get(&mac).is_some_and(|l| Arc::ptr_eq(l, link)) {
            map.remove(&mac);
        }
    }

    /// Drops `link` from the cache and stops its reader.
    fn drop_link(mac: u64, link: &Arc<Link>) {
        remove_cached(mac, link);
        link.sock.shutdown();
    }

    /// Drops any cached connection to `mac` (device went away).
    fn evict(mac: u64) {
        let link = lock(links()).remove(&mac);
        if let Some(link) = link {
            link.sock.shutdown();
        }
    }

    /// Returns the cached live link, or opens one. `bool` = it already existed.
    /// The socket is opened outside the cache lock and outside any request path.
    fn get_link(mac: u64) -> Result<(Arc<Link>, bool), String> {
        if let Some(link) = cached_live(mac) {
            return Ok((link, true));
        }
        let gate = connect_gate(mac);
        let _g = lock(&gate);
        if let Some(link) = cached_live(mac) {
            return Ok((link, true));
        }
        let sock = RawSocket::open(mac, GUID_NT_LINK, CONNECT_TIMEOUT)?;
        let link = Arc::new(Link {
            mac,
            sock,
            write: Mutex::new(()),
            state: Mutex::new(LinkState {
                router: Router::new(),
                dead: None,
            }),
            cv: Condvar::new(),
        });
        let reader = link.clone();
        std::thread::Builder::new()
            .name(format!("nt-link-{}", format_mac(mac)))
            .spawn(move || reader_loop(reader))
            .map_err(|e| format!("Failed to start reader thread: {e}"))?;
        lock(links()).insert(mac, link.clone());
        lock(verified()).insert(mac);
        Ok((link, false))
    }

    /// Runs `op` on the cached link. If it fails on a link that was already cached
    /// (possibly stale), the link is dropped and `op` retried once on a fresh one.
    fn with_link<T>(mac: u64, op: impl Fn(&Link) -> Result<T, String>) -> Result<T, String> {
        let (link, reused) = get_link(mac)?;
        match op(&link) {
            Ok(v) => Ok(v),
            Err(e) => {
                drop_link(mac, &link);
                if !reused {
                    return Err(e);
                }
                let (fresh, _) = get_link(mac)?;
                let r = op(&fresh);
                if r.is_err() {
                    drop_link(mac, &fresh);
                }
                r
            }
        }
    }

    fn transact(
        mac: u64,
        command: u16,
        payload: &[u8],
        timeout: Duration,
    ) -> Result<Option<NothingFrame>, String> {
        with_link(mac, |link| link.request(command, payload, timeout))
    }

    /// Reads the Fast Pair Model ID pushed by the device on the message-stream channel.
    /// Nothing is sent: the provider announces its Model ID right after connect.
    fn query_fast_pair_id(bt_addr: u64) -> Option<String> {
        let sock = RawSocket::open(bt_addr, GUID_FASTPAIR_RFCOMM, CONNECT_TIMEOUT).ok()?;
        let deadline = Instant::now() + FAST_PAIR_TIMEOUT;
        let mut buf = Vec::with_capacity(64);
        loop {
            if let Some(id) = parse_fast_pair_model_id(&mut buf) {
                return Some(id);
            }
            match sock.read_more(&mut buf, deadline) {
                Ok(true) => {}
                _ => return None,
            }
        }
    }

    /// Probes a connected device over the NT link. Returns false if the NT link could
    /// not be used at all. `fast_pair_on_failure` also tries Fast Pair in that case.
    fn probe_nothing_telemetry(
        dev: &mut DetectedNothingDevice,
        fast_pair_on_failure: bool,
    ) -> bool {
        let mac = dev.mac_u64;
        let read = |cmd: u16, payload: &[u8]| transact(mac, cmd, payload, PROBE_TIMEOUT);

        // 1. Battery (0xC007). An Err here means the NT link is unreachable.
        let battery = match read(0xC007, &[]) {
            Ok(f) => f,
            Err(_) => {
                if fast_pair_on_failure {
                    dev.fast_pair_id = query_fast_pair_id(mac);
                    dev.refresh_model();
                }
                return false;
            }
        };
        dev.connected = true;
        if let Some(frame) = battery {
            parse_battery_payload(&frame.payload, dev);
        }

        // 2. Model (0xC01C) and colour (0xC00C); Fast Pair only if they are missing.
        if let Ok(Some(f)) = read(0xC01C, &[]) {
            dev.device_model_code = parse_model_code(&f.payload);
        }
        if let Ok(Some(f)) = read(0xC00C, &[]) {
            dev.device_color_id = parse_color_id(&f.payload);
        }
        if dev.device_model_code.is_none() || dev.device_color_id.is_none() {
            dev.fast_pair_id = query_fast_pair_id(mac);
        }
        dev.refresh_model();

        // 3. Firmware (0xC042)
        match read(0xC042, &[]) {
            Ok(Some(frame)) => {
                if let Ok(fw) = String::from_utf8(frame.payload) {
                    let trimmed = fw.trim_matches(char::from(0)).trim().to_string();
                    if !trimmed.is_empty() {
                        dev.firmware_version = Some(trimmed);
                    }
                }
            }
            Ok(None) => {}
            Err(_) => return true,
        }

        // 4. Extended info / serial number (0xC006)
        match read(0xC006, &[]) {
            Ok(Some(frame)) => {
                if frame.payload.len() > 1 {
                    let text = String::from_utf8_lossy(&frame.payload[1..]);
                    for line in text.lines() {
                        let parts: Vec<&str> = line.split(',').collect();
                        if parts.len() >= 3 && parts[1] == "4" && !parts[2].is_empty() {
                            dev.serial_number = Some(parts[2].trim().to_string());
                        }
                    }
                }
            }
            Ok(None) => {}
            Err(_) => return true,
        }

        // 5. ANC status (0xC01E, payload [0x03] like the app's getANC)
        match read(0xC01E, &[0x03]) {
            Ok(Some(frame)) => dev.anc_raw = Some(frame.payload),
            Ok(None) => {}
            Err(_) => return true,
        }

        // 6. EQ preset (0xC01F)
        if let Ok(Some(frame)) = read(0xC01F, &[]) {
            if let Some(&preset) = frame.payload.first() {
                dev.eq_preset_index = Some(preset);
            }
        }
        true
    }

    /// Paired devices as `(name, mac, connected, remembered)`.
    fn enumerate_paired() -> Vec<(String, u64, bool, bool)> {
        let mut out = Vec::new();
        unsafe {
            let params = BLUETOOTH_DEVICE_SEARCH_PARAMS {
                dwSize: size_of::<BLUETOOTH_DEVICE_SEARCH_PARAMS>() as u32,
                fReturnAuthenticated: 1,
                fReturnRemembered: 1,
                fReturnUnknown: 0,
                fReturnConnected: 1,
                fIssueInquiry: 0,
                cTimeoutMultiplier: 1,
                hRadio: std::ptr::null_mut(),
            };
            let mut info: BLUETOOTH_DEVICE_INFO = zeroed();
            info.dwSize = size_of::<BLUETOOTH_DEVICE_INFO>() as u32;

            let hfind = BluetoothFindFirstDevice(&params, &mut info);
            if hfind.is_null() {
                return out;
            }
            loop {
                let name_len = info
                    .szName
                    .iter()
                    .position(|&c| c == 0)
                    .unwrap_or(info.szName.len());
                let name = String::from_utf16_lossy(&info.szName[..name_len])
                    .trim()
                    .to_string();
                out.push((
                    name,
                    info.Address,
                    info.fConnected != 0,
                    info.fRemembered != 0,
                ));
                info = zeroed();
                info.dwSize = size_of::<BLUETOOTH_DEVICE_INFO>() as u32;
                if BluetoothFindNextDevice(hfind, &mut info) == 0 {
                    break;
                }
            }
            let _ = BluetoothFindDeviceClose(hfind);
        }
        out
    }

    pub fn scan_devices() -> BluetoothScanResult {
        let known = lock(verified()).clone();
        let mut candidates: Vec<(DetectedNothingDevice, bool /* needs link proof */)> = Vec::new();
        for (name, mac, connected, remembered) in enumerate_paired() {
            let class = if known.contains(&mac) {
                DeviceClass::Nothing
            } else {
                classify_device(&name, mac)
            };
            match class {
                DeviceClass::Nothing => candidates.push((
                    DetectedNothingDevice::new(name, mac, connected, remembered),
                    false,
                )),
                // Generic names are only trusted once the NT-link connect succeeds.
                DeviceClass::NeedsLinkProbe if connected => candidates.push((
                    DetectedNothingDevice::new(name, mac, connected, remembered),
                    true,
                )),
                _ => {}
            }
        }

        let mut devices = Vec::with_capacity(candidates.len());
        for (mut dev, needs_proof) in candidates {
            if dev.connected {
                let reachable = probe_nothing_telemetry(&mut dev, !needs_proof);
                if needs_proof && !reachable {
                    continue;
                }
            } else {
                // Device is gone: drop any stale cached connection.
                evict(dev.mac_u64);
            }
            devices.push(dev);
        }

        // Connected devices first, then by name.
        devices.sort_by(|a, b| (!a.connected, &a.name).cmp(&(!b.connected, &b.name)));
        let last = LAST_ACTIVE.load(Ordering::Relaxed);
        let active_device = devices
            .iter()
            .find(|d| d.connected && d.mac_u64 == last)
            .or_else(|| devices.iter().find(|d| d.connected))
            .cloned();
        BluetoothScanResult {
            devices,
            active_device,
        }
    }

    /// Sends `command`, then resolves with the first `notify_cmd` frame received after it.
    /// Retries once on a fresh connection if a cached one turned out stale.
    pub fn send_and_wait_notification(
        mac_u64: u64,
        command: u16,
        payload: &[u8],
        notify_cmd: u16,
        timeout: Duration,
    ) -> Result<Option<NothingFrame>, String> {
        let r = with_link(mac_u64, |link| {
            link.request_notification(command, payload, notify_cmd, timeout)
        });
        if r.is_ok() {
            set_last_active(mac_u64);
        }
        r
    }

    pub fn send_command_to_device(
        mac_u64: u64,
        command: u16,
        payload: &[u8],
    ) -> Result<Option<NothingFrame>, String> {
        let r = transact(mac_u64, command, payload, COMMAND_TIMEOUT);
        if r.is_ok() {
            set_last_active(mac_u64);
        }
        r
    }
}

fn scan_blocking() -> BluetoothScanResult {
    #[cfg(target_os = "windows")]
    {
        win_bt::scan_devices()
    }
    #[cfg(not(target_os = "windows"))]
    {
        BluetoothScanResult {
            devices: vec![],
            active_device: None,
        }
    }
}

fn send_blocking(
    mac_u64: u64,
    command: u16,
    payload: Vec<u8>,
) -> Result<Option<NothingFrame>, String> {
    check_payload_len(&payload)?;
    #[cfg(target_os = "windows")]
    {
        win_bt::send_command_to_device(mac_u64, command, &payload)
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (mac_u64, command, payload);
        Err("Windows only".into())
    }
}

/// Sends `command`, then waits up to `timeout_ms` for a notification frame `notify_cmd`.
#[tauri::command]
pub async fn send_and_await_notification(
    mac_u64: u64,
    command: u16,
    payload: Vec<u8>,
    notify_cmd: u16,
    timeout_ms: u64,
) -> Result<Option<NothingFrame>, String> {
    check_payload_len(&payload)?;
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(target_os = "windows")]
        {
            win_bt::send_and_wait_notification(
                mac_u64,
                command,
                &payload,
                notify_cmd,
                std::time::Duration::from_millis(timeout_ms.min(30_000)),
            )
        }
        #[cfg(not(target_os = "windows"))]
        {
            let _ = (mac_u64, command, payload, notify_cmd, timeout_ms);
            Err::<Option<NothingFrame>, String>("Windows only".into())
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Enumerates paired Nothing/CMF devices and probes connected ones, off the main thread.
#[tauri::command]
pub async fn scan_bluetooth_devices() -> Result<BluetoothScanResult, String> {
    tauri::async_runtime::spawn_blocking(scan_blocking)
        .await
        .map_err(|e| e.to_string())
}

/// Sends one Nothing frame; resolves to the matching response frame, or `null` on timeout.
#[tauri::command]
pub async fn send_bluetooth_command(
    mac_u64: u64,
    command: u16,
    payload: Vec<u8>,
) -> Result<Option<NothingFrame>, String> {
    tauri::async_runtime::spawn_blocking(move || send_blocking(mac_u64, command, payload))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn open_windows_bluetooth_settings() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        std::process::Command::new("cmd")
            .args(["/C", "start", "ms-settings:bluetooth"])
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[ignore = "requires real Bluetooth hardware"]
    fn test_live_bluetooth_scan() {
        let res = scan_blocking();
        println!("Scanned devices: {:#?}", res);
    }

    #[test]
    fn fast_pair_model_id_after_other_messages() {
        // Some other message (group 0x01, code 0x02, 2 bytes), then Model ID 2D6FDA.
        let mut buf = vec![
            0x01, 0x02, 0x00, 0x02, 0xAA, 0xBB, 0x03, 0x01, 0x00, 0x03, 0x2D, 0x6F, 0xDA,
        ];
        assert_eq!(
            parse_fast_pair_model_id(&mut buf).as_deref(),
            Some("2D6FDA")
        );
        assert!(buf.is_empty());
    }

    #[test]
    fn fast_pair_partial_message_waits() {
        let mut buf = vec![0x03, 0x01, 0x00, 0x03, 0xC1];
        assert_eq!(parse_fast_pair_model_id(&mut buf), None);
        buf.extend_from_slice(&[0x9E, 0xCD]);
        assert_eq!(
            parse_fast_pair_model_id(&mut buf).as_deref(),
            Some("C19ECD")
        );
    }

    #[test]
    fn fast_pair_ble_address_is_not_model_id() {
        let mut buf = vec![0x03, 0x02, 0x00, 0x06, 1, 2, 3, 4, 5, 6];
        assert_eq!(parse_fast_pair_model_id(&mut buf), None);
        assert!(buf.is_empty());
    }

    #[test]
    fn fsn_counter_skips_zero_without_repeats() {
        let mut v = 1u8;
        let mut seen = std::collections::HashSet::new();
        for _ in 0..255 {
            assert_ne!(v, 0);
            assert!(seen.insert(v), "fsn {v} issued twice in one cycle");
            v = advance_fsn(v);
        }
        assert_eq!(v, 1, "wraps 255 -> 1");
        assert_eq!(advance_fsn(0), 1);
        for _ in 0..600 {
            assert_ne!(next_fsn(), 0);
        }
    }

    #[test]
    fn battery_parsing() {
        let mut dev = DetectedNothingDevice::new("Nothing Ear".into(), 0, true, true);
        parse_battery_payload(&[3, 0x02, 0x50, 0x03, 0xD5, 0x04, 0x20], &mut dev);
        assert_eq!(dev.battery_left, Some(0x50));
        assert!(!dev.battery_left_charging);
        assert_eq!(dev.battery_right, Some(0x55));
        assert!(dev.battery_right_charging);
        assert_eq!(dev.battery_case, Some(0x20));

        let mut hp = DetectedNothingDevice::new("Nothing Headphone (1)".into(), 0, true, true);
        parse_battery_payload(&[1, 0x06, 0x80 | 64], &mut hp);
        assert!(hp.is_headphone_single_battery);
        assert_eq!(hp.battery_left, Some(64));
        assert!(hp.battery_left_charging);
        assert_eq!(hp.battery_case, None, "single-battery devices have no case");
    }

    #[test]
    fn unknown_name_is_not_b171() {
        let dev = DetectedNothingDevice::new(String::new(), 0, false, true);
        assert_eq!(dev.name, "Nothing Audio Device");
        assert_eq!(dev.matched_model_id, crate::device_match::UNKNOWN_MODEL);
        assert_eq!(match_model_and_color("Nothing Ear", None).0, "B171");
    }

    #[test]
    fn event_payloads_are_camel_case() {
        let n = serde_json::to_value(NotificationEvent {
            mac_u64: 1,
            command: 0xE001,
            payload: vec![1],
        })
        .unwrap();
        assert_eq!(n["macU64"], 1);
        assert_eq!(n["command"], 0xE001);
        let l = serde_json::to_value(LinkLostEvent { mac_u64: 7 }).unwrap();
        assert_eq!(l["macU64"], 7);
        let d =
            serde_json::to_value(DetectedNothingDevice::new("x".into(), 0, false, false)).unwrap();
        assert!(d.get("device_model_code").is_some());
        assert!(d.get("device_color_id").is_some());
    }
}
