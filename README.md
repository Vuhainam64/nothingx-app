# Nothing X Desktop (unofficial)

Ứng dụng desktop **không chính thức** cho Windows để điều khiển tai nghe **Nothing** và **CMF** từ PC — xây dựng bằng Tauri v2 + React, giao tiếp trực tiếp với tai nghe qua Bluetooth RFCOMM dựa trên giao thức được reverse-engineer từ app Android *Nothing X 3.10.2*.

> ⚠️ Đây là dự án cá nhân/nghiên cứu, **không liên kết, không được bảo trợ** bởi Nothing Technology Limited. "Nothing", "CMF", "Nothing X", logo, hình ảnh sản phẩm và font Ndot là tài sản của chủ sở hữu tương ứng.

## Tính năng

| Nhóm | Chức năng |
|---|---|
| Thiết bị | Tự quét tai nghe Nothing/CMF đã ghép đôi trên Windows (không nhận nhầm tai nghe hãng khác), nhận diện model & màu, đọc pin L/R/hộp sạc — cập nhật tức thì qua thông báo `E001` từ tai nghe, firmware, serial, tự phát hiện mất kết nối |
| Chống ồn | ANC / Xuyên âm / Tắt và các mức theo model, đồng bộ khi đổi chế độ bằng cử chỉ trên tai (thông báo `E003`), ANC cá nhân hoá, kiểm tra độ vừa tai (kết quả từng bên tai: vừa / chưa kín / chưa đeo…) |
| Âm thanh | EQ preset, EQ tuỳ chỉnh 3 dải, Parametric EQ 8 dải (bộ lọc peaking), các chế độ Dirac (Opteo, Pop, Rock, Electronic, Vocals, Classical, Custom…) trên model CMF, Ultra Bass 1–5, Spatial Audio, Hi-Res LDAC / LHDC |
| Điều khiển | Cử chỉ cho từng tai, nút/núm trên headphone & neckband, Smart Dial trên hộp sạc (CMF Buds Pro 2, Clip Pro) — danh sách hành động lấy đúng theo model (phát/tạm dừng, chuyển bài, trợ lý ảo, âm lượng, các kiểu chuyển ANC, độ trễ thấp, Spatial, EQ, Ultra Bass…) |
| Cài đặt | Phát hiện đeo tai, chế độ độ trễ thấp, kết nối kép, tìm tai nghe (phát chuông L/R, hoặc cả thiết bị với headphone) |
| Đồng bộ | Khi kết nối, app đọc lại trạng thái từ tai nghe (ANC, EQ, Spatial, codec, Ultra Bass, cử chỉ, các công tắc) để giao diện khớp với thiết bị |
| Cửa sổ | Chế độ đầy đủ, widget Mini góc taskbar (luôn ở trên), ẩn xuống system tray, menu tray đổi ANC nhanh, tooltip tray hiển thị pin |
| Giao diện | 4 phong cách (Premium, Liquid, Aurora, Shapes) × sáng/tối, đa ngôn ngữ **Tiếng Việt / English / 简体中文** |

Mọi opcode và định dạng payload đều được đối chiếu với mã Dart đã dịch ngược (blutter) của Nothing X 3.10.2 — xem phần [Giao thức](#giao-thức-tóm-tắt). Một số chi tiết vẫn là suy luận và được ghi rõ bên dưới.

Khi không có tai nghe kết nối, app chạy ở **chế độ demo** — có thể chọn bất kỳ model nào trong danh mục (24 model) để xem trước tính năng.

### Thiết bị được nhận diện

**Nothing:** Ear (1) · Ear (stick) · Ear (2) · Ear (a) · Ear · Ear (open) · Ear (3) · Ear (3a) · Headphone (1) · Headphone (1) Pro · Headphone (a)
**CMF:** Buds · Buds Pro · Buds Pro 2 · Buds 2 · Buds 2a · Buds 2 Plus · Buds Neo · Neckband Pro · Headphone Pro · Clip Pro

Model được nhận diện bằng lệnh hỏi trực tiếp tai nghe (`C01C` model, `C00C` màu), sau đó tới Fast Pair Model ID, cuối cùng là tên Bluetooth. Tính năng hiển thị cho từng model được đọc từ **cấu hình gốc của app Nothing X** (`ear_white_list.json`, kèm dải firmware), nên app chỉ hiện và chỉ gửi những lệnh model đó hỗ trợ. App mới được kiểm chứng giới hạn trên phần cứng thật.

## Yêu cầu

- **Windows 10/11** (kết nối Bluetooth thật chỉ có trên Windows — dùng Win32 `bthprops` + Winsock `AF_BTH`)
- [Node.js](https://nodejs.org/) 20+
- [Rust](https://rustup.rs/) stable (toolchain MSVC) + Visual Studio Build Tools (C++)
- Microsoft Edge WebView2 Runtime (có sẵn trên Windows 11)
- Tai nghe đã **ghép đôi và kết nối** trong Cài đặt Bluetooth của Windows

## Chạy & build

```bash
cd app
npm install

# Chạy dev (Vite ở cổng 1435 + cửa sổ Tauri)
npm run tauri dev

# Build bản cài đặt (.msi / .exe trong app/src-tauri/target/release/bundle)
npm run tauri build
```

Chỉ chạy giao diện trên trình duyệt (không có Bluetooth, luôn ở chế độ demo):

```bash
cd app
npm run dev          # http://localhost:1435  (thêm ?mode=mini để mở widget Mini)
```

Kiểm tra:

```bash
cd app
npx tsc --noEmit                 # type-check frontend
cd src-tauri && cargo test       # unit test giao thức (CRC, tách frame, FastPair)
```

> Lưu ý: khi đóng cửa sổ, app **ẩn xuống system tray** thay vì thoát (tắt được trong Cài đặt). Muốn thoát hẳn: chuột phải icon tray → *Thoát*. Script `scripts/free-port.mjs` tự tắt instance cũ trước mỗi lần `tauri dev` để tránh lỗi `Access is denied` khi cargo ghi đè file exe.

## Cấu trúc

```
app/
├── src/                      # Frontend React 19 + TypeScript
│   ├── lib/
│   │   ├── deviceStore.ts    # Zustand store: trạng thái thiết bị, gửi lệnh, poll pin, tray, lưu cài đặt
│   │   ├── deviceCatalog.ts      # Danh mục 24 model: tên, màu, ảnh
│   │   ├── deviceCapabilities.ts # Tính năng theo model/firmware, đọc từ cấu hình gốc ear_white_list.json
│   │   ├── nothingCommands.ts    # Opcode + bộ mã hoá/giải mã payload (EQ, Spatial, cử chỉ…)
│   │   ├── bluetoothProtocol.ts  # Kiểu dữ liệu, mapping ANC, parse payload pin
│   │   └── theme.tsx         # Sáng/tối + 4 phong cách giao diện
│   ├── layouts/dashboard/    # Khung app, sidebar, header, widget Mini, thanh tray
│   ├── pages/                # overview · anc · equalizer · controls · settings
│   ├── components/           # TitleBar, DeviceSetupModal, UI (Radix/shadcn)
│   ├── i18n/locales/         # vi · en · zh
│   └── styles/               # Tailwind v4 + theme CSS, font
├── src-tauri/                # Backend Rust (Tauri v2)
│   └── src/
│       ├── protocol.rs       # Mã hoá/giải mã frame Nothing, CRC16, tách frame
│       ├── bluetooth.rs      # Quét thiết bị, RFCOMM, kết nối + luồng đọc nền, thông báo, FastPair
│       ├── router.rs         # Ghép phản hồi với yêu cầu theo lệnh + FSN
│       ├── device_match.rs   # Lọc thiết bị Nothing/CMF, đoán model theo tên
│       ├── fast_pair_table.rs # Bảng Fast Pair ID → model/màu (sinh từ devices_info_list.json)
│       └── lib.rs            # Tray, sự kiện cửa sổ, đăng ký command
├── public/assets/            # Ảnh thiết bị, icon, font, âm thanh, config
└── scripts/                  # free-port.mjs, tray-companion.ps1 (tray cho chế độ trình duyệt)
```

## Giao thức (tóm tắt)

Tai nghe giao tiếp qua RFCOMM với service UUID `aeac4a03-dff5-498f-843a-34487cf133eb`. Mỗi frame (little-endian):

| Byte | Trường | Ghi chú |
|---|---|---|
| 0 | SOF | `0x55` |
| 1–2 | Control | `0x0160` (`60 01` trên dây) — bit `0x0020` = có CRC |
| 3–4 | Command | opcode |
| 5–6 | Length | độ dài payload |
| 7 | FSN | số thứ tự frame (1–255, quay vòng về 1) |
| 8… | Payload | |
| cuối | CRC16 | CRC-16/MODBUS (init `0xFFFF`, poly `0xA001`) trên toàn bộ phần trước |

Phản hồi của lệnh `cmd` mang mã `cmd & 0x7FFF`: truy vấn `0xC0xx` → `0x40xx`, lệnh ghi `0xF0xx` → ack `0x70xx`. Thông báo chủ động từ tai nghe là `0xE0xx`.

| Tính năng | Đọc | Ghi | Payload ghi |
|---|---|---|---|
| Model / màu | `C01C` / `C00C` | — | — · phản hồi: mã model dạng hex (vd. `B171`), mã màu 2 chữ số |
| Pin | `C007` (+ thông báo `E001`) | — | — · phản hồi `[n, (id, mức\|0x80 khi sạc)…]`, id `2`=L `3`=R `4`=hộp |
| Firmware / serial | `C042` / `C006` | — | — |
| ANC | `C01E [03]` (+ `E003`) | `F00F` | `[01, mode, 00]` — `1`–`4` mức ANC, `5` tắt, `7` xuyên âm |
| ANC cá nhân hoá | `C020` | `F011` | `[bật, hiệu chuẩn]` |
| Kiểm tra độ vừa tai | — | `F014` | `[01]` bắt đầu · kết quả qua thông báo `E00D [L, R]` (0 vừa, 1 chưa kín, 2 chưa đeo…) |
| EQ preset | `C01F` | `F010` | `[mode]` — 0 balanced, 1 voice, 2 treble, 3 bass, 5 custom |
| EQ nâng cao bật/tắt | `C04C` | `F04F` | `[01]` / `[00]` |
| EQ tuỳ chỉnh 3 dải | `C044` | `F041` | 44 byte: `[3, f32 total, 3 × (type, f32 gain, f32 freq, f32 Q)]` |
| Parametric EQ | `C04D [00]` | `F050` | `[00, n, f32 total, n × (01, f32 gain, f32 freq, f32 Q)]` (110 byte với 8 dải) |
| Dirac Opteo | `C050` | `F01D` | `[diracMode]` |
| Ultra Bass | `C04E` | `F051` | `[bật, mức × 2]` |
| Spatial Audio | `C04F` | `F052` | `[mode, head]` — `00 00` tắt, `01 00` cố định, `01 01` head tracking, `02 00` concert, `03 00` cinema, `04 00` game |
| Hi-Res codec | `C029` | `F01C` | `[00]` AAC · `[01]` LHDC · `[02]` LDAC |
| Cử chỉ / Smart Dial | `C018` | `F003` | `[n, (thiết bị, nút, cử chỉ, hành động)…]` |
| Phát hiện đeo tai | `C00E` | `F004` | `[01, 01, bật]` |
| Độ trễ thấp | `C041` | `F040` | `[01]` bật · `[02]` tắt |
| Kết nối kép | `C027` | `F01A` | `[bật]` |
| Tìm tai nghe | — | `F002` | `[bên, bật]` — `2` L, `3` R, `6` headphone/neckband |

Mã cử chỉ: thiết bị `2` L, `3` R, `4` hộp sạc, `6` headphone/neckband · cử chỉ `1` 1 lần, `2` 2 lần, `3` 3 lần, `7` giữ, `9` 2 lần + giữ, `10` xoay núm · hành động `1` không làm gì, `2` phát/tạm dừng, `3` nghe/cúp máy, `8` bài trước, `9` bài sau, `10` ANC → xuyên âm → tắt, `11` trợ lý ảo, `17` độ trễ thấp, `18`/`19` tăng/giảm âm lượng, `20` ANC ↔ tắt, `21` xuyên âm ↔ tắt, `22` ANC ↔ xuyên âm, `23` âm lượng (xoay núm), `27` Spatial, `34` EQ, `35` Ultra Bass, `36` tăng treble.

Model ID được đọc qua kênh Google Fast Pair message stream (`df21fe2c-2515-4fdb-8886-f12c4d67927c`, group `0x03` code `0x01`).

**Lưu ý & điểm chưa xác minh trên phần cứng:**
- Spatial Audio: app gốc chỉ gửi `F052` tới model tự xử lý Spatial (vd. Headphone Pro, Headphone (a)); với các model khác Spatial do điện thoại/PC xử lý nên app chỉ lưu lựa chọn.
- Windows không dùng codec LDAC/LHDC; công tắc Hi-Res chỉ có tác dụng khi tai nghe kết nối với thiết bị hỗ trợ.
- Model dùng Dirac (phần lớn CMF) chọn preset bằng `F01D`, không có EQ preset thường.
- Ultra Bass có hai cách mã hoá (`mức × 2` / `mức × 5`), chọn theo cấu hình của từng model.
- Định dạng phản hồi của truy vấn độ trễ thấp (`C041`) và việc tai nghe có lặp lại FSN trong phản hồi hay không (app tự thích nghi cả hai trường hợp).
- Giảm ồn gió không có trong app gốc nên không được hỗ trợ.

Log/capture từ thiết bị thật để xác minh rất được hoan nghênh.

## Công nghệ

Tauri 2 · Rust · React 19 · TypeScript · Vite 7 · Tailwind CSS 4 · Radix UI · Zustand · i18next · Sonner · Lucide

## Đóng góp

Issue và pull request đều được chào đón — đặc biệt là:
- xác minh opcode trên các model khác nhau,
- xác minh các điểm còn là suy luận ở trên,
- bản dịch mới (thêm thư mục trong `app/src/i18n/locales/`, giữ cùng bộ key).

## Miễn trừ trách nhiệm

Phần mềm được cung cấp "nguyên trạng", không kèm bảo hành. Gửi lệnh không đúng có thể khiến tai nghe hoạt động bất thường — dùng với rủi ro của bạn. Tài nguyên hình ảnh, âm thanh và font trong `app/public/assets` được trích xuất từ ứng dụng Nothing X chính thức và thuộc bản quyền của Nothing Technology Limited.
