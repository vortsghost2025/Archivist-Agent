#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    archivist_agent_lib::run();
}
