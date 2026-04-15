mod constitution;
mod build_index;
mod build_registry;
mod classification;
mod constants;
mod generate_handoff;
mod safety;
mod scan_tree;
mod summarize_folder;
mod global_shim;
mod cps_check;

use build_index::build_index;
use build_registry::build_registry;
use generate_handoff::generate_handoff;
use scan_tree::scan_tree;
use summarize_folder::summarize_folder;
use tauri::Manager;

// Evidence: CPS_ENFORCEMENT.md:70 — CPS score influences runtime behavior via ping command.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Evidence: BOOTSTRAP.md:45-47 — ensure .global folder mirrors root for legacy paths
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Evidence: BOOTSTRAP.md:53 — ensure governance files are accessible
            global_shim::ensure_shim();
            // Load CPS and decide if system may continue; threshold 10 for demo
            let _cps_ok = crate::cps_check::cps_threshold_check(10);
            let window = app.get_webview_window("main").unwrap();
            window.set_title("Archivist Agent").ok();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ping,
            get_cps_score,
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
    if crate::cps_check::cps_threshold_check(10) {
        "pong".to_string()
    } else {
        "cps block".to_string()
    }
}

// Evidence: CPS_ENFORCEMENT.md:70 — expose current CPS score for UI consumption.
#[tauri::command]
fn get_cps_score() -> i32 {
    // Compute on demand to reflect any test‑time changes.
    let constraints = crate::constitution::load_constraints();
    crate::constitution::compute_cps_score(&constraints)
}

#[cfg(test)]
mod lib_tests {
    use super::*;
    use std::env;
    use tempfile::NamedTempFile;
    use std::io::Write;

    fn write_constraints(content: &str) -> NamedTempFile {
        let mut tmp = NamedTempFile::new().expect("temp file creation failed");
        tmp.write_all(content.as_bytes()).expect("write failed");
        // Point loader to this temporary file and force recompute for CPS.
        env::set_var("CONSTRAINTS_PATH", tmp.path());
        env::set_var("CPS_FORCE_RECOMPUTE", "1");
        tmp
    }

    fn cleanup(_tmp: NamedTempFile) {
        env::remove_var("CONSTRAINTS_PATH");
        env::remove_var("CPS_FORCE_RECOMPUTE");
        // NamedTempFile will be deleted when dropped.
    }

    #[test]
    fn test_ping_blocks_on_cps_failure() {
        let tmp = write_constraints("- name: LOW\n  description: low\n  weight: 2\n");
        assert_eq!(ping(), "cps block");
        cleanup(tmp);
    }

    #[test]
    fn test_ping_allows_on_cps_success() {
        let tmp = write_constraints("- name: HIGH\n  description: high\n  weight: 20\n");
        assert_eq!(ping(), "pong");
        cleanup(tmp);
    }

    #[test]
    fn test_get_cps_score_returns_correct_value() {
        let tmp = write_constraints("- name: TEST\n  description: test\n  weight: 15\n");
        assert_eq!(get_cps_score(), 15);
        cleanup(tmp);
    }
}

