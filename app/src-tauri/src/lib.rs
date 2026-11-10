pub mod bluetooth;
pub mod device_match;
pub mod fast_pair_table;
pub mod protocol;
pub mod router;

use bluetooth::{
    open_windows_bluetooth_settings, scan_bluetooth_devices, send_and_await_notification,
    send_bluetooth_command,
};
use protocol::{crc16_modbus, NothingFrame};
use serde::Deserialize;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, State, WindowEvent, Wry,
};

const TRAY_ID: &str = "main";

/// Whether closing the main window hides it to the tray (true) or quits the app.
struct CloseToTray(AtomicBool);

/// Handles to the tray menu items so their labels can be localised at runtime.
struct TrayMenuItems {
    open_mini: MenuItem<Wry>,
    open_full: MenuItem<Wry>,
    anc_on: MenuItem<Wry>,
    anc_trans: MenuItem<Wry>,
    anc_off: MenuItem<Wry>,
    quit: MenuItem<Wry>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TrayLabels {
    open_mini: String,
    open_full: String,
    anc_on: String,
    anc_trans: String,
    anc_off: String,
    quit: String,
}

#[tauri::command]
fn build_nothing_packet(command: u16, fsn: u8, payload: Vec<u8>) -> Result<NothingFrame, String> {
    NothingFrame::encode(command, fsn, &payload)
}

/// Brings the main window back: restore from minimized, show, focus.
fn restore_main_window(app: &AppHandle) -> Option<tauri::WebviewWindow> {
    let win = app.get_webview_window("main")?;
    let _ = win.unminimize();
    let _ = win.show();
    let _ = win.set_focus();
    Some(win)
}

#[tauri::command]
fn parse_nothing_packet(raw_bytes: Vec<u8>) -> Result<NothingFrame, String> {
    NothingFrame::decode(&raw_bytes)
}

#[tauri::command]
fn compute_crc16(data: Vec<u8>) -> u16 {
    crc16_modbus(&data)
}

#[tauri::command]
fn set_close_to_tray(state: State<'_, CloseToTray>, enabled: bool) {
    state.0.store(enabled, Ordering::Relaxed);
}

#[tauri::command]
fn update_tray(
    app: AppHandle,
    items: State<'_, TrayMenuItems>,
    tooltip: String,
    labels: TrayLabels,
) -> Result<(), String> {
    let tray = app
        .tray_by_id(TRAY_ID)
        .ok_or_else(|| "Tray not available".to_string())?;
    tray.set_tooltip(Some(tooltip)).map_err(|e| e.to_string())?;
    for (item, text) in [
        (&items.open_mini, &labels.open_mini),
        (&items.open_full, &labels.open_full),
        (&items.anc_on, &labels.anc_on),
        (&items.anc_trans, &labels.anc_trans),
        (&items.anc_off, &labels.anc_off),
        (&items.quit, &labels.quit),
    ] {
        item.set_text(text).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Must be the first plugin: a second launch focuses the running instance instead
        // of starting another process that would fight over the RFCOMM channel.
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            let _ = restore_main_window(app);
        }))
        .manage(CloseToTray(AtomicBool::new(true)))
        .setup(|app| {
            bluetooth::init(app.handle().clone());
            let open_mini = MenuItem::with_id(
                app,
                "open_mini",
                "Mở chế độ Mini (Góc Taskbar)",
                true,
                None::<&str>,
            )?;
            let open_full = MenuItem::with_id(
                app,
                "open_full",
                "Mở Nothing X (Đầy đủ)",
                true,
                None::<&str>,
            )?;
            let sep1 = PredefinedMenuItem::separator(app)?;
            let anc_on =
                MenuItem::with_id(app, "anc_on", "Chống ồn chủ động (ANC)", true, None::<&str>)?;
            let anc_trans =
                MenuItem::with_id(app, "anc_trans", "Chế độ Xuyên âm", true, None::<&str>)?;
            let anc_off = MenuItem::with_id(app, "anc_off", "Tắt chống ồn", true, None::<&str>)?;
            let sep2 = PredefinedMenuItem::separator(app)?;
            let quit = MenuItem::with_id(app, "quit", "Thoát Nothing X", true, None::<&str>)?;

            let menu = Menu::with_items(
                app,
                &[
                    &open_mini, &open_full, &sep1, &anc_on, &anc_trans, &anc_off, &sep2, &quit,
                ],
            )?;

            app.manage(TrayMenuItems {
                open_mini,
                open_full,
                anc_on,
                anc_trans,
                anc_off,
                quit,
            });

            let mut tray_builder = TrayIconBuilder::with_id(TRAY_ID)
                .menu(&menu)
                .tooltip("Nothing X")
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open_mini" => {
                        if let Some(win) = restore_main_window(app) {
                            let _ = win.emit("tray:open-mini", ());
                        }
                    }
                    "open_full" => {
                        if let Some(win) = restore_main_window(app) {
                            let _ = win.emit("tray:open-full", ());
                        }
                    }
                    "anc_on" => {
                        let _ = app.emit("tray:anc-mode", "anc");
                    }
                    "anc_trans" => {
                        let _ = app.emit("tray:anc-mode", "transparency");
                    }
                    "anc_off" => {
                        let _ = app.emit("tray:anc-mode", "off");
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        // The frontend restores the window in its current view mode.
                        if let Some(win) = restore_main_window(tray.app_handle()) {
                            let _ = win.emit("tray:restore", ());
                        }
                    }
                });

            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }

            let _ = tray_builder.build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let to_tray = window.state::<CloseToTray>().0.load(Ordering::Relaxed);
                if to_tray {
                    // Hide to the Windows system tray ("Show hidden icons").
                    let _ = window.hide();
                    api.prevent_close();
                } else {
                    window.app_handle().exit(0);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            build_nothing_packet,
            parse_nothing_packet,
            compute_crc16,
            scan_bluetooth_devices,
            send_bluetooth_command,
            send_and_await_notification,
            open_windows_bluetooth_settings,
            set_close_to_tray,
            update_tray
        ])
        .run(tauri::generate_context!())
        .expect("error while running Nothing X desktop application");
}
