export interface SessionHandoff {
    id: string;
    sessionId: string;
    agent: string;
    lane: string;
    generatedAt: string;
    compactReason: string;
    summary: string;
    keyDecisions: string[];
    openTasks: string[];
    handoffHash: string;
    metadata: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}
export interface CompactState {
    id: string;
    sessionId: string;
    triggerType: "auto" | "manual" | "recovery";
    reason: string;
    udsScore: number;
    checkpointResults: Record<string, boolean>;
    handoffId: string;
    createdAt: string;
}
export interface RestorePoint {
    id: string;
    sessionId: string;
    label: string;
    handoffId: string;
    description: string;
    createdAt: string;
}
export interface SessionStats {
    totalHandoffs: number;
    totalCompacts: number;
    totalRestorePoints: number;
    tags: string[];
}
export interface SessionDatabase {
    addHandoff(handoff: Omit<SessionHandoff, "createdAt" | "updatedAt" | "id">): SessionHandoff;
    getHandoff(id: string): SessionHandoff | null;
    getLatestHandoff(sessionId: string): SessionHandoff | null;
    listHandoffs(sessionId?: string, limit?: number): SessionHandoff[];
    addCompactState(state: Omit<CompactState, "createdAt" | "id">): CompactState;
    getCompactState(id: string): CompactState | null;
    listCompactStates(sessionId?: string, limit?: number): CompactState[];
    addRestorePoint(point: Omit<RestorePoint, "createdAt" | "id">): RestorePoint;
    getRestorePoint(id: string): RestorePoint | null;
    listRestorePoints(sessionId?: string, limit?: number): RestorePoint[];
    getStats(sessionId?: string): SessionStats;
    searchHandoffs(query: string, sessionId?: string, limit?: number): SessionHandoff[];
    deleteHandoff(id: string): boolean;
    deleteCompactState(id: string): boolean;
    deleteRestorePoint(id: string): boolean;
}
export declare function openSessionDb(dbPath: string): Promise<SessionDatabase>;
//# sourceMappingURL=database.d.ts.map