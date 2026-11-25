#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    window::Color,
    Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};

const PROD_APP_URL: &str = "https://sangeet.shasant.xyz/home";
const DEV_APP_URL: &str = "http://localhost:3000/home";
const MIN_MUSIC_BYTES: u64 = 180 * 1024;
const MAX_SCANNED_TRACKS: usize = 1500;

const DESKTOP_BRIDGE_INIT_SCRIPT: &str = r#"
(function() {
  if (window.SangeetDesktop) return;
  const invoke = (cmd, args) => {
    const fn = (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke)
      || (window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke);
    if (typeof fn !== 'function') return Promise.reject(new Error('Tauri bridge unavailable'));
    return fn(cmd, args || {});
  };
  window.SangeetDesktop = {
    isNativeApp: () => true,
    platform: 'windows',
    setSystemTheme: () => {},
    scanLocalAudio: () => invoke('scan_local_audio'),
    downloadAudioTrack: (payload) => invoke('download_audio_track', { payload }),
    openDownloadsFolder: () => invoke('open_downloads_folder')
  };
})();
"#;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ScannedAudioTrack {
    id: String,
    title: String,
    artist: String,
    album: String,
    duration: f64,
    uri: String,
    path: String,
    size_bytes: u64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DownloadPayload {
    track_id: String,
    url: String,
    title: String,
    artist: String,
    filename: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DownloadResult {
    ok: bool,
    path: Option<String>,
    size_bytes: Option<u64>,
    error: Option<String>,
}

fn is_audio_extension(path: &Path) -> bool {
    match path.extension().and_then(|e| e.to_str()) {
        Some(ext) => matches!(
            ext.to_ascii_lowercase().as_str(),
            "mp3" | "flac" | "wav" | "m4a" | "aac" | "ogg" | "opus"
        ),
        None => false,
    }
}

fn is_excluded_non_music(path: &Path) -> bool {
    let lower = path.to_string_lossy().to_ascii_lowercase();
    const EXCLUDED: &[&str] = &[
        "ringtone",
        "notification",
        "alarm",
        "recording",
        "soundrecorder",
        "voicerecorder",
        "callrecord",
        "voicemail",
        "whatsapp",
        "telegram",
        "messenger",
        "dictaphone",
        "screenrecord",
        "audiorecord",
        "ptt-",
        "aud-",
        "voice note",
        "voicenote",
    ];
    EXCLUDED.iter().any(|tok| lower.contains(tok))
}

fn collect_music_files(dir: &Path, out: &mut Vec<ScannedAudioTrack>, depth: usize) {
    if depth > 4 || out.len() >= MAX_SCANNED_TRACKS {
        return;
    }
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        if out.len() >= MAX_SCANNED_TRACKS {
            break;
        }
        let path = entry.path();
        if is_excluded_non_music(&path) {
            continue;
        }
        if path.is_dir() {
            collect_music_files(&path, out, depth + 1);
            continue;
        }
        if !is_audio_extension(&path) {
            continue;
        }
        let Ok(meta) = entry.metadata() else {
            continue;
        };
        if meta.len() < MIN_MUSIC_BYTES {
            continue;
        }
        let stem = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Unknown Track")
            .trim()
            .to_string();
        let (artist, title) = if let Some((a, t)) = stem.split_once(" - ") {
            (a.trim().to_string(), t.trim().to_string())
        } else {
            ("Local Music".to_string(), stem)
        };
        let path_str = path.to_string_lossy().to_string();
        let uri = format!("file:///{}", path_str.replace('\\', "/"));
        out.push(ScannedAudioTrack {
            id: format!("win_{}", out.len() + 1),
            title,
            artist,
            album: dir
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("Music")
                .to_string(),
            duration: 0.0,
            uri,
            path: path_str,
            size_bytes: meta.len(),
        });
    }
}

fn resolve_sangeet_music_dir() -> PathBuf {
    let base = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."));
    base.join("Music").join("Sangeet")
}

#[tauri::command]
fn scan_local_audio() -> Vec<ScannedAudioTrack> {
    let mut tracks = Vec::new();
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."));
    let music_dir = home.join("Music");
    if music_dir.is_dir() {
        collect_music_files(&music_dir, &mut tracks, 0);
    }
    let downloads_sangeet = home.join("Downloads").join("Sangeet");
    if downloads_sangeet.is_dir() {
        collect_music_files(&downloads_sangeet, &mut tracks, 0);
    }
    tracks
}

#[tauri::command]
fn download_audio_track(payload: DownloadPayload) -> DownloadResult {
    if !(payload.url.starts_with("https://") || payload.url.starts_with("http://")) {
        return DownloadResult {
            ok: false,
            path: None,
            size_bytes: None,
            error: Some("Unsupported download URL.".to_string()),
        };
    }
    let target_dir = resolve_sangeet_music_dir();
    if let Err(err) = fs::create_dir_all(&target_dir) {
        return DownloadResult {
            ok: false,
            path: None,
            size_bytes: None,
            error: Some(format!("Could not create Music/Sangeet folder: {err}")),
        };
    }

    let sanitized: String = payload
        .filename
        .chars()
        .map(|c| match c {
            '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            _ => c,
        })
        .collect();
    let filename = if sanitized.trim().is_empty() {
        format!("{}.mp3", payload.track_id)
    } else {
        sanitized.trim().to_string()
    };
    let dest = target_dir.join(filename);

    let status = std::process::Command::new("curl")
        .args([
            "-fsSL",
            "--retry",
            "2",
            "--connect-timeout",
            "10",
            "-o",
            dest.to_string_lossy().as_ref(),
            &payload.url,
        ])
        .status();

    match status {
        Ok(exit) if exit.success() => {
            let size = fs::metadata(&dest).map(|m| m.len()).unwrap_or(0);
            if size == 0 {
                let _ = fs::remove_file(&dest);
                return DownloadResult {
                    ok: false,
                    path: None,
                    size_bytes: None,
                    error: Some("Downloaded file was empty.".to_string()),
                };
            }
            DownloadResult {
                ok: true,
                path: Some(dest.to_string_lossy().to_string()),
                size_bytes: Some(size),
                error: None,
            }
        }
        _ => {
            let _ = fs::remove_file(&dest);
            DownloadResult {
                ok: false,
                path: None,
                size_bytes: None,
                error: Some(format!(
                    "Could not download {} - {}.",
                    payload.artist, payload.title
                )),
            }
        }
    }
}

#[tauri::command]
fn open_downloads_folder() {
    let dir = resolve_sangeet_music_dir();
    let _ = fs::create_dir_all(&dir);
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("explorer").arg(dir).spawn();
    }
}

fn resolve_app_url() -> String {
    if let Ok(custom) = std::env::var("SANGEET_APP_URL") {
        let trimmed = custom.trim();
        if trimmed.starts_with("https://") || trimmed.starts_with("http://") {
            return trimmed.to_string();
        }
    }
    if cfg!(debug_assertions) {
        DEV_APP_URL.to_string()
    } else {
        PROD_APP_URL.to_string()
    }
}

fn is_allowed_webview_host(host: &str) -> bool {
    let h = host.to_ascii_lowercase();
    h == "sangeet.shasant.xyz"
        || h.ends_with(".sangeet.shasant.xyz")
        || h == "localhost"
        || h == "127.0.0.1"
        || h == "accounts.google.com"
        || h == "youtube.com"
        || h.ends_with(".youtube.com")
        || h == "youtu.be"
}

fn open_in_default_browser(url: &str) {
    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return;
    }
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("rundll32")
            .args(["url.dll,FileProtocolHandler", url])
            .spawn();
    }
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open").arg(url).spawn();
    }
    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("xdg-open").arg(url).spawn();
    }
}

fn trigger_web_control(app: &tauri::AppHandle, script: &str) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.eval(script);
    }
}

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn main() {
    let app_url_str = resolve_app_url();
    let app_url: tauri::Url = app_url_str
        .parse()
        .unwrap_or_else(|_| PROD_APP_URL.parse().expect("valid fallback URL"));

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main_window(app);
        }))
        .invoke_handler(tauri::generate_handler![
            scan_local_audio,
            download_audio_track,
            open_downloads_folder
        ])
        .setup(move |app| {
            let main_window = WebviewWindowBuilder::new(
                app,
                "main",
                WebviewUrl::External(app_url.clone()),
            )
            .title("Sangeet")
            .inner_size(1280.0, 820.0)
            .min_inner_size(420.0, 620.0)
            .background_color(Color(6, 9, 7, 255))
            .resizable(true)
            .center()
            .initialization_script(DESKTOP_BRIDGE_INIT_SCRIPT)
            .on_navigation(|url| {
                let scheme = url.scheme();
                if scheme == "about" || scheme == "blob" || scheme == "data" {
                    return true;
                }
                if let Some(host) = url.host_str() {
                    if is_allowed_webview_host(host) {
                        return true;
                    }
                }
                open_in_default_browser(url.as_str());
                false
            })
            .build()?;

            // Hide to system tray when the window close button is clicked so music keeps playing.
            let win_handle = main_window.clone();
            main_window.on_window_event(move |event| {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = win_handle.hide();
                }
            });

            // Build native system tray menu for background playback control
            let show_item = MenuItem::with_id(app, "show", "Open Sangeet", true, None::<&str>)?;
            let sep1 = PredefinedMenuItem::separator(app)?;
            let play_pause_item =
                MenuItem::with_id(app, "play_pause", "Play / Pause", true, None::<&str>)?;
            let next_item = MenuItem::with_id(app, "next", "Next Track", true, None::<&str>)?;
            let prev_item = MenuItem::with_id(app, "prev", "Previous Track", true, None::<&str>)?;
            let sep2 = PredefinedMenuItem::separator(app)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit Sangeet", true, None::<&str>)?;

            let tray_menu = Menu::with_items(
                app,
                &[
                    &show_item,
                    &sep1,
                    &play_pause_item,
                    &next_item,
                    &prev_item,
                    &sep2,
                    &quit_item,
                ],
            )?;

            let mut tray_builder = TrayIconBuilder::new()
                .tooltip("Sangeet — Music Studio")
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main_window(app),
                    "play_pause" => trigger_web_control(
                        app,
                        "document.querySelector('[aria-label=\"Pause\"], [aria-label=\"Play\"]')?.click();",
                    ),
                    "next" => trigger_web_control(
                        app,
                        "document.querySelector('[aria-label=\"Next\"]')?.click();",
                    ),
                    "prev" => trigger_web_control(
                        app,
                        "document.querySelector('[aria-label=\"Previous\"]')?.click();",
                    ),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                });

            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }

            tray_builder.build(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Sangeet desktop application");
}
