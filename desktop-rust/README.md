# Sangeet Desktop for Windows (Rust + Tauri v2)

Native Windows desktop client for [Sangeet](https://sangeet.shasant.xyz), written in Rust using **Tauri v2** and the OS-native Microsoft Edge WebView2 runtime.

## Highlights
- **Ultra-lightweight Rust binary** — no bundled Chromium runtime (~5–8 MB portable `.exe` instead of 100+ MB Electron bundles).
- **Close-to-tray background audio** — closing the window minimizes to the Windows system tray so your music keeps playing uninterrupted.
- **Native tray playback controls** — Play / Pause, Next Track, Previous Track, Open, and Quit directly from the tray menu.
- **Single-instance locking** — launching Sangeet a second time restores and focuses your active window.

## Build locally (Windows)

Requires [Rust](https://rustup.rs/) (`stable-x86_64-pc-windows-msvc`) and Microsoft Edge WebView2 (preinstalled on Windows 10/11).

```powershell
# Development (connects to http://localhost:3000/home or SANGEET_APP_URL)
cargo run --manifest-path desktop-rust/Cargo.toml

# Production release binary (outputs desktop-rust/target/release/sangeet.exe)
cargo build --release --manifest-path desktop-rust/Cargo.toml
```
