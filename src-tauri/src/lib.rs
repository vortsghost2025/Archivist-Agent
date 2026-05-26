mod agent_fs;
mod build_index;
mod build_registry;
mod chat;
mod classification;
mod consensus_check;
mod constants;
mod constitution;
mod cps_check;
mod generate_handoff;
mod global_shim;
mod governance;
mod governance_scripts;
mod lane;
mod patch;
mod window_control;
mod safety;
mod scan_tree;
mod sign_message;
mod summarize_folder;
#[cfg(test)]
mod test_env;

use agent_fs::{
    agent_list_directory, agent_read_file, agent_search_files, clear_read_audit_log,
    get_read_audit_log,
};
use build_index::build_index;
use build_registry::build_registry;
use chat::{chat_send, fetch_models, load_agent_config_cmd, save_agent_config};
use generate_handoff::generate_handoff;
use governance::{
    check_read_only, git_status, read_governance_file, run_script, run_sovereignty_enforcer,
};
use lane::{get_lane_status, switch_lane};
use patch::{
    apply_patch, clear_patch_audit_log, confirm_patch_applied, get_patch_audit_log, propose_patch,
    reject_patch,
};
use scan_tree::scan_tree;
use sign_message::sign_message;
use summarize_folder::summarize_folder;
use window_control::set_fullscreen;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            global_shim::ensure_shim();
            let cps_score =
                crate::constitution::compute_cps_score(&crate::constitution::load_constraints());
            eprintln!(
                "[CPS] Current score: {} — informational only, no gate",
                cps_score
            );
            let window = app.get_webview_window("main").unwrap();
            window.set_title("Archivist Agent").ok();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ping,
            get_cps_score,
            cps_guard,
            scan_tree,
            summarize_folder,
            build_index,
            build_registry,
            generate_handoff,
            read_governance_file,
            run_script,
            git_status,
            check_read_only,
            run_sovereignty_enforcer,
            sign_message,
            chat_send,
            save_agent_config,
            load_agent_config_cmd,
            fetch_models,
            agent_read_file,
            agent_list_directory,
            agent_search_files,
            get_read_audit_log,
            clear_read_audit_log,
            propose_patch,
            apply_patch,
            reject_patch,
            confirm_patch_applied,
            get_patch_audit_log,
            clear_patch_audit_log,
            get_lane_status,
            switch_lane,
            set_fullscreen,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn ping() -> String {
    "pong".to_string()
}

// Evidence: CPS_ENFORCEMENT.md:70 — expose current CPS score for UI consumption.
#[tauri::command]
fn get_cps_score() -> i32 {
    let constraints = crate::constitution::load_constraints();
    crate::constitution::compute_cps_score(&constraints)
}

#[tauri::command]
fn cps_guard() -> bool {
    crate::cps_check::cps_threshold_check(10)
}

#[cfg(test)]
mod lib_tests {
    use super::*;
    use crate::safety::{load_config, AllowedRoots};
    use crate::test_env;
    use std::io::Write;
    use tempfile::NamedTempFile;

    fn write_constraints(content: &str) -> NamedTempFile {
        let mut tmp = NamedTempFile::new().expect("temp file creation failed");
        tmp.write_all(content.as_bytes()).expect("write failed");
        test_env::set_constraints_path(tmp.path().to_path_buf());
        test_env::set_force_recompute(true);
        tmp
    }

    fn cleanup(_tmp: NamedTempFile) {
        test_env::clear_constraints_path();
        test_env::clear_force_recompute();
    }

    #[test]
    fn test_ping_returns_pong() {
        assert_eq!(ping(), "pong");
    }

    #[test]
    fn test_ping_allows_on_cps_success() {
        let tmp = write_constraints("- name: HIGH\n description: high\n weight: 20\n");
        assert_eq!(ping(), "pong");
        cleanup(tmp);
    }

    #[test]
    fn test_get_cps_score_returns_correct_value() {
        let tmp = write_constraints("- name: TEST\n description: test\n weight: 15\n");
        assert_eq!(get_cps_score(), 15);
        cleanup(tmp);
    }

    #[test]
    fn test_read_only_mode_is_active() {
        let config = load_config().unwrap_or_else(|_| AllowedRoots::default());
        assert!(
            config.read_only_mode.unwrap_or(false),
            "read_only_mode should be true in config"
        );
    }

    #[test]
    fn test_read_only_guard_blocks_mutations() {
        use crate::safety::check_read_only;
        let result = check_read_only();
        assert!(
            result.is_err(),
            "check_read_only should return error when read_only_mode is true"
        );
        let err_msg = result.unwrap_err().to_string();
        assert!(
            err_msg.contains("read-only") || err_msg.contains("blocked"),
            "Error message should mention read-only: got '{}'",
            err_msg
        );
    }
}
