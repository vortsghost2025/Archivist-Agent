mod build_index;
mod build_registry;
mod classification;
mod constants;
mod generate_handoff;
mod safety;
mod scan_tree;
mod summarize_folder;

use build_index::build_index;
use build_registry::build_registry;
use generate_handoff::generate_handoff;
use scan_tree::scan_tree;
use summarize_folder::summarize_folder;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            window.set_title("Archivist Agent").ok();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ping,
            scan_tree,
            summarize_folder,
            build_index,
            build_registry,
            generate_handoff,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn ping() -> String {
    "pong".to_string()
}
