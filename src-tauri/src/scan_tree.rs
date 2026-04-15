use crate::constants;
use crate::safety::validate_path;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
pub struct TreeNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Vec<TreeNode>,
    pub size_bytes: u64,
    pub extension: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScanResult {
    pub root: String,
    pub total_files: usize,
    pub total_dirs: usize,
    pub tree: TreeNode,
    pub errors: Vec<String>,
}

/// Scan a directory tree and return its structure
///
/// # Arguments
/// * `root_path` - Path to the root directory to scan
///
/// # Returns
/// * `Result<ScanResult, String>` - Scan result or error message
///
/// # Errors
/// * Path validation failure
/// * Path does not exist
/// * Path is not a directory
/// * Path too long
#[tauri::command]
pub fn scan_tree(root_path: String) -> Result<ScanResult, String> {
    // Input validation
    if root_path.is_empty() {
        return Err("Path cannot be empty".to_string());
    }

    if root_path.len() > constants::MAX_PATH_LENGTH {
        return Err(format!(
            "Path too long (max {} characters)",
            constants::MAX_PATH_LENGTH
        ));
    }

    let path = PathBuf::from(&root_path);

    validate_path(&path).map_err(|e| format!("Path validation failed: {}", e))?;

    if !path.exists() {
        return Err(format!("Path does not exist: {}", root_path));
    }

    if !path.is_dir() {
        return Err(format!("Path is not a directory: {}", root_path));
    }

    let mut errors = Vec::new();
    let tree = build_tree(&path, &mut errors, 0);

    let (total_files, total_dirs) = count_nodes(&tree);

    Ok(ScanResult {
        root: root_path,
        total_files,
        total_dirs,
        tree,
        errors,
    })
}

/// Recursively build a tree structure from a directory
///
/// # Arguments
/// * `path` - Current path being processed
/// * `errors` - Vector to collect any errors encountered
/// * `depth` - Current recursion depth
fn build_tree(path: &PathBuf, errors: &mut Vec<String>, depth: usize) -> TreeNode {
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string_lossy().to_string());

    let extension = path.extension().map(|e| e.to_string_lossy().to_string());

    let metadata = std::fs::metadata(path);
    let size_bytes = metadata.as_ref().map(|m| m.len()).unwrap_or(0);

    let is_dir = path.is_dir();

    let mut children = Vec::new();

    if is_dir && depth < constants::MAX_SCAN_DEPTH {
        match std::fs::read_dir(path) {
            Ok(entries) => {
                let mut entries: Vec<_> = entries
                    .filter_map(|e| {
                        e.map_err(|err| {
                            errors.push(format!("Read error: {}", err));
                        })
                        .ok()
                    })
                    .collect();

                // Sort: directories first, then by name
                entries.sort_by(|a, b| {
                    let a_is_dir = a.path().is_dir();
                    let b_is_dir = b.path().is_dir();
                    match (a_is_dir, b_is_dir) {
                        (true, false) => std::cmp::Ordering::Less,
                        (false, true) => std::cmp::Ordering::Greater,
                        _ => a.file_name().cmp(&b.file_name()),
                    }
                });

                for entry in entries {
                    let file_name = entry.file_name();
                    let name_str = file_name.to_string_lossy();

                    // Skip hidden and configured directories
                    if should_skip_dir(&name_str) {
                        continue;
                    }

                    children.push(build_tree(&entry.path(), errors, depth + 1));
                }
            }
            Err(e) => {
                errors.push(format!("Cannot read dir {}: {}", path.display(), e));
            }
        }
    }

    TreeNode {
        name,
        path: path.to_string_lossy().to_string(),
        is_dir,
        children,
        size_bytes,
        extension,
    }
}

/// Check if a directory should be skipped during scanning
///
/// # Arguments
/// * `name` - Directory name
///
/// # Returns
/// * `true` if the directory should be skipped
fn should_skip_dir(name: &str) -> bool {
    // Skip hidden directories
    if name.starts_with('.') {
        return true;
    }

    // Skip configured directories
    for skip in constants::SKIP_DIRS {
        if name == *skip {
            return true;
        }
    }

    false
}

/// Count files and directories in a tree
///
/// # Arguments
/// * `node` - Tree node to count
///
/// # Returns
/// * Tuple of (file_count, directory_count)
fn count_nodes(node: &TreeNode) -> (usize, usize) {
    if node.is_dir {
        let (mut files, mut dirs) = (0, 1);
        for child in &node.children {
            let (cf, cd) = count_nodes(child);
            files += cf;
            dirs += cd;
        }
        (files, dirs)
    } else {
        (1, 0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_scan_empty_dir() {
        let tmp = TempDir::new().unwrap();
        let mut errors = Vec::new();
        let tree = build_tree(&tmp.path().to_path_buf(), &mut errors, 0);

        assert!(tree.is_dir);
        assert!(tree.children.is_empty());
        assert!(errors.is_empty());
    }

    #[test]
    fn test_scan_with_files() {
        let tmp = TempDir::new().unwrap();
        fs::write(tmp.path().join("test.rs"), "fn main() {}").unwrap();
        fs::write(tmp.path().join("README.md"), "# Test").unwrap();
        fs::create_dir(tmp.path().join("subdir")).unwrap();

        let mut errors = Vec::new();
        let tree = build_tree(&tmp.path().to_path_buf(), &mut errors, 0);

        assert!(tree.is_dir);
        assert_eq!(tree.children.len(), 3);
        assert!(tree.children[0].is_dir); // Directories come first
    }

    #[test]
    fn test_max_depth_respected() {
        let tmp = TempDir::new().unwrap();
        let mut current = tmp.path().to_path_buf();
        for i in 0..15 {
            current = current.join(format!("level_{}", i));
            fs::create_dir(&current).unwrap();
        }

        let mut errors = Vec::new();
        let tree = build_tree(&tmp.path().to_path_buf(), &mut errors, 0);

        fn max_depth(node: &TreeNode) -> usize {
            if node.children.is_empty() {
                0
            } else {
                1 + node.children.iter().map(max_depth).max().unwrap_or(0)
            }
        }

        assert!(max_depth(&tree) <= constants::MAX_SCAN_DEPTH);
    }

    #[test]
    fn test_input_validation_empty_path() {
        let result = scan_tree("".to_string());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("empty"));
    }

    #[test]
    fn test_input_validation_long_path() {
        let long_path = "a".repeat(5000);
        let result = scan_tree(long_path);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("too long"));
    }

    #[test]
    fn test_should_skip_dir() {
        assert!(should_skip_dir(".git"));
        assert!(should_skip_dir("node_modules"));
        assert!(should_skip_dir("target"));
        assert!(should_skip_dir("__pycache__"));
        assert!(!should_skip_dir("src"));
        assert!(!should_skip_dir("my-project"));
    }
}
