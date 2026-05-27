// backfill.rs — utilities for pending tasks

use crate::safety::check_read_only;

/// Scan the project for unsigned legacy message JSON files ("*_unsigned.json")
/// and produce signed versions ("*_signed.json"). Returns a summary.
/// Note: This writes directly (force mode) — use with caution. Requires
/// read-only mode to be OFF or operator consent.
#[tauri::command]
pub fn backfill_signatures(root: String) -> Result<String, String> {
    // Ensure we are allowed to write
    check_read_only().map_err(|e| format!("Read-only mode active: {}", e))?;
    let root_path = std::path::Path::new(&root);
    crate::safety::validate_path(root_path)
        .map_err(|e| format!("Path validation failed: {}", e))?;

    let mut signed = 0usize;
    let mut errors = Vec::new();

    fn process_dir(
        dir: &std::path::Path,
        signed: &mut usize,
        errors: &mut Vec<String>,
    ) -> Result<(), String> {
        for entry in std::fs::read_dir(dir)
            .map_err(|e| format!("Cannot read dir {}: {}", dir.display(), e))?
        {
            let entry = entry.map_err(|e| format!("Cannot read entry: {}", e))?;
            let path = entry.path();
            if path.is_dir() {
                // recurse
                process_dir(&path, signed, errors)?;
                continue;
            }
            // Look for *_unsigned.json files
            if let Some(fname) = path.file_name().and_then(|n| n.to_str()) {
                if fname.ends_with("_unsigned.json") {
                    // Sign the file using the existing sign_message infrastructure
                    // Extract lane name from filename (e.g., "authority_msg_unsigned.json" -> "authority")
                    let lane = if let Some(pos) = fname.find('_') {
                        fname[..pos].to_string()
                    } else {
                        "authority".to_string()
                    };

                    let result = crate::sign_message::sign_message_file(&path, Some(&lane), true);
                    if result.status == "ok" {
                        *signed += 1;
                    } else {
                        errors.push(format!(
                            "Signing failed for {}: {}",
                            path.display(),
                            result.message
                        ));
                    }
                }
            }
        }
        Ok(())
    }

    process_dir(root_path, &mut signed, &mut errors)?;

    let mut report = format!("Backfilled {} signatures.\n", signed);
    if !errors.is_empty() {
        report.push_str("Errors:\n");
        for e in errors {
            report.push_str(&format!("- {}\n", e));
        }
    }
    Ok(report)
}
