use crate::classification::classify_directory;
use crate::safety::{check_read_only, is_path_allowed, load_config};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectInfo {
    pub name: String,
    pub path: String,
    pub classification: String,
    pub summary: String,
    pub key_files: Vec<String>,
    pub cross_links: Vec<String>,
    pub last_modified: Option<String>,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Registry {
    pub generated_at: String,
    pub roots: Vec<String>,
    pub projects: Vec<ProjectInfo>,
}

// Classification logic moved to crate::classification::classify_directory().

#[tauri::command]
pub fn build_registry() -> Result<String, String> {
    check_read_only().map_err(|e| format!("Read-only mode active: {}", e))?;

    let config = load_config().unwrap_or_default();
    let mut projects: Vec<ProjectInfo> = Vec::new();

    for root in &config.allowed_roots {
        if !is_path_allowed(root, &config) {
            continue;
        }

        let root_path = Path::new(root);
        if !root_path.exists() {
            continue;
        }

        if let Ok(entries) = fs::read_dir(root_path) {
            for entry in entries.filter_map(|e| e.ok()) {
                let entry_path = entry.path();
                if !entry_path.is_dir() {
                    continue;
                }

                let name = entry_path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default();

                // Skip hidden and build directories
                if name.starts_with('.')
                    || name == "node_modules"
                    || name == "target"
                    || name == "dist"
                {
                    continue;
                }

                let dir_class = classify_directory(&entry_path, 20);

                // Key files are collected separately with a smaller sample limit
                let mut key_files: Vec<String> = Vec::new();
                if let Ok(files) = fs::read_dir(&entry_path) {
                    for f in files.filter_map(|e| e.ok()).take(5) {
                        let fname = f.file_name().to_string_lossy().to_string();
                        if fname.to_lowercase().contains("readme")
                            || fname.ends_with(".json")
                            || fname.ends_with(".md")
                        {
                            key_files.push(fname);
                        }
                    }
                }

                let last_modified = fs::metadata(&entry_path)
                    .ok()
                    .and_then(|m| m.modified().ok())
                    .map(|t| {
                        chrono::DateTime::<chrono::Utc>::from(t)
                            .format("%Y-%m-%dT%H:%M:%SZ")
                            .to_string()
                    });

                projects.push(ProjectInfo {
                    name,
                    path: entry_path.to_string_lossy().to_string(),
                    classification: dir_class.bucket,
                    summary: dir_class.summary,
                    key_files,
                    cross_links: vec![],
                    last_modified,
                    status: "active".to_string(),
                });
            }
        }
    }

    let registry = Registry {
        generated_at: Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string(),
        roots: config.allowed_roots,
        projects,
    };

    // Write to data directory
    let registry_json = serde_json::to_string_pretty(&registry).map_err(|e| e.to_string())?;

    // Ensure data directory exists
    fs::create_dir_all("data").ok();
    fs::write("data/project-registry.json", &registry_json)
        .map_err(|e| format!("Failed to write registry: {}", e))?;

    Ok(format!(
        "Registry written to data/project-registry.json\n\n{}",
        registry_json
    ))
}
