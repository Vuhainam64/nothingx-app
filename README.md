# Nothing X Desktop (unofficial)

Ứng dụng desktop **không chính thức** cho Windows để điều khiển tai nghe **Nothing** và **CMF** từ PC — xây dựng bằng Tauri v2 + React, giao tiếp trực tiếp với tai nghe qua Bluetooth RFCOMM dựa trên giao thức được reverse-engineer từ app Android *Nothing X 3.10.2*.

> ⚠️ Đây là dự án cá nhân/nghiên cứu, **không liên kết, không được bảo trợ** bởi Nothing Technology Limited. "Nothing", "CMF", "Nothing X", logo, hình ảnh sản phẩm và font Ndot là tài sản của chủ sở hữu tương ứng.

## Tính năng

| Nhóm | Chức năng | Trạng thái |
|---|---|---|
| Thiết bị | Tự quét tai nghe Nothing/CMF đã ghép đôi trên Windows, nhận diện model & màu (FastPair Model ID + tên), đọc pin L/R/hộp sạc, firmware, serial | ✅ Gửi lệnh thật |
| Chống ồn | ANC / Xuyên âm / Tắt, mức Cao / Trung bình / Thấp / Thích ứng, ANC cá nhân hoá | ✅ Gửi lệnh thật |
| Âm thanh | EQ preset, EQ tuỳ chỉnh 3 dải, Ultra Bass | ✅ Gửi lệnh thật |
| Cài đặt | Phát hiện đeo tai, chế độ độ trễ thấp, kết nối kép, tìm tai nghe (phát chuông L/R), kiểm tra độ vừa tai | ✅ Gửi lệnh thật (kết quả fit test chưa xác minh) |
| Chưa nối giao thức | Giảm ồn gió, Spatial Audio, cử chỉ chạm, Smart Dial, Hi-Res codec, Parametric EQ 8 dải | 🟡 Chỉ giao diện (`TODO(protocol)`) |
| Cửa sổ | Chế độ đầy đủ, widget Mini góc taskbar (luôn ở trên), ẩn xuống system tray, menu tray đổi ANC nhanh, tooltip tray hiển thị pin | ✅ |
| Giao diện | 4 phong cách (Premium, Liquid, Aurora, Shapes) × sáng/tối, đa ngôn ngữ **Tiếng Việt / English / 简体中文** | ✅ |

Khi không có tai nghe kết nối, app chạy ở **chế độ demo** — có thể chọn bất kỳ model nào trong danh mục (13 model) để xem trước tính năng.

### Thiết bị được nhận diện

Nothing Headphone (1) · Nothing Ear · Ear (a) · Ear (open) · Ear (2) · Ear (1) · Ear (stick) · CMF Buds Pro 2 · CMF Buds 2 Plus · CMF Buds · CMF Buds Pro · CMF Neckband Pro · CMF Headphone Pro

Mức hỗ trợ thực tế phụ thuộc vào từng model và firmware; app mới được kiểm chứng giới hạn trên phần cứng thật.

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
│   │   ├── deviceCatalog.ts  # Danh mục 13 model: màu, ảnh, cờ tính năng
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
│       ├── bluetooth.rs      # Quét thiết bị, RFCOMM, cache kết nối, FastPair
│       └── lib.rs            # Tray, sự kiện cửa sổ, đăng ký command
├── public/assets/            # Ảnh thiết bị, icon, font, âm thanh, config
└── scripts/                  # free-port.mjs, tray-companion.ps1 (tray cho chế độ trình duyệt)
```

## Giao thức (tóm tắt)

Tai nghe giao tiếp qua RFCOMM với service UUID `aeac4a03-dff5-498f-843a-34487cf133eb`. Mỗi frame (little-endian):

| Byte | Trường | Ghi chú |
|---|---|---|
| 0 | SOF | `0x55` |
| 1–2 | Control | `0x0120` — bit `0x0020` = có CRC |
| 3–4 | Command | opcode |
| 5–6 | Length | độ dài payload |
| 7 | FSN | số thứ tự frame |
| 8… | Payload | |
| cuối | CRC16 | CRC-16/MODBUS (init `0xFFFF`, poly `0xA001`) trên toàn bộ phần trước |

Opcode đang dùng:

| Opcode | Ý nghĩa |
|---|---|
| `0xC007` | Đọc pin (`[count, (id, level\|0x80 khi sạc)…]`, id `2`=L `3`=R `4`=hộp, `1`/`6`=pin đơn) |
| `0xC042` / `0xC006` | Đọc firmware / thông tin mở rộng (serial) |
| `0xC01E` / `0xF00F` | Đọc / đặt ANC (`0x01`–`0x04` mức ANC, `0x05` tắt, `0x07` xuyên âm) |
| `0xC01F` / `0xF010` | Đọc / đặt EQ preset |
| `0xF041` | EQ tuỳ chỉnh 3 dải |
| `0xF01D` | Ultra Bass |
| `0xF015` | ANC cá nhân hoá |
| `0xF004` | Phát hiện đeo tai |
| `0xF040` | Chế độ độ trễ thấp |
| `0xF020` | Kết nối kép |
| `0xF002` | Tìm tai nghe (phát chuông) |
| `0xF014` | Kiểm tra độ vừa tai |

Model ID được đọc qua kênh Google Fast Pair message stream (`df21fe2c-2515-4fdb-8886-f12c4d67927c`, group `0x03` code `0x01`).

Một số chi tiết (mã phản hồi của lệnh đọc, định dạng kết quả fit test) vẫn là suy luận và cần xác minh thêm bằng capture từ thiết bị thật. Đóng góp log/capture rất được hoan nghênh.

## Công nghệ

Tauri 2 · Rust · React 19 · TypeScript · Vite 7 · Tailwind CSS 4 · Radix UI · Zustand · i18next · Sonner · Lucide

## Đóng góp

Issue và pull request đều được chào đón — đặc biệt là:
- xác minh opcode trên các model khác nhau,
- opcode cho các tính năng đang `TODO(protocol)`,
- bản dịch mới (thêm thư mục trong `app/src/i18n/locales/`, giữ cùng bộ key).

## Miễn trừ trách nhiệm

Phần mềm được cung cấp "nguyên trạng", không kèm bảo hành. Gửi lệnh không đúng có thể khiến tai nghe hoạt động bất thường — dùng với rủi ro của bạn. Tài nguyên hình ảnh, âm thanh và font trong `app/public/assets` được trích xuất từ ứng dụng Nothing X chính thức và thuộc bản quyền của Nothing Technology Limited.
