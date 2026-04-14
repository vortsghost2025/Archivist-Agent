use crate::safety::validate_path;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize)]
pub struct IndexEntry {
    pub path: String,
    pub classification: String,
    pub summary: String,
    pub key_files: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IndexResult {
    pub root: String,
    pub total_classified: usize,
    pub by_classification: std::collections::HashMap<String, usize>,
    pub index_path: String,
}

#[tauri::command]
pub fn build_index(root: String) -> Result<IndexResult, String> {
    let path = Path::new(&root);

    validate_path(path).map_err(|e| format!("Path validation failed: {}", e))?;

    if !path.exists() {
        return Err(format!("Path does not exist: {}", root));
    }

    let root_path = path;

    let mut runtime_entries: Vec<IndexEntry> = Vec::new();
    let mut interface_entries: Vec<IndexEntry> = Vec::new();
    let mut memory_entries: Vec<IndexEntry> = Vec::new();
    let mut verification_entries: Vec<IndexEntry> = Vec::new();
    let mut research_entries: Vec<IndexEntry> = Vec::new();
    let mut unknown_entries: Vec<IndexEntry> = Vec::new();

    // Scan immediate subdirectories
    if let Ok(entries) = fs::read_dir(root_path) {
        for entry in entries.filter_map(|e| e.ok()) {
            let entry_path = entry.path();
            if entry_path.is_dir() {
                let dir_name = entry_path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default();

                // Skip hidden and common non-project directories
                if dir_name.starts_with('.')
                    || dir_name == "node_modules"
                    || dir_name == "target"
                    || dir_name == "dist"
                {
                    continue;
                }

                let (classification, summary, key_files) = classify_path_simple(&entry_path);

                let index_entry = IndexEntry {
                    path: entry_path.to_string_lossy().to_string(),
                    classification: classification.clone(),
                    summary,
                    key_files,
                };

                match classification.as_str() {
                    "Runtime" => runtime_entries.push(index_entry),
                    "Interface" => interface_entries.push(index_entry),
                    "Memory" => memory_entries.push(index_entry),
                    "Verification" => verification_entries.push(index_entry),
                    "Research" => research_entries.push(index_entry),
                    _ => unknown_entries.push(index_entry),
                };
            }
        }
    }

    // Build markdown index
    let mut md = format!("# Index: {}\n\n", root);
    md.push_str("## Runtime\n\n");
    if runtime_entries.is_empty() {
        md.push_str("_None found_\n\n");
    } else {
        for e in &runtime_entries {
            md.push_str(&format!(
                "- **{}** — {}\n",
                e.path.split(['\\', '/']).last().unwrap_or(&e.path),
                e.summary
            ));
        }
        md.push('\n');
    }

    md.push_str("## Interface\n\n");
    if interface_entries.is_empty() {
        md.push_str("_None found_\n\n");
    } else {
        for e in &interface_entries {
            md.push_str(&format!(
                "- **{}** — {}\n",
                e.path.split(['\\', '/']).last().unwrap_or(&e.path),
                e.summary
            ));
        }
        md.push('\n');
    }

    md.push_str("## Memory\n\n");
    if memory_entries.is_empty() {
        md.push_str("_None found_\n\n");
    } else {
        for e in &memory_entries {
            md.push_str(&format!(
                "- **{}** — {}\n",
                e.path.split(['\\', '/']).last().unwrap_or(&e.path),
                e.summary
            ));
        }
        md.push('\n');
    }

    md.push_str("## Verification\n\n");
    if verification_entries.is_empty() {
        md.push_str("_None found_\n\n");
    } else {
        for e in &verification_entries {
            md.push_str(&format!(
                "- **{}** — {}\n",
                e.path.split(['\\', '/']).last().unwrap_or(&e.path),
                e.summary
            ));
        }
        md.push('\n');
    }

    md.push_str("## Research\n\n");
    if research_entries.is_empty() {
        md.push_str("_None found_\n\n");
    } else {
        for e in &research_entries {
            md.push_str(&format!(
                "- **{}** — {}\n",
                e.path.split(['\\', '/']).last().unwrap_or(&e.path),
                e.summary
            ));
        }
        md.push('\n');
    }

    md.push_str("## Unknown\n\n");
    if unknown_entries.is_empty() {
        md.push_str("_None found_\n\n");
    } else {
        for e in &unknown_entries {
            md.push_str(&format!(
                "- **{}** — {}\n",
                e.path.split(['\\', '/']).last().unwrap_or(&e.path),
                e.summary
            ));
        }
        md.push('\n');
    }

    // Write index file
    let index_path = Path::new(&root).join("INDEX.md");
    fs::write(&index_path, &md).map_err(|e| format!("Failed to write index: {}", e))?;

    // Build result
    let mut by_classification = std::collections::HashMap::new();
    by_classification.insert("Runtime".to_string(), runtime_entries.len());
    by_classification.insert("Interface".to_string(), interface_entries.len());
    by_classification.insert("Memory".to_string(), memory_entries.len());
    by_classification.insert("Verification".to_string(), verification_entries.len());
    by_classification.insert("Research".to_string(), research_entries.len());
    by_classification.insert("Unknown".to_string(), unknown_entries.len());

    let total = runtime_entries.len()
        + interface_entries.len()
        + memory_entries.len()
        + verification_entries.len()
        + research_entries.len()
        + unknown_entries.len();

    Ok(IndexResult {
        root,
        total_classified: total,
        by_classification,
        index_path: index_path.to_string_lossy().to_string(),
    })
}

fn classify_path_simple(path: &Path) -> (String, String, Vec<String>) {
    let path_str = path.to_string_lossy().to_lowercase();
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    // Check for code files in directory
    let mut has_code = false;
    let mut key_files: Vec<String> = Vec::new();

    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.filter_map(|e| e.ok()).take(10) {
            let entry_name = entry.file_name().to_string_lossy().to_string();
            if entry_path_is_file(&entry.path()) {
                if entry_name.ends_with(".js")
                    || entry_name.ends_with(".ts")
                    || entry_name.ends_with(".rs")
                    || entry_name.ends_with(".py")
                    || entry_name.ends_with(".html")
                {
                    has_code = true;
                }
                if entry_name.to_lowercase().contains("readme")
                    || entry_name.ends_with(".json")
                    || entry_name.ends_with(".md")
                {
                    key_files.push(entry_name);
                }
            }
        }
    }

    // Classification logic
    let classification: String = if path_str.contains("test")
        || path_str.contains("spec")
        || path_str.contains("bench")
    {
        "Verification".to_string()
    } else if path_str.contains("logs") || path_str.contains("cache") || path_str.contains("temp") {
        "Memory".to_string()
    } else if path_str.contains("ui") || path_str.contains("frontend") || path_str.contains("web") {
        if has_code {
            "Interface".to_string()
        } else {
            "Unknown".to_string()
        }
    } else if path_str.contains("research") || path_str.contains("experiment") {
        "Research".to_string()
    } else if has_code {
        "Runtime".to_string()
    } else {
        "Unknown".to_string()
    };

    let summary = match classification.as_str() {
        "Runtime" => "Executable code or project",
        "Interface" => "User interface or web frontend",
        "Memory" => "Logs, documentation, or state",
        "Verification" => "Tests, benchmarks, or reports",
        "Research" => "Experiments or theoretical work",
        _ => "Unclassified folder",
    }
    .to_string();

    (classification, summary, key_files)
}

fn entry_path_is_file(path: &std::path::Path) -> bool {
    path.is_file()
}
