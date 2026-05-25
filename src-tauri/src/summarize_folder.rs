use crate::classification::{classify_file, ClassifiedFile};
use crate::constants::bucket;
use crate::safety::validate_path;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
pub struct FolderSummary {
    pub root: String,
    pub total_files: usize,
    pub buckets: HashMap<String, Vec<ClassifiedFile>>,
    pub bucket_counts: HashMap<String, usize>,
    pub unclassified_count: usize,
    pub errors: Vec<String>,
}

#[tauri::command]
pub fn summarize_folder(root_path: String) -> Result<FolderSummary, String> {
    let path = PathBuf::from(&root_path);

    validate_path(&path).map_err(|e| format!("Path validation failed: {}", e))?;

    if !path.exists() {
        return Err(format!("Path does not exist: {}", root_path));
    }

    let mut all_files = Vec::new();
    let mut errors = Vec::new();

    collect_files(&path, &mut all_files, &mut errors);

    let total_files = all_files.len();
    let mut buckets: HashMap<String, Vec<ClassifiedFile>> = HashMap::new();

    for bucket_name in &[
        bucket::RUNTIME,
        bucket::INTERFACE,
        bucket::MEMORY,
        bucket::VERIFICATION,
        bucket::RESEARCH,
        bucket::UNKNOWN,
    ] {
        buckets.insert(bucket_name.to_string(), Vec::new());
    }

    for file_path in all_files {
        let classified = classify_file(&file_path);
        let bucket_name = classified.bucket.clone();
        buckets.entry(bucket_name).or_default().push(classified);
    }

    let mut bucket_counts = HashMap::new();
    let mut unclassified_count = 0;

    for (name, files) in &buckets {
        let count = files.len();
        bucket_counts.insert(name.clone(), count);
        if name == bucket::UNKNOWN {
            unclassified_count = count;
        }
    }

    Ok(FolderSummary {
        root: root_path,
        total_files,
        buckets,
        bucket_counts,
        unclassified_count,
        errors,
    })
}

fn collect_files(dir: &PathBuf, files: &mut Vec<PathBuf>, errors: &mut Vec<String>) {
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(e) => {
            errors.push(format!("Cannot read {}: {}", dir.display(), e));
            return;
        }
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name();
        let name_str = name.to_string_lossy();

        if path.is_dir() {
            if !name_str.starts_with('.')
                && name_str != "node_modules"
                && name_str != "target"
                && name_str != "__pycache__"
                && name_str != ".git"
            {
                collect_files(&path, files, errors);
            }
        } else {
            files.push(path);
        }
    }
}

// Classification logic moved to crate::classification module.
// This file uses classify_file() and ClassifiedFile from there.

#[cfg(test)]
mod tests {
    use crate::classification::{classify_file, is_verification_file};
    use std::path::PathBuf;

    #[test]
    fn test_summarize_folder_uses_shared_classify_file() {
        let path = PathBuf::from("src/main.rs");
        let result = classify_file(&path);
        assert_eq!(result.bucket, "Runtime");
    }

    #[test]
    fn test_summarize_folder_verification_override() {
        let path = PathBuf::from("src/safety_test.rs");
        let result = classify_file(&path);
        assert_eq!(result.bucket, "Verification");
    }

    #[test]
    fn test_summarize_folder_predicate_reexport() {
        assert!(is_verification_file("test_safety.rs", "rs"));
        assert!(is_verification_file("safety.test.js", "js"));
    }
}
