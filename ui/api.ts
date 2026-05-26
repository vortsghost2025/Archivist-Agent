import { invoke } from '@tauri-apps/api/tauri';

export interface DirEntryInfo {
  name: string;
  path: string;
  is_dir: boolean;
  size_bytes: number;
  extension: string | null;
}

export interface FileChunk {
  content: string;
  offset: number;
  limit: number;
  total_lines: number;
}

/** List directory contents (read‑only) */
export const listDirectory = async (path: string): Promise<DirEntryInfo[]> => {
  return await invoke('agent_list_directory', { path });
};

/** Read a file with optional pagination */
export const readFileChunk = async (
  path: string,
  offset = 1,
  limit = 200
): Promise<FileChunk> => {
  return await invoke('agent_read_file', { path, offset, limit });
};

/** Search for files matching a query under a directory */
export const searchFiles = async (path: string, query: string) => {
  return await invoke('agent_search_files', { path, query });
};

/** Simple health check – ping */
export const ping = async (): Promise<string> => {
  return await invoke('ping');
};

/** Get CPS score – returns a number */
export const getCpsScore = async (): Promise<number> => {
  return await invoke('get_cps_score');
};
