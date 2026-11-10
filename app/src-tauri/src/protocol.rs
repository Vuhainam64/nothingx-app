use serde::{Deserialize, Serialize};

pub const FRAME_SOF: u8 = 0x55;
/// Frame control word set by `NtEarMessage.setControl` (0x160 → `60 01` on the wire).
/// Bit 0x20 = CRC16 trailer present; same value for every device type.
pub const DEFAULT_CONTROL_TWS_CRC: u16 = 0x0160;
/// Control bit announcing the CRC16 trailer. Devices always set it (control 0x0160), so a
/// frame without it is treated as garbage (e.g. a stray 0x55 inside another payload).
pub const CONTROL_CRC_BIT: u16 = 0x0020;
/// Largest payload the u16 length field can describe on the send side.
pub const MAX_ENCODE_PAYLOAD_LEN: usize = u16::MAX as usize;

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
    /// Builds a frame. Fails if `payload` does not fit the u16 length field.
    pub fn encode(command: u16, fsn: u8, payload: &[u8]) -> Result<Self, String> {
        if payload.len() > MAX_ENCODE_PAYLOAD_LEN {
            return Err(format!(
                "Payload too large: {} bytes (max {})",
                payload.len(),
                MAX_ENCODE_PAYLOAD_LEN
            ));
        }
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

        Ok(Self {
            sof: FRAME_SOF,
            control,
            command,
            length,
            fsn,
            payload: payload.to_vec(),
            crc16: Some(crc),
            raw_bytes: raw,
        })
    }

    pub fn decode(bytes: &[u8]) -> Result<Self, String> {
        if bytes.len() < 8 || bytes[0] != FRAME_SOF {
            return Err("Invalid SOF or frame shorter than 8 bytes".into());
        }
        let control = u16::from_le_bytes([bytes[1], bytes[2]]);
        let command = u16::from_le_bytes([bytes[3], bytes[4]]);
        let length = u16::from_le_bytes([bytes[5], bytes[6]]) as usize;
        let fsn = bytes[7];
        if (control & CONTROL_CRC_BIT) == 0 {
            return Err(format!("Frame control 0x{control:04X} lacks the CRC bit"));
        }
        if length > MAX_PAYLOAD_LEN {
            return Err(format!("Frame length {length} exceeds {MAX_PAYLOAD_LEN}"));
        }
        let total_len = 8 + length + 2;
        if bytes.len() < total_len {
            return Err("Truncated frame payload/CRC".into());
        }
        let payload = bytes[8..8 + length].to_vec();
        let packet_crc = u16::from_le_bytes([bytes[8 + length], bytes[8 + length + 1]]);
        let expected_crc = crc16_modbus(&bytes[0..8 + length]);
        if packet_crc != expected_crc {
            return Err(format!(
                "CRC16 mismatch: packet=0x{:04X}, expected=0x{:04X}",
                packet_crc, expected_crc
            ));
        }
        let crc16 = Some(packet_crc);

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
        if length > MAX_PAYLOAD_LEN || (control & CONTROL_CRC_BIT) == 0 {
            buf.drain(..1);
            continue;
        }
        let total = 8 + length + 2;
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
    if length > MAX_PAYLOAD_LEN || (control & CONTROL_CRC_BIT) == 0 {
        return None;
    }
    let total = 8 + length + 2;
    if bytes.len() < total {
        return None;
    }
    NothingFrame::decode(&bytes[..total]).ok()
}

/// Whether `frame_cmd` is the reply opcode for request `req_cmd`.
///
/// Replies clear bit 15 of the request (0xC007 -> 0x4007, 0xF00F -> 0x700F); an echo of
/// the request id itself is accepted too. Notifications (0xE0xx -> 0x60xx) never match a
/// 0xC0xx/0xF0xx request.
pub fn is_response_cmd(frame_cmd: u16, req_cmd: u16) -> bool {
    (frame_cmd & 0x7FFF) == (req_cmd & 0x7FFF)
}

/// Unsolicited device notification (battery 0xE001, ANC 0xE003, fit 0xE00D, ...).
pub fn is_notification_cmd(cmd: u16) -> bool {
    (cmd & 0xFF00) == 0xE000
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
        let f = NothingFrame::encode(0xC007, 0x2A, &[1, 2, 3, 4]).unwrap();
        assert_eq!(f.raw_bytes.len(), 8 + 4 + 2);
        assert_eq!(f.raw_bytes[0], FRAME_SOF);
        assert_eq!(&f.raw_bytes[1..3], &[0x60, 0x01]);
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
        let mut raw = NothingFrame::encode(0xC042, 1, &[9]).unwrap().raw_bytes;
        let last = raw.len() - 1;
        raw[last] ^= 0xFF;
        assert!(NothingFrame::decode(&raw).is_err());
    }

    #[test]
    fn split_garbage_prefix() {
        let f = NothingFrame::encode(0x4007, 3, &[5, 6]).unwrap();
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
        let a = NothingFrame::encode(0xE001, 1, &[0xAA]).unwrap();
        let b = NothingFrame::encode(0x4042, 2, b"1.0.2").unwrap();
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
        let f = NothingFrame::encode(0x401E, 7, &[1, 2, 3, 4, 5]).unwrap();
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
        let f = NothingFrame::encode(0x4007, 1, &[0; 10]).unwrap();
        let mut buf = f.raw_bytes[..f.raw_bytes.len() - 3].to_vec();
        assert!(extract_frames(&mut buf).is_empty());
        assert_eq!(buf.len(), f.raw_bytes.len() - 3);
    }

    #[test]
    fn response_matching() {
        assert!(is_response_cmd(0x4007, 0xC007));
        assert!(is_response_cmd(0xC007, 0xC007));
        assert!(is_response_cmd(0x700F, 0xF00F));
        assert!(!is_response_cmd(0xE001, 0xC007));
        assert!(!is_response_cmd(0x400F, 0xF00F));
        assert!(is_notification_cmd(0xE00D));
        assert!(!is_notification_cmd(0x4007));
    }

    /// Builds a frame with an arbitrary control word (CRC appended only if the bit is set).
    fn raw_with_control(control: u16, cmd: u16, payload: &[u8]) -> Vec<u8> {
        let mut raw = vec![FRAME_SOF];
        raw.extend_from_slice(&control.to_le_bytes());
        raw.extend_from_slice(&cmd.to_le_bytes());
        raw.extend_from_slice(&(payload.len() as u16).to_le_bytes());
        raw.push(1);
        raw.extend_from_slice(payload);
        if control & CONTROL_CRC_BIT != 0 {
            let crc = crc16_modbus(&raw);
            raw.extend_from_slice(&crc.to_le_bytes());
        }
        raw
    }

    #[test]
    fn frames_without_crc_bit_are_rejected() {
        let raw = raw_with_control(0x0140, 0x4007, &[1, 2]);
        assert!(NothingFrame::decode(&raw).is_err());
        let mut buf = raw.clone();
        assert!(extract_frames(&mut buf).is_empty());
        // A no-CRC header must not swallow the real frame that follows it.
        let real = NothingFrame::encode(0x4042, 2, b"1.2").unwrap();
        let mut buf = raw_with_control(0x0100, 0x1234, &[0; 4])[..8].to_vec();
        buf.extend_from_slice(&real.raw_bytes);
        let frames = extract_frames(&mut buf);
        assert_eq!(frames.len(), 1);
        assert_eq!(frames[0].command, 0x4042);
        // The device's own control word still decodes.
        assert!(NothingFrame::decode(&raw_with_control(0x0160, 0x4007, &[1])).is_ok());
    }

    #[test]
    fn oversized_length_is_rejected() {
        let mut raw = NothingFrame::encode(0x4007, 1, &[0; 4]).unwrap().raw_bytes;
        raw[5..7].copy_from_slice(&((MAX_PAYLOAD_LEN as u16) + 1).to_le_bytes());
        assert!(NothingFrame::decode(&raw).is_err());
    }

    #[test]
    fn encode_rejects_huge_payload() {
        assert!(NothingFrame::encode(0xF010, 1, &vec![0u8; MAX_ENCODE_PAYLOAD_LEN + 1]).is_err());
        assert!(NothingFrame::encode(0xF010, 1, &[0u8; 300]).is_ok());
    }
}
