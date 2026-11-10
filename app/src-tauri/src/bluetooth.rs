use crate::protocol::NothingFrame;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU8, Ordering};

static FSN_COUNTER: AtomicU8 = AtomicU8::new(1);

#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
fn next_fsn() -> u8 {
    let v = FSN_COUNTER.fetch_add(1, Ordering::Relaxed);
    if v == 0 {
        1
    } else {
        v
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedNothingDevice {
    pub name: String,
    pub mac_address: String,
    pub mac_u64: u64,
    pub connected: bool,
    pub remembered: bool,
    pub matched_model_id: String,
    pub matched_color_sku: Option<String>,
    pub fast_pair_id: Option<String>,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BluetoothScanResult {
    pub devices: Vec<DetectedNothingDevice>,
    pub active_device: Option<DetectedNothingDevice>,
}

/// Maps Bluetooth device name and optional FastPairId to our catalog modelId & color SKU
pub fn match_model_and_color(
    bt_name: &str,
    fast_pair_id: Option<&str>,
) -> (String, Option<String>) {
    if let Some(fp) = fast_pair_id {
        match fp.to_uppercase().as_str() {
            // Nothing Headphone (1) (B170)
            "C19ECD" => return ("B170".into(), Some("B170_01".into())),
            "2D6FDA" => return ("B170".into(), Some("B170_09".into())),
            // Nothing Ear (2024) (B171)
            "A20444" => return ("B171".into(), Some("B171_01".into())),
            "FEB1C7" => return ("B171".into(), Some("B171_02".into())),
            // Nothing Ear (a) (B162)
            "03464E" => return ("B162".into(), Some("B162_01".into())),
            "5E3FBC" => return ("B162".into(), Some("B162_02".into())),
            "839E9A" => return ("B162".into(), Some("B162_08".into())),
            // Nothing Ear (open) (B174)
            "FC3AAF" | "CC3444" => return ("B174".into(), Some("B174_02".into())),
            // Nothing Ear (2) (B155)
            "DEE8C0" => return ("B155".into(), Some("B155_01".into())),
            "ACC520" => return ("B155".into(), Some("B155_02".into())),
            // Nothing Ear (1) (B181)
            "624011" => return ("B181".into(), Some("B181_01".into())),
            "31D53D" => return ("B181".into(), Some("B181_02".into())),
            // Nothing Ear (stick) (B157)
            "1016DD" => return ("B157".into(), Some("B157_02".into())),
            // CMF Buds Pro 2 (B172 / B187)
            "2F45F5" => return ("B172".into(), Some("B172_01".into())),
            "E1BE45" => return ("B172".into(), Some("B172_02".into())),
            "0F1A4F" => return ("B172".into(), Some("B172_03".into())),
            "A7B220" => return ("B172".into(), Some("B172_07".into())),
            // CMF Buds (B168)
            "150A27" => return ("B168".into(), Some("B168_01".into())),
            "ACCE54" => return ("B168".into(), Some("B168_02".into())),
            "D35E18" => return ("B168".into(), Some("B168_07".into())),
            // CMF Buds Pro (B163)
            "ADD2C4" => return ("B163".into(), Some("B163_01".into())),
            "2EB1CA" => return ("B163".into(), Some("B163_02".into())),
            "5F8F82" => return ("B163".into(), Some("B163_07".into())),
            // CMF Buds 2 Plus (B184)
            "4AEB6E" => return ("B184".into(), Some("B184_02".into())),
            "5C587F" => return ("B184".into(), Some("B184_03".into())),
            // CMF Neckband Pro (B164)
            "AE35FD" => return ("B164".into(), Some("B164_01".into())),
            "26C190" => return ("B164".into(), Some("B164_02".into())),
            "4DFC4A" => return ("B164".into(), Some("B164_07".into())),
            // CMF Headphone Pro (B175)
            "1EFB39" => return ("B175".into(), Some("B175_01".into())),
            "73C9EB" => return ("B175".into(), Some("B175_02".into())),
            "563DA5" => return ("B175".into(), Some("B175_06".into())),
            _ => {}
        }
    }

    let lower = bt_name.to_lowercase();
    if lower.contains("headphone pro") {
        ("B175".into(), None)
    } else if lower.contains("headphone (1)") || lower.contains("headphone 1") {
        ("B170".into(), None)
    } else if lower.contains("ear (open)") || lower.contains("ear open") {
        ("B174".into(), None)
    } else if lower.contains("ear (a)") || lower.contains("ear a") {
        ("B162".into(), None)
    } else if lower.contains("ear (2)") || lower.contains("ear 2") {
        ("B155".into(), None)
    } else if lower.contains("ear (1)") || lower.contains("ear 1") {
        ("B181".into(), None)
    } else if lower.contains("ear (stick)") || lower.contains("ear stick") {
        ("B157".into(), None)
    } else if lower.contains("buds pro 2") {
        ("B172".into(), None)
    } else if lower.contains("buds 2 plus") {
        ("B184".into(), None)
    } else if lower.contains("buds pro") {
        ("B163".into(), None)
    } else if lower.contains("neckband pro") {
        ("B164".into(), None)
    } else if lower.contains("cmf buds") || lower == "buds" {
        ("B168".into(), None)
    } else {
        ("B171".into(), None)
    }
}

pub fn is_nothing_or_cmf_device(name: &str, mac_u64: u64) -> bool {
    let oui = ((mac_u64 >> 24) & 0xFFFFFF) as u32;
    // Official Nothing / CMF OUI prefixes from devices_info_list.json:
    // 2C:BE:EB, 3C:B0:ED, 2C:BE:EE, 04:5A:3D
    if matches!(oui, 0x2CBEEB | 0x3CB0ED | 0x2CBEEE | 0x045A3D) {
        return true;
    }
    let lower = name.to_lowercase();
    lower.contains("nothing")
        || lower.contains("cmf")
        || lower.contains("ear (1)")
        || lower.contains("ear (2)")
        || lower.contains("ear (a)")
        || lower.contains("ear (open)")
        || lower.contains("ear (stick)")
        || lower.contains("headphone (1)")
        || lower.contains("buds pro")
        || lower.contains("neckband pro")
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
    use super::*;
    use crate::protocol::{extract_frames, is_response_to};
    use std::collections::HashMap;
    use std::ffi::c_void;
    use std::mem::{size_of, zeroed};
    use std::sync::{Arc, Mutex, Once, OnceLock};
    use std::time::{Duration, Instant};

    #[repr(C)]
    #[allow(non_snake_case)]
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
    #[allow(non_snake_case)]
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
    struct WSADATA {
        data: [u8; 512],
    }

    #[repr(C)]
    #[allow(non_camel_case_types)]
    struct FD_SET {
        fd_count: u32,
        fd_array: [usize; 64],
    }

    #[repr(C)]
    struct TIMEVAL {
        tv_sec: i32,
        tv_usec: i32,
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
        fn closesocket(s: usize) -> i32;
    }

    const AF_BTH: i32 = 32;
    const SOCK_STREAM: i32 = 1;
    const BTHPROTO_RFCOMM: i32 = 3;
    const SOL_SOCKET: i32 = 0xFFFF;
    const SO_SNDTIMEO: i32 = 0x1005;
    const SO_RCVTIMEO: i32 = 0x1006;
    const INVALID_SOCKET: usize = usize::MAX;

    /// Safety-net blocking timeouts; normal reads are gated by `select`.
    const SOCKET_IO_TIMEOUT_MS: i32 = 2000;
    /// Per-read wait when probing telemetry during a scan.
    const PROBE_TIMEOUT: Duration = Duration::from_millis(600);
    /// Wait for a reply to a user-issued command.
    const COMMAND_TIMEOUT: Duration = Duration::from_millis(800);
    /// Wait for the Fast Pair message stream to push its Model ID.
    const FAST_PAIR_TIMEOUT: Duration = Duration::from_millis(600);

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

    static WSA_INIT: Once = Once::new();

    fn ensure_wsa() {
        WSA_INIT.call_once(|| unsafe {
            let mut wsa: WSADATA = zeroed();
            let _ = WSAStartup(0x0202, &mut wsa);
        });
    }

    /// Owned Winsock `SOCKET`; closed on drop.
    struct RawSocket(usize);

    // SAFETY: a SOCKET is a process-wide kernel handle usable from any thread.
    // Cached sockets are only touched while holding their slot Mutex.
    unsafe impl Send for RawSocket {}

    impl Drop for RawSocket {
        fn drop(&mut self) {
            unsafe {
                let _ = closesocket(self.0);
            }
        }
    }

    impl RawSocket {
        fn open(bt_addr: u64, guid: GUID) -> Result<Self, String> {
            ensure_wsa();
            unsafe {
                let s = socket(AF_BTH, SOCK_STREAM, BTHPROTO_RFCOMM);
                if s == INVALID_SOCKET {
                    return Err("Failed to create Bluetooth socket".into());
                }
                let sock = RawSocket(s);
                let t = SOCKET_IO_TIMEOUT_MS;
                let _ = setsockopt(s, SOL_SOCKET, SO_RCVTIMEO, &t, 4);
                let _ = setsockopt(s, SOL_SOCKET, SO_SNDTIMEO, &t, 4);
                let sa = SOCKADDR_BTH {
                    addressFamily: AF_BTH as u16,
                    btAddr: bt_addr,
                    serviceClassId: guid,
                    port: 0,
                };
                if connect(s, &sa, size_of::<SOCKADDR_BTH>() as i32) != 0 {
                    return Err("Failed to open RFCOMM channel".into());
                }
                Ok(sock)
            }
        }

        fn send_all(&self, mut data: &[u8]) -> Result<(), String> {
            while !data.is_empty() {
                let n = unsafe { send(self.0, data.as_ptr(), data.len() as i32, 0) };
                if n <= 0 {
                    return Err("Failed to send packet".into());
                }
                data = &data[n as usize..];
            }
            Ok(())
        }

        /// Waits until data is readable. `Ok(false)` on timeout.
        fn wait_readable(&self, timeout: Duration) -> Result<bool, String> {
            let mut set = FD_SET {
                fd_count: 1,
                fd_array: [0; 64],
            };
            set.fd_array[0] = self.0;
            let micros = timeout.as_micros().min(i32::MAX as u128) as i64;
            let tv = TIMEVAL {
                tv_sec: (micros / 1_000_000) as i32,
                tv_usec: (micros % 1_000_000) as i32,
            };
            let rc =
                unsafe { select(0, &mut set, std::ptr::null_mut(), std::ptr::null_mut(), &tv) };
            match rc {
                0 => Ok(false),
                n if n > 0 => Ok(true),
                _ => Err("Connection lost".into()),
            }
        }

        /// Reads whatever is available (call after `wait_readable` returned true).
        fn recv_some(&self, buf: &mut [u8]) -> Result<usize, String> {
            let n = unsafe { recv(self.0, buf.as_mut_ptr(), buf.len() as i32, 0) };
            if n <= 0 {
                return Err("Connection lost".into());
            }
            Ok(n as usize)
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
    }

    /// A cached Nothing-Link RFCOMM connection plus its pending receive bytes.
    struct Conn {
        sock: RawSocket,
        buf: Vec<u8>,
    }

    impl Conn {
        fn open(mac_u64: u64) -> Result<Self, String> {
            Ok(Self {
                sock: RawSocket::open(mac_u64, GUID_NT_LINK)?,
                buf: Vec::with_capacity(512),
            })
        }

        /// Sends one request and waits for its matching response frame.
        /// Unsolicited / unrelated frames are discarded.
        fn transact(
            &mut self,
            command: u16,
            payload: &[u8],
            timeout: Duration,
        ) -> Result<Option<NothingFrame>, String> {
            self.buf.clear();
            let fsn = next_fsn();
            let pkt = NothingFrame::encode(command, fsn, payload);
            self.sock.send_all(&pkt.raw_bytes)?;
            let deadline = Instant::now() + timeout;
            loop {
                if let Some(frame) = extract_frames(&mut self.buf)
                    .into_iter()
                    .find(|f| is_response_to(f, command, fsn))
                {
                    return Ok(Some(frame));
                }
                if !self.sock.read_more(&mut self.buf, deadline)? {
                    return Ok(None);
                }
            }
        }
    }

    type Slot = Arc<Mutex<Option<Conn>>>;

    /// One slot per device MAC. The per-slot mutex serialises traffic to that device.
    fn slot_for(mac_u64: u64) -> Slot {
        static CACHE: OnceLock<Mutex<HashMap<u64, Slot>>> = OnceLock::new();
        let cache = CACHE.get_or_init(|| Mutex::new(HashMap::new()));
        let mut map = cache.lock().unwrap_or_else(|e| e.into_inner());
        map.entry(mac_u64).or_default().clone()
    }

    fn evict(mac_u64: u64) {
        let slot = slot_for(mac_u64);
        let mut guard = slot.lock().unwrap_or_else(|e| e.into_inner());
        *guard = None;
    }

    /// Sends `command` over the cached NT-link socket for `mac_u64`.
    ///
    /// - `Err` when the channel cannot be opened or the send/receive fails
    ///   (a stale cached socket is dropped and the request retried once on a fresh one).
    /// - `Ok(None)` when sent but no matching reply arrived within `timeout`.
    fn transact(
        mac_u64: u64,
        command: u16,
        payload: &[u8],
        timeout: Duration,
    ) -> Result<Option<NothingFrame>, String> {
        let slot = slot_for(mac_u64);
        let mut guard = slot.lock().unwrap_or_else(|e| e.into_inner());
        let reused = guard.is_some();
        let conn = match guard.as_mut() {
            Some(c) => c,
            None => guard.insert(Conn::open(mac_u64)?),
        };
        match conn.transact(command, payload, timeout) {
            Ok(r) => Ok(r),
            Err(e) => {
                *guard = None;
                if !reused {
                    return Err(e);
                }
                let mut fresh = Conn::open(mac_u64)?;
                let r = fresh.transact(command, payload, timeout);
                if r.is_ok() {
                    *guard = Some(fresh);
                }
                r
            }
        }
    }

    /// Reads the Fast Pair Model ID pushed by the device on the message-stream channel.
    /// Nothing is sent: the provider announces its Model ID right after connect.
    fn query_fast_pair_id(bt_addr: u64) -> Option<String> {
        let sock = RawSocket::open(bt_addr, GUID_FASTPAIR_RFCOMM).ok()?;
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

    pub fn probe_nothing_telemetry(dev: &mut DetectedNothingDevice) {
        if let Some(fp) = query_fast_pair_id(dev.mac_u64) {
            dev.fast_pair_id = Some(fp.clone());
            let (model_id, color_sku) = match_model_and_color(&dev.name, Some(&fp));
            dev.matched_model_id = model_id;
            if color_sku.is_some() {
                dev.matched_color_sku = color_sku;
            }
        }

        let mac = dev.mac_u64;
        let read = |cmd: u16| transact(mac, cmd, &[], PROBE_TIMEOUT);

        // 1. Battery (0xC007). An Err here means the NT link is unreachable.
        let battery = match read(0xC007) {
            Ok(f) => f,
            Err(_) => return,
        };
        dev.connected = true;
        if let Some(frame) = battery {
            parse_battery_payload(&frame.payload, dev);
        }

        // 2. Firmware (0xC042)
        match read(0xC042) {
            Ok(Some(frame)) => {
                if let Ok(fw) = String::from_utf8(frame.payload) {
                    let trimmed = fw.trim_matches(char::from(0)).trim().to_string();
                    if !trimmed.is_empty() {
                        dev.firmware_version = Some(trimmed);
                    }
                }
            }
            Ok(None) => {}
            Err(_) => return,
        }

        // 3. Extended info / serial number (0xC006)
        match read(0xC006) {
            Ok(Some(frame)) => {
                if frame.payload.len() > 1 {
                    let text = String::from_utf8_lossy(&frame.payload[1..]);
                    for line in text.lines() {
                        let parts: Vec<&str> = line.split(',').collect();
                        if parts.len() >= 3 && parts[1] == "4" && !parts[2].is_empty() {
                            dev.serial_number = Some(parts[2].trim().to_string());
                        } else if parts.len() >= 3
                            && parts[1] == "2"
                            && !parts[2].is_empty()
                            && dev.firmware_version.is_none()
                        {
                            dev.firmware_version = Some(parts[2].trim().to_string());
                        }
                    }
                }
            }
            Ok(None) => {}
            Err(_) => return,
        }

        // 4. ANC status (0xC01E)
        match read(0xC01E) {
            Ok(Some(frame)) => dev.anc_raw = Some(frame.payload),
            Ok(None) => {}
            Err(_) => return,
        }

        // 5. EQ preset (0xC01F)
        if let Ok(Some(frame)) = read(0xC01F) {
            if let Some(&preset) = frame.payload.first() {
                dev.eq_preset_index = Some(preset);
            }
        }
    }

    fn parse_battery_payload(payload: &[u8], dev: &mut DetectedNothingDevice) {
        if payload.is_empty() {
            return;
        }
        let count = payload[0] as usize;
        let mut idx = 1;
        for _ in 0..count {
            if idx + 1 >= payload.len() {
                break;
            }
            let dev_id = payload[idx];
            let raw_val = payload[idx + 1];
            let level = raw_val & 0x7F;
            let charging = (raw_val & 0x80) != 0;
            match dev_id {
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
                0x06 | 0x01 => {
                    // Single battery over-ear headphone / neckband (e.g. Nothing Headphone (1) B170)
                    dev.is_headphone_single_battery = true;
                    dev.battery_left = Some(level);
                    dev.battery_left_charging = charging;
                    dev.battery_right = Some(level);
                    dev.battery_right_charging = charging;
                    dev.battery_case = Some(0);
                    dev.battery_case_charging = false;
                }
                _ => {}
            }
            idx += 2;
        }
    }

    pub fn scan_devices() -> BluetoothScanResult {
        let mut devices = Vec::new();
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
            if !hfind.is_null() {
                loop {
                    let name_len = info
                        .szName
                        .iter()
                        .position(|&c| c == 0)
                        .unwrap_or(info.szName.len());
                    let name = String::from_utf16_lossy(&info.szName[..name_len])
                        .trim()
                        .to_string();
                    let mac_u64 = info.Address;

                    if is_nothing_or_cmf_device(&name, mac_u64) {
                        let (model_id, color_sku) = match_model_and_color(&name, None);
                        devices.push(DetectedNothingDevice {
                            name: if name.is_empty() {
                                "Nothing Audio Device".into()
                            } else {
                                name
                            },
                            mac_address: format_mac(mac_u64),
                            mac_u64,
                            connected: info.fConnected != 0,
                            remembered: info.fRemembered != 0,
                            matched_model_id: model_id,
                            matched_color_sku: color_sku,
                            fast_pair_id: None,
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
                        });
                    }

                    info = zeroed();
                    info.dwSize = size_of::<BLUETOOTH_DEVICE_INFO>() as u32;
                    if BluetoothFindNextDevice(hfind, &mut info) == 0 {
                        break;
                    }
                }
                let _ = BluetoothFindDeviceClose(hfind);
            }
        }

        for dev in devices.iter_mut() {
            if dev.connected {
                probe_nothing_telemetry(dev);
            } else {
                // Device is gone: drop any stale cached socket.
                evict(dev.mac_u64);
            }
        }

        // Sort connected devices first
        devices.sort_by_key(|d| (!d.connected, d.name.clone()));
        let active_device = devices.iter().find(|d| d.connected).cloned();
        BluetoothScanResult {
            devices,
            active_device,
        }
    }

    pub fn send_command_to_device(
        mac_u64: u64,
        command: u16,
        payload: &[u8],
    ) -> Result<Option<NothingFrame>, String> {
        transact(mac_u64, command, payload, COMMAND_TIMEOUT)
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
}
