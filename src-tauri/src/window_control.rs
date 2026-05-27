// Tauri window control commands
use tauri::Window;

/// Toggle native OS window fullscreen mode.
/// Returns Ok(()) on success, otherwise an error string.
#[tauri::command]
pub fn set_fullscreen(window: Window, fullscreen: bool) -> Result<(), String> {
    window.set_fullscreen(fullscreen).map_err(|e| e.to_string())
}
