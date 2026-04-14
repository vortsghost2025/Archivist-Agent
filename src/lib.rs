pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            archivist_agent_lib::commands::scan_tree::scan_tree,
            archivist_agent_lib::commands::summarize_folder::summarize_folder,
            archivist_agent_lib::commands::config::get_allowed_roots,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
