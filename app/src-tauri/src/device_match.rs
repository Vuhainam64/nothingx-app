//! Pure device identification helpers: brand filter, Fast Pair lookup, name and
//! protocol based model resolution. No I/O, fully unit tested.

use crate::fast_pair_table::FAST_PAIR_TABLE;

/// Model id reported when nothing identifies the device. The frontend handles it.
pub const UNKNOWN_MODEL: &str = "unknown";

/// Official Nothing / CMF OUI prefixes (`supportMacPrefixes` in devices_info_list.json).
const NOTHING_OUIS: [u32; 4] = [0x2CBEEB, 0x3CB0ED, 0x2CBEEE, 0x045A3D];

/// Tokens of other brands' audio products. A name containing one of them is never
/// treated as a Nothing/CMF device (unless the OUI or a brand word says otherwise).
const OTHER_BRAND_TOKENS: &[&str] = &[
    "galaxy",
    "samsung",
    "redmi",
    "xiaomi",
    "poco",
    "oneplus",
    "realme",
    "oppo",
    "vivo",
    "huawei",
    "honor",
    "freebuds",
    "airpods",
    "beats",
    "apple",
    "sony",
    "jbl",
    "bose",
    "soundcore",
    "anker",
    "pixel",
    "jabra",
    "sennheiser",
    "skullcandy",
    "edifier",
    "qcy",
    "marshall",
    "gear",
    "lg",
    "tone",
    "motorola",
    "moto",
    "nokia",
    "boat",
    "tecno",
    "infinix",
    "iqoo",
    "baseus",
    "haylou",
    "tozo",
    "soundpeats",
    "philips",
    "audio-technica",
];

/// How the scan should treat a paired Bluetooth device.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DeviceClass {
    /// Nothing/CMF OUI, or "nothing"/"cmf" in the name.
    Nothing,
    /// Brand-less name that matches a Nothing/CMF model (e.g. "Buds Pro", "Ear (2)").
    /// Only accepted after a successful NT-link RFCOMM connect.
    NeedsLinkProbe,
    /// Not a Nothing/CMF device.
    Other,
}

pub fn is_nothing_oui(mac_u64: u64) -> bool {
    let oui = ((mac_u64 >> 24) & 0xFF_FFFF) as u32;
    NOTHING_OUIS.contains(&oui)
}

/// Lowercases, turns every non-alphanumeric run into one space and pads with spaces,
/// so `" ear 1 "` matches "Nothing ear (1)" but not "gear 1".
pub fn normalize_name(name: &str) -> String {
    let mut out = String::with_capacity(name.len() + 2);
    out.push(' ');
    for c in name.chars().flat_map(char::to_lowercase) {
        if c.is_alphanumeric() {
            out.push(c);
        } else if !out.ends_with(' ') {
            out.push(' ');
        }
    }
    if !out.ends_with(' ') {
        out.push(' ');
    }
    out
}

fn has_brand_word(lower: &str) -> bool {
    lower.contains("nothing") || lower.contains("cmf")
}

fn has_other_brand(norm: &str) -> bool {
    OTHER_BRAND_TOKENS
        .iter()
        .any(|t| norm.contains(&format!(" {t} ")))
}

pub fn classify_device(name: &str, mac_u64: u64) -> DeviceClass {
    if is_nothing_oui(mac_u64) {
        return DeviceClass::Nothing;
    }
    let lower = name.to_lowercase();
    if has_brand_word(&lower) {
        return DeviceClass::Nothing;
    }
    let norm = normalize_name(name);
    if has_other_brand(&norm) {
        return DeviceClass::Other;
    }
    if model_from_name(name).is_some() {
        DeviceClass::NeedsLinkProbe
    } else {
        DeviceClass::Other
    }
}

/// True only for devices that are Nothing/CMF without needing a link probe.
pub fn is_nothing_or_cmf_device(name: &str, mac_u64: u64) -> bool {
    classify_device(name, mac_u64) == DeviceClass::Nothing
}

/// Ordered most specific first; the first match wins.
/// `(normalized pattern, model, exact)`: `exact` patterns must equal the whole name.
const NAME_PATTERNS: &[(&str, &str, bool)] = &[
    (" headphone 1 pro ", "B192", false),
    (" headphone pro ", "B175", false),
    (" headphone a ", "B186", false),
    (" headphone 1 ", "B170", false),
    (" ear open ", "B174", false),
    (" ear stick ", "B157", false),
    (" ear 3a ", "B190", false),
    (" ear 3 ", "B173", false),
    (" ear 2 ", "B155", false),
    (" ear 1 ", "B181", false),
    (" ear a ", "B162", false),
    (" ear 2024 ", "B171", false),
    (" nothing ear ", "B171", true),
    (" ear ", "B171", true),
    (" buds pro 2 ", "B172", false),
    (" buds 2 plus ", "B184", false),
    (" buds 2a ", "B185", false),
    (" buds 2 ", "B179", false),
    (" buds neo ", "B193", false),
    (" buds pro ", "B163", false),
    (" neckband pro ", "B164", false),
    (" clip pro ", "B189", false),
    (" speaker s ", "E494", false),
    (" speaker m ", "E495", false),
    (" cmf buds ", "B168", true),
    (" buds ", "B168", true),
];

/// Best model id for a Bluetooth name, or `None` if the name matches no known model.
pub fn model_from_name(name: &str) -> Option<&'static str> {
    let norm = normalize_name(name);
    NAME_PATTERNS
        .iter()
        .find(|(pat, _, exact)| {
            if *exact {
                norm == *pat
            } else {
                norm.contains(pat)
            }
        })
        .map(|(_, model, _)| *model)
}

/// `(model_code, color_id)` for a 3-byte Fast Pair Model ID (hex, any case).
pub fn fast_pair_lookup(fast_pair_id: &str) -> Option<(&'static str, &'static str)> {
    let id = fast_pair_id.trim().to_ascii_uppercase();
    FAST_PAIR_TABLE
        .iter()
        .find(|(fp, _, _)| *fp == id)
        .map(|(_, model, color)| (*model, *color))
}

pub fn color_sku(model: &str, color_id: &str) -> String {
    format!("{model}_{color_id}")
}

/// 0x401C reply: every payload byte as uppercase hex, e.g. `[0xB1, 0x81]` -> "B181".
pub fn parse_model_code(payload: &[u8]) -> Option<String> {
    if payload.is_empty() || payload.len() > 8 {
        return None;
    }
    if payload.iter().all(|&b| b == 0) || payload.iter().all(|&b| b == 0xFF) {
        return None;
    }
    Some(payload.iter().map(|b| format!("{b:02X}")).collect())
}

/// 0x400C reply: `payload[0]` as 2-digit uppercase hex, e.g. "01".
pub fn parse_color_id(payload: &[u8]) -> Option<String> {
    payload.first().map(|b| format!("{b:02X}"))
}

/// Picks `(matched_model_id, matched_color_sku)`.
///
/// Precedence: protocol model code (0xC01C) > Fast Pair Model ID > Bluetooth name >
/// [`UNKNOWN_MODEL`]. The colour comes from 0xC00C when available, otherwise from the
/// Fast Pair SKU if it belongs to the same model. Like the official app, an "Ear (1)"
/// name forces B181.
pub fn resolve_model(
    model_code: Option<&str>,
    color_id: Option<&str>,
    fast_pair_id: Option<&str>,
    bt_name: &str,
) -> (String, Option<String>) {
    let fp = fast_pair_id.and_then(fast_pair_lookup);
    let name_model = model_from_name(bt_name);
    let code = if name_model == Some("B181") {
        Some("B181")
    } else {
        model_code.filter(|c| !c.is_empty())
    };

    if let Some(code) = code {
        let sku = match (color_id, fp) {
            (Some(c), _) => Some(color_sku(code, c)),
            (None, Some((m, c))) if m == code => Some(color_sku(m, c)),
            _ => None,
        };
        return (code.to_string(), sku);
    }
    if let Some((m, c)) = fp {
        let color = color_id.unwrap_or(c);
        return (m.to_string(), Some(color_sku(m, color)));
    }
    if let Some(m) = name_model {
        return (m.to_string(), color_id.map(|c| color_sku(m, c)));
    }
    (UNKNOWN_MODEL.to_string(), None)
}

#[cfg(test)]
mod tests {
    use super::*;

    const OTHER_MAC: u64 = 0x11_22_33_44_55_66;
    const NOTHING_MAC: u64 = 0x2C_BE_EB_01_02_03;

    #[test]
    fn other_brands_are_rejected() {
        for name in [
            "Galaxy Buds Pro",
            "Galaxy Buds2 Pro",
            "Redmi Buds 4 Pro",
            "gear 1",
            "Gear 1",
            "year a",
            "AirPods Pro",
            "WH-1000XM5",
            "Buds Pro by Samsung",
            "",
        ] {
            assert_eq!(
                classify_device(name, OTHER_MAC),
                DeviceClass::Other,
                "{name}"
            );
            assert!(!is_nothing_or_cmf_device(name, OTHER_MAC), "{name}");
        }
    }

    #[test]
    fn nothing_and_cmf_are_accepted() {
        for name in [
            "Nothing Ear (2)",
            "Nothing ear (1)",
            "CMF Buds Pro 2",
            "CMF Neckband Pro",
            "nothing headphone (1)",
        ] {
            assert!(is_nothing_or_cmf_device(name, OTHER_MAC), "{name}");
        }
        // OUI match wins even for generic / empty names.
        assert!(is_nothing_or_cmf_device("", NOTHING_MAC));
        assert!(is_nothing_or_cmf_device("Galaxy Buds Pro", NOTHING_MAC));
    }

    #[test]
    fn generic_names_need_link_probe() {
        for name in ["Buds Pro", "Ear (2)", "Ear (Stick)", "Neckband Pro"] {
            assert_eq!(
                classify_device(name, OTHER_MAC),
                DeviceClass::NeedsLinkProbe,
                "{name}"
            );
            assert!(!is_nothing_or_cmf_device(name, OTHER_MAC));
        }
    }

    #[test]
    fn name_to_model() {
        let cases = [
            ("Nothing Ear", Some("B171")),
            ("Nothing Ear (3)", Some("B173")),
            ("Nothing Ear (3a)", Some("B190")),
            ("Nothing Ear (a)", Some("B162")),
            ("Nothing ear (1)", Some("B181")),
            ("Ear (2)", Some("B155")),
            ("Nothing Ear (open)", Some("B174")),
            ("Ear (Stick)", Some("B157")),
            ("Nothing Headphone (1)", Some("B170")),
            ("Nothing Headphone (1) Pro", Some("B192")),
            ("Nothing Headphone (a)", Some("B186")),
            ("CMF Headphone Pro", Some("B175")),
            ("CMF Buds Pro 2", Some("B172")),
            ("CMF Buds 2 Plus", Some("B184")),
            ("CMF Buds 2a", Some("B185")),
            ("CMF Buds 2", Some("B179")),
            ("CMF Buds Neo", Some("B193")),
            ("Buds Pro", Some("B163")),
            ("CMF Buds", Some("B168")),
            ("CMF Clip Pro", Some("B189")),
            ("Nothing Audio Device", None),
            ("gear 1", None),
            ("Nothing Ear (9)", None),
        ];
        for (name, want) in cases {
            assert_eq!(model_from_name(name), want, "{name}");
        }
    }

    #[test]
    fn fast_pair_table_lookups() {
        assert_eq!(fast_pair_lookup("F29566"), Some(("B172", "01")));
        assert_eq!(fast_pair_lookup("ca36a6"), Some(("B172", "02")));
        assert_eq!(fast_pair_lookup("2B353E"), Some(("B172", "03")));
        assert_eq!(fast_pair_lookup("2F45F5"), Some(("B187", "01")));
        assert_eq!(fast_pair_lookup("1253C0"), Some(("B187", "07")));
        assert_eq!(fast_pair_lookup("8B6380"), Some(("B162", "08")));
        assert_eq!(fast_pair_lookup("839E9A"), Some(("B183", "08")));
        assert_eq!(fast_pair_lookup("CC3444"), Some(("B174", "03")));
        assert_eq!(fast_pair_lookup("FC3AAF"), Some(("B174", "02")));
        assert_eq!(fast_pair_lookup("7D46E5"), Some(("B173", "01")));
        assert_eq!(fast_pair_lookup("97EF75"), Some(("B198", "08")));
        assert_eq!(fast_pair_lookup("CDFDEC"), Some(("B192", "01")));
        assert_eq!(fast_pair_lookup("000000"), None);
        // Every row is a 6-hex id and appears once.
        for (i, (fp, model, color)) in FAST_PAIR_TABLE.iter().enumerate() {
            assert_eq!(fp.len(), 6);
            assert!(fp.chars().all(|c| c.is_ascii_hexdigit()));
            assert_eq!(model.len(), 4);
            assert_eq!(color.len(), 2);
            assert!(FAST_PAIR_TABLE[i + 1..].iter().all(|(o, _, _)| o != fp));
        }
    }

    #[test]
    fn protocol_ids_parse() {
        assert_eq!(parse_model_code(&[0xB1, 0x81]).as_deref(), Some("B181"));
        assert_eq!(parse_model_code(&[]), None);
        assert_eq!(parse_model_code(&[0, 0]), None);
        assert_eq!(parse_color_id(&[0x0C, 0x99]).as_deref(), Some("0C"));
        assert_eq!(parse_color_id(&[]), None);
    }

    #[test]
    fn model_resolution_precedence() {
        // C01C beats Fast Pair and name.
        assert_eq!(
            resolve_model(Some("B187"), Some("02"), Some("F29566"), "CMF Buds Pro 2"),
            ("B187".into(), Some("B187_02".into()))
        );
        // C01C without colour borrows the Fast Pair colour only for the same model.
        assert_eq!(
            resolve_model(Some("B172"), None, Some("CA36A6"), ""),
            ("B172".into(), Some("B172_02".into()))
        );
        assert_eq!(
            resolve_model(Some("B187"), None, Some("CA36A6"), ""),
            ("B187".into(), None)
        );
        // Fast Pair beats name.
        assert_eq!(
            resolve_model(None, None, Some("839E9A"), "Nothing Ear (a)"),
            ("B183".into(), Some("B183_08".into()))
        );
        // Name fallback, then unknown (never a silent B171).
        assert_eq!(
            resolve_model(None, None, None, "CMF Buds 2a"),
            ("B185".into(), None)
        );
        assert_eq!(
            resolve_model(None, None, None, "Nothing Audio Device"),
            (UNKNOWN_MODEL.into(), None)
        );
        // Ear (1) is forced to B181 like the official app.
        assert_eq!(
            resolve_model(Some("0000B1"), Some("01"), None, "Nothing ear (1)"),
            ("B181".into(), Some("B181_01".into()))
        );
    }
}
