use serde::{Deserialize, Serialize};

pub const FRAME_SOF: u8 = 0x55;
pub const DEFAULT_CONTROL_TWS_CRC: u16 = 0x0120;

/// Standard CRC-16/MODBUS (`com.nothing.base.util.Utils.obtainCrc16`)
/// Init: 0xFFFF, Polynomial: 0xA001
pub fn crc16_modbus(data: &[u8]) -> u16 {
    let mut crc: u16 = 0xFFFF;
    for &byte in data {
        crc ^= byte as u16;
        for _ in 0..8 {
            if (crc & 0x0001) != 0 {
                crc = (crc >> 1) ^ 0xA001;
            } else {
                crc >>= 1;
            }
        }
    }
    crc
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NothingFrame {
    pub sof: u8,
    pub control: u16,
    pub command: u16,
    pub length: u16,
    pub fsn: u8,
    pub payload: Vec<u8>,
    pub crc16: Option<u16>,
    pub raw_bytes: Vec<u8>,
}

impl NothingFrame {
    pub fn encode(command: u16, fsn: u8, payload: &[u8]) -> Self {
        let control = DEFAULT_CONTROL_TWS_CRC;
        let length = payload.len() as u16;
        let mut raw = Vec::with_capacity(8 + payload.len() + 2);
        raw.push(FRAME_SOF);
        raw.extend_from_slice(&control.to_le_bytes());
        raw.extend_from_slice(&command.to_le_bytes());
        raw.extend_from_slice(&length.to_le_bytes());
        raw.push(fsn);
        raw.extend_from_slice(payload);

        let crc = crc16_modbus(&raw);
        raw.extend_from_slice(&crc.to_le_bytes());

        Self {
            sof: FRAME_SOF,
            control,
            command,
            length,
            fsn,
            payload: payload.to_vec(),
            crc16: Some(crc),
            raw_bytes: raw,
        }
    }

    pub fn decode(bytes: &[u8]) -> Result<Self, String> {
        if bytes.len() < 8 || bytes[0] != FRAME_SOF {
            return Err("Invalid SOF or frame shorter than 8 bytes".into());
        }
        let control = u16::from_le_bytes([bytes[1], bytes[2]]);
        let command = u16::from_le_bytes([bytes[3], bytes[4]]);
        let length = u16::from_le_bytes([bytes[5], bytes[6]]) as usize;
        let fsn = bytes[7];
        let has_crc = (control & 0x0020) != 0;
        let total_len = 8 + length + if has_crc { 2 } else { 0 };
        if bytes.len() < total_len {
            return Err("Truncated frame payload/CRC".into());
        }
        let payload = bytes[8..8 + length].to_vec();
        let crc16 = if has_crc {
            let packet_crc = u16::from_le_bytes([bytes[8 + length], bytes[8 + length + 1]]);
            let expected_crc = crc16_modbus(&bytes[0..8 + length]);
            if packet_crc != expected_crc {
                return Err(format!(
                    "CRC16 mismatch: packet=0x{:04X}, expected=0x{:04X}",
                    packet_crc, expected_crc
                ));
            }
            Some(packet_crc)
        } else {
            None
        };

        Ok(Self {
            sof: FRAME_SOF,
            control,
            command,
            length: length as u16,
            fsn,
            payload,
            crc16,
            raw_bytes: bytes[0..total_len].to_vec(),
        })
    }
}

/// Upper bound for a sane payload length; anything larger is treated as garbage.
pub const MAX_PAYLOAD_LEN: usize = 2048;

/// Pulls every complete, valid frame out of `buf`, draining consumed bytes.
///
/// Garbage before a SOF byte is discarded. A SOF whose header/CRC does not
/// validate is skipped (one byte) and scanning resumes at the next 0x55.
/// An incomplete trailing frame is left in `buf` for the next read.
pub fn extract_frames(buf: &mut Vec<u8>) -> Vec<NothingFrame> {
    let mut frames = Vec::new();
    loop {
        match buf.iter().position(|&b| b == FRAME_SOF) {
            Some(0) => {}
            Some(pos) => {
                buf.drain(..pos);
            }
            None => {
                buf.clear();
                break;
            }
        }
        if buf.len() < 8 {
            break;
        }
        let control = u16::from_le_bytes([buf[1], buf[2]]);
        let length = u16::from_le_bytes([buf[5], buf[6]]) as usize;
        if length > MAX_PAYLOAD_LEN {
            buf.drain(..1);
            continue;
        }
        let total = 8 + length + if (control & 0x0020) != 0 { 2 } else { 0 };
        if buf.len() < total {
            // Possibly a stray 0x55 with a bogus length. If a later SOF starts a
            // complete valid frame, resync there instead of waiting forever.
            match (1..buf.len())
                .find(|&i| buf[i] == FRAME_SOF && decode_prefix(&buf[i..]).is_some())
            {
                Some(i) => {
                    buf.drain(..i);
                    continue;
                }
                None => break,
            }
        }
        match NothingFrame::decode(&buf[..total]) {
            Ok(frame) => {
                frames.push(frame);
                buf.drain(..total);
            }
            Err(_) => {
                buf.drain(..1);
            }
        }
    }
    frames
}

/// Decodes a complete, valid frame at the start of `bytes`, if there is one.
fn decode_prefix(bytes: &[u8]) -> Option<NothingFrame> {
    if bytes.len() < 8 || bytes[0] != FRAME_SOF {
        return None;
    }
    let control = u16::from_le_bytes([bytes[1], bytes[2]]);
    let length = u16::from_le_bytes([bytes[5], bytes[6]]) as usize;
    if length > MAX_PAYLOAD_LEN {
        return None;
    }
    let total = 8 + length + if (control & 0x0020) != 0 { 2 } else { 0 };
    if bytes.len() < total {
        return None;
    }
    NothingFrame::decode(&bytes[..total]).ok()
}

/// Whether `frame` looks like the response to a request `(req_cmd, req_fsn)`.
///
/// Response command ids are not fully confirmed, so this is tolerant: it accepts
/// the request id itself, the id with the high bit cleared, or the 0x4xxx form.
/// A frame echoing the request fsn with the same low 12 command bits also matches.
pub fn is_response_to(frame: &NothingFrame, req_cmd: u16, req_fsn: u8) -> bool {
    let c = frame.command;
    if c == req_cmd || c == (req_cmd & 0x7FFF) || c == ((req_cmd & 0x0FFF) | 0x4000) {
        return true;
    }
    req_fsn != 0 && frame.fsn == req_fsn && (c & 0x0FFF) == (req_cmd & 0x0FFF)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn crc_known_value() {
        assert_eq!(crc16_modbus(b"123456789"), 0x4B37);
    }

    #[test]
    fn encode_decode_roundtrip() {
        let f = NothingFrame::encode(0xC007, 0x2A, &[1, 2, 3, 4]);
        assert_eq!(f.raw_bytes.len(), 8 + 4 + 2);
        assert_eq!(f.raw_bytes[0], FRAME_SOF);
        let d = NothingFrame::decode(&f.raw_bytes).unwrap();
        assert_eq!(d.command, 0xC007);
        assert_eq!(d.fsn, 0x2A);
        assert_eq!(d.control, DEFAULT_CONTROL_TWS_CRC);
        assert_eq!(d.payload, vec![1, 2, 3, 4]);
        assert_eq!(d.crc16, f.crc16);
        assert_eq!(d.raw_bytes, f.raw_bytes);
    }

    #[test]
    fn decode_rejects_bad_crc() {
        let mut raw = NothingFrame::encode(0xC042, 1, &[9]).raw_bytes;
        let last = raw.len() - 1;
        raw[last] ^= 0xFF;
        assert!(NothingFrame::decode(&raw).is_err());
    }

    #[test]
    fn split_garbage_prefix() {
        let f = NothingFrame::encode(0x4007, 3, &[5, 6]);
        let mut buf = vec![0x00, 0x55, 0x12, 0xFF];
        buf.extend_from_slice(&f.raw_bytes);
        let frames = extract_frames(&mut buf);
        assert_eq!(frames.len(), 1);
        assert_eq!(frames[0].command, 0x4007);
        assert_eq!(frames[0].payload, vec![5, 6]);
        assert!(buf.is_empty());
    }

    #[test]
    fn split_two_concatenated() {
        let a = NothingFrame::encode(0xE001, 1, &[0xAA]);
        let b = NothingFrame::encode(0x4042, 2, b"1.0.2");
        let mut buf = a.raw_bytes.clone();
        buf.extend_from_slice(&b.raw_bytes);
        let frames = extract_frames(&mut buf);
        assert_eq!(frames.len(), 2);
        assert_eq!(frames[0].command, 0xE001);
        assert_eq!(frames[1].command, 0x4042);
        assert_eq!(frames[1].payload, b"1.0.2".to_vec());
        assert!(buf.is_empty());
    }

    #[test]
    fn split_truncated_then_completed() {
        let f = NothingFrame::encode(0x401E, 7, &[1, 2, 3, 4, 5]);
        let (head, tail) = f.raw_bytes.split_at(6);
        let mut buf = head.to_vec();
        assert!(extract_frames(&mut buf).is_empty());
        assert_eq!(buf.len(), 6, "partial frame must be kept");
        buf.extend_from_slice(tail);
        let frames = extract_frames(&mut buf);
        assert_eq!(frames.len(), 1);
        assert_eq!(frames[0].payload, vec![1, 2, 3, 4, 5]);
        assert!(buf.is_empty());
    }

    #[test]
    fn split_truncated_partial_payload_kept() {
        let f = NothingFrame::encode(0x4007, 1, &[0; 10]);
        let mut buf = f.raw_bytes[..f.raw_bytes.len() - 3].to_vec();
        assert!(extract_frames(&mut buf).is_empty());
        assert_eq!(buf.len(), f.raw_bytes.len() - 3);
    }

    #[test]
    fn response_matching() {
        let f = NothingFrame::encode(0x4007, 9, &[]);
        assert!(is_response_to(&f, 0xC007, 1));
        let f = NothingFrame::encode(0xC007, 9, &[]);
        assert!(is_response_to(&f, 0xC007, 1));
        let f = NothingFrame::encode(0x700F, 9, &[]);
        assert!(is_response_to(&f, 0xF00F, 1));
        let f = NothingFrame::encode(0xE001, 9, &[]);
        assert!(!is_response_to(&f, 0xC007, 1));
        let f = NothingFrame::encode(0x8007, 4, &[]);
        assert!(is_response_to(&f, 0xC007, 4));
        assert!(!is_response_to(&f, 0xC007, 5));
    }
}
