// Evidence: MULTI_AGENT_THEORY_EXTRACTION.md — Paper D requires independent operation
// Evidence: ISOLATION_VIOLATION_FIX.md — Thread-local state for test isolation
//
// This module provides thread-local environment state for tests.
// Production code does NOT use this module — it's test-only.
//
// Paper D states agents should run CPS independently. Global env vars
// violate this by sharing state across threads. Thread-locals restore independence.

use std::cell::RefCell;
use std::path::PathBuf;

thread_local! {
    pub static TEST_CONSTRAINTS_PATH: RefCell<Option<PathBuf>> = RefCell::new(None);
    pub static TEST_FORCE_RECOMPUTE: RefCell<bool> = RefCell::new(false);
}

pub fn get_constraints_path() -> Option<PathBuf> {
    TEST_CONSTRAINTS_PATH.with(|p| p.borrow().clone())
}

pub fn set_constraints_path(path: PathBuf) {
    TEST_CONSTRAINTS_PATH.with(|p| *p.borrow_mut() = Some(path));
}

pub fn clear_constraints_path() {
    TEST_CONSTRAINTS_PATH.with(|p| *p.borrow_mut() = None);
}

pub fn should_force_recompute() -> bool {
    TEST_FORCE_RECOMPUTE.with(|f| *f.borrow())
}

pub fn set_force_recompute(value: bool) {
    TEST_FORCE_RECOMPUTE.with(|f| *f.borrow_mut() = value);
}

pub fn clear_force_recompute() {
    TEST_FORCE_RECOMPUTE.with(|f| *f.borrow_mut() = false);
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn test_thread_local_isolation() {
        let mut tmp = NamedTempFile::new().expect("temp file creation failed");
        tmp.write_all(b"test content").expect("write failed");

        set_constraints_path(tmp.path().to_path_buf());
        set_force_recompute(true);

        assert!(get_constraints_path().is_some());
        assert!(should_force_recompute());

        clear_constraints_path();
        clear_force_recompute();

        assert!(get_constraints_path().is_none());
        assert!(!should_force_recompute());
    }

    #[test]
    fn test_threads_dont_interfere() {
        use std::thread;

        let mut tmp = NamedTempFile::new().expect("temp file creation failed");
        tmp.write_all(b"thread test").expect("write failed");
        let path = tmp.path().to_path_buf();

        let handle = thread::spawn(move || {
            set_constraints_path(path.clone());
            set_force_recompute(true);

            thread::sleep(std::time::Duration::from_millis(10));

            assert!(get_constraints_path().is_some());
            assert!(should_force_recompute());

            clear_constraints_path();
            clear_force_recompute();
        });

        set_force_recompute(false);
        assert!(!should_force_recompute());

        handle.join().expect("thread panicked");

        assert!(!should_force_recompute());
    }
}
