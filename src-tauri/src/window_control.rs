// Tauri window control commands
use serde::Serialize;
use tauri::Window;

/// Toggle native OS window fullscreen mode.
#[tauri::command]
pub fn set_fullscreen(window: Window, fullscreen: bool) -> Result<(), String> {
    window.set_fullscreen(fullscreen).map_err(|e| e.to_string())
}

/// Get the current window scale factor (device pixel ratio).
#[tauri::command]
pub fn get_window_scale_factor(window: Window) -> Result<f64, String> {
    // `Window::scale_factor` already returns a `Result<f64, tauri::Error>`.
    // The original code wrapped the call in `Ok(...?)`, which introduced an
    // unnecessary `Result<Result<..>>` and triggered a clippy warning.
    // We simply forward the result, converting any error to a string.
    window.scale_factor().map_err(|e| e.to_string())
}

/// Window scale info for diagnostics.
#[derive(Serialize)]
pub struct WindowScaleInfo {
    pub scale_factor: f64,
    pub inner_width: f64,
    pub inner_height: f64,
    pub outer_width: f64,
    pub outer_height: f64,
}

#[tauri::command]
pub fn get_window_scale_info(window: Window) -> Result<WindowScaleInfo, String> {
    let scale_factor = window.scale_factor().map_err(|e| e.to_string())?;
    let inner_size = window.inner_size().map_err(|e| e.to_string())?;
    let outer_size = window.outer_size().map_err(|e| e.to_string())?;

    Ok(WindowScaleInfo {
        scale_factor,
        inner_width: inner_size.width as f64,
        inner_height: inner_size.height as f64,
        outer_width: outer_size.width as f64,
        outer_height: outer_size.height as f64,
    })
}

/// Resize window to target logical size (accounts for Windows DPI scaling).
#[tauri::command]
pub fn set_window_size(window: Window, width: u32, height: u32) -> Result<(), String> {
    window
        .set_size(tauri::LogicalSize::new(width, height))
        .map_err(|e| e.to_string())
}
