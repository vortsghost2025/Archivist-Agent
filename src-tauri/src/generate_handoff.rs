use crate::safety::validate_path;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize)]
pub struct HandoffResult {
    pub project_name: String,
    pub path: String,
    pub classification: String,
    pub summary: String,
    pub key_files: Vec<String>,
    pub concerns: Vec<String>,
    pub safe_actions: Vec<String>,
    pub handoff_path: String,
}

#[tauri::command]
pub fn generate_handoff(path: String) -> Result<String, String> {
    let path_ref = Path::new(&path);

    validate_path(path_ref).map_err(|e| format!("Path validation failed: {}", e))?;

    if !path_ref.exists() || !path_ref.is_dir() {
        return Err(format!("Invalid path: {}", path));
    }

    let project_name = path_ref
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "Unknown".to_string());

    // Classify
    let path_str = path_ref.to_string_lossy().to_lowercase();
    let mut has_code = false;
    let mut key_files: Vec<String> = Vec::new();
    let mut concerns: Vec<String> = Vec::new();

    if let Ok(entries) = fs::read_dir(path_ref) {
        for entry in entries.filter_map(|e| e.ok()).take(20) {
            let name = entry.file_name().to_string_lossy().to_string();
            if entry.path().is_file() {
                if name.ends_with(".js")
                    || name.ends_with(".ts")
                    || name.ends_with(".rs")
                    || name.ends_with(".py")
                    || name.ends_with(".go")
                    || name.ends_with(".html")
                {
                    has_code = true;
                }
                if name.to_lowercase().contains("readme")
                    || name.ends_with(".md")
                    || name.ends_with(".json")
                    || name.ends_with(".toml")
                {
                    key_files.push(name);
                }
            }
        }
    }

    let (classification, summary) = if path_str.contains("test") || path_str.contains("spec") {
        (
            "Verification".to_string(),
            "Tests or benchmarks".to_string(),
        )
    } else if path_str.contains("logs") || path_str.contains("cache") {
        ("Memory".to_string(), "Logs or temporary files".to_string())
    } else if path_str.contains("ui") || path_str.contains("frontend") {
        (
            "Interface".to_string(),
            "User interface or web frontend".to_string(),
        )
    } else if path_str.contains("research") {
        (
            "Research".to_string(),
            "Experiments or theoretical work".to_string(),
        )
    } else if has_code {
        (
            "Runtime".to_string(),
            "Executable code or project".to_string(),
        )
    } else {
        ("Unknown".to_string(), "Unclassified folder".to_string())
    };

    // Check for potential concerns
    if key_files.is_empty() {
        concerns.push("No README or config files found".to_string());
    }
    if classification == "Unknown" {
        concerns.push("Classification unclear - may need review".to_string());
    }

    // Safe actions
    let safe_actions = vec![
        "inspect key files".to_string(),
        "check for AGENTS.md or CLAUDE.md".to_string(),
        "review project structure".to_string(),
    ];

    // Build markdown handoff
    let mut md = format!("# Project Brief: {}\n\n", project_name);
    md.push_str(&format!("## Path\n{}\n\n", path));
    md.push_str(&format!("## What it is\n{}\n\n", summary));
    md.push_str(&format!("## Classification\n{}\n\n", classification));

    if !key_files.is_empty() {
        md.push_str("## Important Files\n");
        for f in &key_files {
            md.push_str(&format!("- {}\n", f));
        }
        md.push('\n');
    }

    if !concerns.is_empty() {
        md.push_str("## Current Concerns\n");
        for c in &concerns {
            md.push_str(&format!("- {}\n", c));
        }
        md.push('\n');
    }

    md.push_str("## Safe Next Actions\n");
    for a in &safe_actions {
        md.push_str(&format!("- {}\n", a));
    }

    // Write handoff file
    fs::create_dir_all("outputs/handoffs").ok();
    let handoff_filename = format!(
        "outputs/handoffs/{}-brief.md",
        project_name.to_lowercase().replace(' ', "-")
    );
    fs::write(&handoff_filename, &md).map_err(|e| format!("Failed to write handoff: {}", e))?;

    let _result = HandoffResult {
        project_name,
        path,
        classification,
        summary,
        key_files,
        concerns,
        safe_actions,
        handoff_path: handoff_filename.clone(),
    };

    Ok(format!("Handoff saved to: {}\n\n{}", handoff_filename, md))
}
