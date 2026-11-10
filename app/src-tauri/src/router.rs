//! Pure response router for one NT-link connection (no sockets, time is passed in).
//!
//! The background reader thread feeds every decoded frame to [`Router::on_frame`];
//! request threads register *before* sending, then poll for their result. Frames that
//! arrive before a request is registered can never satisfy it.
//!
//! # Matching rule
//! A frame is a reply candidate for a request when `frame.cmd & 0x7FFF == req.cmd & 0x7FFF`.
//! 1. **FSN match** (frame fsn == request fsn) is accepted immediately.
//! 2. A command-only frame whose fsn equals that of a request that already **timed
//!    out** ("orphan", kept for [`ORPHAN_TTL`]) is that late reply: it is dropped.
//! 3. Once the device is known to echo the FSN ([`FsnEcho::Echoes`], learned after two
//!    consecutive FSN matches) every other command-only frame is stale and dropped.
//! 4. Otherwise (echo unknown / device does not echo):
//!    - if an orphan of the same command is alive, the frame is attributed to it (the
//!      oldest) and dropped, so a late reply never satisfies a newer request;
//!    - a frame with fsn 0, or any frame once the device is known not to echo
//!      ([`FsnEcho::NoEcho`]), resolves the oldest waiting request immediately;
//!    - else it becomes the request's *candidate*: an FSN-matching frame arriving within
//!      [`FALLBACK_GRACE`] still wins, otherwise the candidate is returned.
//!
//!    Three consecutive candidate resolutions (or one fsn-0 reply) mark the device NoEcho.
//! 5. In Echoes mode, three consecutive timeouts that each saw a dropped command-only
//!    frame reset the learning to Unknown (self-heal from a wrong guess).

use crate::protocol::{is_response_cmd, NothingFrame};
use std::time::{Duration, Instant};

/// How long a command-only candidate waits for an FSN-matching frame.
pub const FALLBACK_GRACE: Duration = Duration::from_millis(120);
/// How long a timed-out request keeps absorbing its late reply.
pub const ORPHAN_TTL: Duration = Duration::from_millis(2500);

const ECHO_AFTER_MATCHES: u8 = 2;
const NO_ECHO_AFTER_FALLBACKS: u8 = 3;
const UNLEARN_AFTER_VIOLATIONS: u8 = 3;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FsnEcho {
    Unknown,
    Echoes,
    NoEcho,
}

#[derive(Debug)]
pub enum Poll {
    Ready(NothingFrame),
    /// Not resolved yet; wake up no later than this instant (`None` = only on new frames
    /// or the caller's deadline).
    Wait(Option<Instant>),
}

#[derive(Debug)]
struct Pending {
    id: u64,
    cmd: u16,
    fsn: u8,
    result: Option<NothingFrame>,
    candidate: Option<(NothingFrame, Instant)>,
    /// Saw a command-only frame that was dropped because the device echoes FSNs.
    shadow: bool,
}

#[derive(Debug)]
struct Orphan {
    cmd: u16,
    fsn: u8,
    expires: Instant,
}

#[derive(Debug)]
struct NotifyWaiter {
    id: u64,
    cmd: u16,
    result: Option<NothingFrame>,
}

#[derive(Debug)]
pub struct Router {
    echo: FsnEcho,
    match_streak: u8,
    fallback_streak: u8,
    violation_streak: u8,
    next_id: u64,
    pending: Vec<Pending>,
    orphans: Vec<Orphan>,
    notify: Vec<NotifyWaiter>,
}

impl Default for Router {
    fn default() -> Self {
        Self::new()
    }
}

impl Router {
    pub fn new() -> Self {
        Self {
            echo: FsnEcho::Unknown,
            match_streak: 0,
            fallback_streak: 0,
            violation_streak: 0,
            next_id: 1,
            pending: Vec::new(),
            orphans: Vec::new(),
            notify: Vec::new(),
        }
    }

    pub fn fsn_echo(&self) -> FsnEcho {
        self.echo
    }

    fn alloc_id(&mut self) -> u64 {
        let id = self.next_id;
        self.next_id += 1;
        id
    }

    /// Registers a request; call before sending it.
    pub fn register_request(&mut self, cmd: u16, fsn: u8) -> u64 {
        let id = self.alloc_id();
        self.pending.push(Pending {
            id,
            cmd,
            fsn,
            result: None,
            candidate: None,
            shadow: false,
        });
        id
    }

    /// Registers interest in the next frame with exactly `cmd`; call before sending.
    pub fn register_notify(&mut self, cmd: u16) -> u64 {
        let id = self.alloc_id();
        self.notify.push(NotifyWaiter {
            id,
            cmd,
            result: None,
        });
        id
    }

    fn learn_fsn_match(&mut self) {
        self.fallback_streak = 0;
        self.violation_streak = 0;
        if self.echo == FsnEcho::Unknown {
            self.match_streak = self.match_streak.saturating_add(1);
            if self.match_streak >= ECHO_AFTER_MATCHES {
                self.echo = FsnEcho::Echoes;
            }
        }
    }

    fn learn_fallback(&mut self, frame_fsn: u8) {
        self.match_streak = 0;
        if self.echo == FsnEcho::Unknown {
            self.fallback_streak = self.fallback_streak.saturating_add(1);
            // We never send fsn 0, so a 0 in a reply proves the device does not echo.
            if frame_fsn == 0 || self.fallback_streak >= NO_ECHO_AFTER_FALLBACKS {
                self.echo = FsnEcho::NoEcho;
            }
        }
    }

    /// Feeds one decoded frame received from the device.
    pub fn on_frame(&mut self, frame: &NothingFrame, now: Instant) {
        self.orphans.retain(|o| o.expires > now);

        for w in self.notify.iter_mut() {
            if w.result.is_none() && w.cmd == frame.command {
                w.result = Some(frame.clone());
            }
        }

        let cmd_matches = |c: u16| is_response_cmd(frame.command, c);

        // 1. FSN match.
        if let Some(p) = self
            .pending
            .iter_mut()
            .find(|p| p.result.is_none() && cmd_matches(p.cmd) && p.fsn == frame.fsn)
        {
            p.result = Some(frame.clone());
            self.learn_fsn_match();
            return;
        }

        // 2. Late reply to a timed-out request, identified by its FSN.
        if let Some(i) = self
            .orphans
            .iter()
            .position(|o| cmd_matches(o.cmd) && o.fsn == frame.fsn)
        {
            self.orphans.remove(i);
            return;
        }

        // 3. Device echoes FSNs: a command-only match is stale.
        if self.echo == FsnEcho::Echoes {
            if let Some(p) = self
                .pending
                .iter_mut()
                .find(|p| p.result.is_none() && cmd_matches(p.cmd))
            {
                p.shadow = true;
            }
            return;
        }

        // 4a. Non-echoing device: attribute to the oldest live orphan of this command.
        if let Some(i) = self.orphans.iter().position(|o| cmd_matches(o.cmd)) {
            self.orphans.remove(i);
            return;
        }

        // 4b. Command-only fallback for the oldest waiting request.
        let immediate = self.echo == FsnEcho::NoEcho || frame.fsn == 0;
        let Some(idx) = self
            .pending
            .iter()
            .position(|p| p.result.is_none() && p.candidate.is_none() && cmd_matches(p.cmd))
        else {
            return;
        };
        if immediate {
            self.pending[idx].result = Some(frame.clone());
            self.learn_fallback(frame.fsn);
        } else {
            self.pending[idx].candidate = Some((frame.clone(), now));
        }
    }

    /// Checks whether request `id` is resolved. A `Ready` result removes it.
    pub fn poll_request(&mut self, id: u64, now: Instant) -> Poll {
        let Some(idx) = self.pending.iter().position(|p| p.id == id) else {
            return Poll::Wait(None);
        };
        if let Some(frame) = self.pending[idx].result.take() {
            self.pending.remove(idx);
            return Poll::Ready(frame);
        }
        let Some(until) = self.pending[idx]
            .candidate
            .as_ref()
            .map(|(_, at)| *at + FALLBACK_GRACE)
        else {
            return Poll::Wait(None);
        };
        if now < until {
            return Poll::Wait(Some(until));
        }
        let p = self.pending.remove(idx);
        match p.candidate {
            Some((frame, _)) => {
                self.learn_fallback(frame.fsn);
                Poll::Ready(frame)
            }
            None => Poll::Wait(None),
        }
    }

    /// Ends request `id` at its deadline. Returns a late-resolved result or the pending
    /// candidate if any; otherwise remembers it as an orphan so its late reply is absorbed.
    pub fn finish_request(&mut self, id: u64, now: Instant) -> Option<NothingFrame> {
        let idx = self.pending.iter().position(|p| p.id == id)?;
        let p = self.pending.remove(idx);
        if let Some(r) = p.result {
            return Some(r);
        }
        if let Some((frame, _)) = p.candidate {
            self.learn_fallback(frame.fsn);
            return Some(frame);
        }
        if self.echo == FsnEcho::Echoes && p.shadow {
            self.violation_streak = self.violation_streak.saturating_add(1);
            if self.violation_streak >= UNLEARN_AFTER_VIOLATIONS {
                self.echo = FsnEcho::Unknown;
                self.match_streak = 0;
                self.violation_streak = 0;
            }
        }
        self.orphans.push(Orphan {
            cmd: p.cmd,
            fsn: p.fsn,
            expires: now + ORPHAN_TTL,
        });
        None
    }

    /// Drops request `id` without creating an orphan (e.g. the send itself failed).
    pub fn cancel_request(&mut self, id: u64) {
        self.pending.retain(|p| p.id != id);
    }

    /// Takes the notification for waiter `id`, removing the waiter when resolved.
    pub fn take_notify(&mut self, id: u64) -> Option<NothingFrame> {
        let idx = self
            .notify
            .iter()
            .position(|w| w.id == id && w.result.is_some())?;
        self.notify.remove(idx).result
    }

    pub fn cancel_notify(&mut self, id: u64) {
        self.notify.retain(|w| w.id != id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn frame(cmd: u16, fsn: u8, payload: &[u8]) -> NothingFrame {
        NothingFrame::encode(cmd, fsn, payload).unwrap()
    }

    fn ready(r: Poll) -> NothingFrame {
        match r {
            Poll::Ready(f) => f,
            Poll::Wait(w) => panic!("expected Ready, got Wait({w:?})"),
        }
    }

    fn is_wait(r: &Poll) -> bool {
        matches!(r, Poll::Wait(_))
    }

    #[test]
    fn fsn_match_resolves_immediately() {
        let t = Instant::now();
        let mut r = Router::new();
        let id = r.register_request(0xC007, 5);
        r.on_frame(&frame(0xE001, 5, &[1]), t); // notification, not a reply
        assert!(is_wait(&r.poll_request(id, t)));
        r.on_frame(&frame(0x4007, 5, &[9]), t);
        assert_eq!(ready(r.poll_request(id, t)).payload, vec![9]);
    }

    #[test]
    fn frames_before_registration_are_ignored() {
        let t = Instant::now();
        let mut r = Router::new();
        r.on_frame(&frame(0x4007, 5, &[1]), t);
        let id = r.register_request(0xC007, 5);
        assert!(is_wait(&r.poll_request(id, t)));
        assert!(r.finish_request(id, t).is_none());
    }

    #[test]
    fn stale_reply_with_old_fsn_never_satisfies_newer_request() {
        let t = Instant::now();
        let mut r = Router::new();
        let a = r.register_request(0xC007, 5);
        assert!(r.finish_request(a, t).is_none()); // A timed out
        let b = r.register_request(0xC007, 6);
        r.on_frame(&frame(0x4007, 5, &[0xAA]), t); // late reply to A
        assert!(is_wait(&r.poll_request(b, t + FALLBACK_GRACE * 2)));
        r.on_frame(&frame(0x4007, 6, &[0xBB]), t);
        assert_eq!(ready(r.poll_request(b, t)).payload, vec![0xBB]);
    }

    #[test]
    fn non_echo_late_reply_is_absorbed_by_orphan() {
        let t = Instant::now();
        let mut r = Router::new();
        let a = r.register_request(0xC007, 5);
        assert!(r.finish_request(a, t).is_none());
        let b = r.register_request(0xC007, 6);
        r.on_frame(&frame(0x4007, 0, &[0xAA]), t); // A's late reply, device sends fsn 0
        assert!(is_wait(&r.poll_request(b, t)));
        r.on_frame(&frame(0x4007, 0, &[0xBB]), t);
        assert_eq!(ready(r.poll_request(b, t)).payload, vec![0xBB]);
        assert_eq!(r.fsn_echo(), FsnEcho::NoEcho);
    }

    #[test]
    fn orphan_expires() {
        let t = Instant::now();
        let mut r = Router::new();
        let a = r.register_request(0xC007, 5);
        r.finish_request(a, t);
        let later = t + ORPHAN_TTL + Duration::from_millis(1);
        let b = r.register_request(0xC007, 6);
        r.on_frame(&frame(0x4007, 0, &[0xBB]), later);
        assert_eq!(ready(r.poll_request(b, later)).payload, vec![0xBB]);
    }

    #[test]
    fn command_only_candidate_waits_for_grace() {
        let t = Instant::now();
        let mut r = Router::new();
        let id = r.register_request(0xC042, 7);
        r.on_frame(&frame(0x4042, 99, b"1.0"), t);
        match r.poll_request(id, t) {
            Poll::Wait(Some(until)) => assert_eq!(until, t + FALLBACK_GRACE),
            other => panic!("unexpected {other:?}"),
        }
        assert_eq!(
            ready(r.poll_request(id, t + FALLBACK_GRACE)).payload,
            b"1.0".to_vec()
        );
    }

    #[test]
    fn fsn_match_beats_earlier_candidate() {
        let t = Instant::now();
        let mut r = Router::new();
        let id = r.register_request(0xC01E, 7);
        r.on_frame(&frame(0x401E, 99, &[0x01]), t); // candidate (maybe stale)
        r.on_frame(&frame(0x401E, 7, &[0x02]), t + Duration::from_millis(10));
        assert_eq!(
            ready(r.poll_request(id, t + Duration::from_millis(10))).payload,
            vec![2]
        );
    }

    #[test]
    fn learns_echo_and_then_drops_command_only_frames() {
        let t = Instant::now();
        let mut r = Router::new();
        for fsn in [1u8, 2] {
            let id = r.register_request(0xC007, fsn);
            r.on_frame(&frame(0x4007, fsn, &[]), t);
            ready(r.poll_request(id, t));
        }
        assert_eq!(r.fsn_echo(), FsnEcho::Echoes);
        let id = r.register_request(0xC007, 3);
        r.on_frame(&frame(0x4007, 0, &[]), t);
        r.on_frame(&frame(0x4007, 77, &[]), t);
        assert!(is_wait(&r.poll_request(id, t + Duration::from_secs(1))));
        assert!(r.finish_request(id, t + Duration::from_secs(1)).is_none());
    }

    #[test]
    fn learns_no_echo_after_fallbacks() {
        let t = Instant::now();
        let mut r = Router::new();
        for fsn in [10u8, 11, 12] {
            let id = r.register_request(0xC007, fsn);
            r.on_frame(&frame(0x4007, fsn.wrapping_add(50), &[]), t);
            ready(r.poll_request(id, t + FALLBACK_GRACE));
        }
        assert_eq!(r.fsn_echo(), FsnEcho::NoEcho);
        let id = r.register_request(0xC007, 13);
        r.on_frame(&frame(0x4007, 200, &[4]), t);
        assert_eq!(ready(r.poll_request(id, t)).payload, vec![4]);
    }

    #[test]
    fn echo_learning_self_heals() {
        let t = Instant::now();
        let mut r = Router::new();
        for fsn in [1u8, 2] {
            let id = r.register_request(0xC007, fsn);
            r.on_frame(&frame(0x4007, fsn, &[]), t);
            ready(r.poll_request(id, t));
        }
        for fsn in [3u8, 4, 5] {
            let id = r.register_request(0xC007, fsn);
            r.on_frame(&frame(0x4007, 0x80, &[]), t);
            assert!(r.finish_request(id, t).is_none());
        }
        assert_eq!(r.fsn_echo(), FsnEcho::Unknown);
    }

    #[test]
    fn notification_waiter_only_sees_frames_after_registration() {
        let t = Instant::now();
        let mut r = Router::new();
        r.on_frame(&frame(0xE00D, 0, &[1, 1]), t); // stale fit result
        let id = r.register_notify(0xE00D);
        assert!(r.take_notify(id).is_none());
        r.on_frame(&frame(0x7014, 3, &[0]), t); // ack, not the notification
        assert!(r.take_notify(id).is_none());
        r.on_frame(&frame(0xE00D, 0, &[0, 0]), t);
        assert_eq!(r.take_notify(id).unwrap().payload, vec![0, 0]);
        assert!(r.take_notify(id).is_none());
    }

    #[test]
    fn different_commands_do_not_cross() {
        let t = Instant::now();
        let mut r = Router::new();
        let bat = r.register_request(0xC007, 1);
        let fw = r.register_request(0xC042, 2);
        r.on_frame(&frame(0x4042, 2, b"x"), t);
        assert!(is_wait(&r.poll_request(bat, t)));
        assert_eq!(ready(r.poll_request(fw, t)).payload, b"x".to_vec());
    }
}
