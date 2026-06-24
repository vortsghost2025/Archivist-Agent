import type { SessionDatabase, SessionHandoff, CompactState, RestorePoint, SessionStats } from "./database.js";
export declare function buildSessionTools(db: SessionDatabase): ({
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            sessionId: {
                type: string;
                description: string;
            };
            agent: {
                type: string;
                description: string;
            };
            lane: {
                type: string;
                description: string;
            };
            generatedAt: {
                type: string;
                description: string;
            };
            compactReason: {
                type: string;
                description: string;
            };
            summary: {
                type: string;
                description: string;
            };
            keyDecisions: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            openTasks: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            handoffHash: {
                type: string;
                description: string;
            };
            metadata: {
                type: string;
                description: string;
            };
            limit?: undefined;
            query?: undefined;
            triggerType?: undefined;
            reason?: undefined;
            udsScore?: undefined;
            checkpointResults?: undefined;
            handoffId?: undefined;
            label?: undefined;
            description?: undefined;
            providedHash?: undefined;
        };
        required: string[];
        additionalProperties: boolean;
    };
    handler: (args: unknown) => Promise<{
        ok: boolean;
        handoff: SessionHandoff;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            sessionId: {
                type: string;
                description: string;
            };
            agent?: undefined;
            lane?: undefined;
            generatedAt?: undefined;
            compactReason?: undefined;
            summary?: undefined;
            keyDecisions?: undefined;
            openTasks?: undefined;
            handoffHash?: undefined;
            metadata?: undefined;
            limit?: undefined;
            query?: undefined;
            triggerType?: undefined;
            reason?: undefined;
            udsScore?: undefined;
            checkpointResults?: undefined;
            handoffId?: undefined;
            label?: undefined;
            description?: undefined;
            providedHash?: undefined;
        };
        required: string[];
        additionalProperties: boolean;
    };
    handler: (args: unknown) => Promise<{
        ok: boolean;
        handoff: SessionHandoff | null;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            sessionId: {
                type: string;
                description: string;
            };
            limit: {
                type: string;
                maximum: number;
                default: number;
            };
            agent?: undefined;
            lane?: undefined;
            generatedAt?: undefined;
            compactReason?: undefined;
            summary?: undefined;
            keyDecisions?: undefined;
            openTasks?: undefined;
            handoffHash?: undefined;
            metadata?: undefined;
            query?: undefined;
            triggerType?: undefined;
            reason?: undefined;
            udsScore?: undefined;
            checkpointResults?: undefined;
            handoffId?: undefined;
            label?: undefined;
            description?: undefined;
            providedHash?: undefined;
        };
        additionalProperties: boolean;
        required?: undefined;
    };
    handler: (args: unknown) => Promise<{
        ok: boolean;
        handoffs: SessionHandoff[];
    }>;
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            query: {
                type: string;
                description: string;
            };
            sessionId: {
                type: string;
                description: string;
            };
            limit: {
                type: string;
                maximum: number;
                default: number;
            };
            agent?: undefined;
            lane?: undefined;
            generatedAt?: undefined;
            compactReason?: undefined;
            summary?: undefined;
            keyDecisions?: undefined;
            openTasks?: undefined;
            handoffHash?: undefined;
            metadata?: undefined;
            triggerType?: undefined;
            reason?: undefined;
            udsScore?: undefined;
            checkpointResults?: undefined;
            handoffId?: undefined;
            label?: undefined;
            description?: undefined;
            providedHash?: undefined;
        };
        required: string[];
        additionalProperties: boolean;
    };
    handler: (args: unknown) => Promise<{
        ok: boolean;
        handoffs: SessionHandoff[];
    }>;
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            sessionId: {
                type: string;
                description: string;
            };
            triggerType: {
                type: string;
                enum: string[];
                description: string;
            };
            reason: {
                type: string;
                description: string;
            };
            udsScore: {
                type: string;
                minimum: number;
                maximum: number;
                description: string;
            };
            checkpointResults: {
                type: string;
                description: string;
            };
            handoffId: {
                type: string;
                description: string;
            };
            agent?: undefined;
            lane?: undefined;
            generatedAt?: undefined;
            compactReason?: undefined;
            summary?: undefined;
            keyDecisions?: undefined;
            openTasks?: undefined;
            handoffHash?: undefined;
            metadata?: undefined;
            limit?: undefined;
            query?: undefined;
            label?: undefined;
            description?: undefined;
            providedHash?: undefined;
        };
        required: string[];
        additionalProperties: boolean;
    };
    handler: (args: unknown) => Promise<{
        ok: boolean;
        compactState: CompactState;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            sessionId: {
                type: string;
                description: string;
            };
            limit: {
                type: string;
                maximum: number;
                default: number;
            };
            agent?: undefined;
            lane?: undefined;
            generatedAt?: undefined;
            compactReason?: undefined;
            summary?: undefined;
            keyDecisions?: undefined;
            openTasks?: undefined;
            handoffHash?: undefined;
            metadata?: undefined;
            query?: undefined;
            triggerType?: undefined;
            reason?: undefined;
            udsScore?: undefined;
            checkpointResults?: undefined;
            handoffId?: undefined;
            label?: undefined;
            description?: undefined;
            providedHash?: undefined;
        };
        additionalProperties: boolean;
        required?: undefined;
    };
    handler: (args: unknown) => Promise<{
        ok: boolean;
        compactStates: CompactState[];
    }>;
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            sessionId: {
                type: string;
                description: string;
            };
            label: {
                type: string;
                description: string;
            };
            handoffId: {
                type: string;
                description: string;
            };
            description: {
                type: string;
                description: string;
            };
            agent?: undefined;
            lane?: undefined;
            generatedAt?: undefined;
            compactReason?: undefined;
            summary?: undefined;
            keyDecisions?: undefined;
            openTasks?: undefined;
            handoffHash?: undefined;
            metadata?: undefined;
            limit?: undefined;
            query?: undefined;
            triggerType?: undefined;
            reason?: undefined;
            udsScore?: undefined;
            checkpointResults?: undefined;
            providedHash?: undefined;
        };
        required: string[];
        additionalProperties: boolean;
    };
    handler: (args: unknown) => Promise<{
        ok: boolean;
        restorePoint: RestorePoint;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            sessionId: {
                type: string;
                description: string;
            };
            limit: {
                type: string;
                maximum: number;
                default: number;
            };
            agent?: undefined;
            lane?: undefined;
            generatedAt?: undefined;
            compactReason?: undefined;
            summary?: undefined;
            keyDecisions?: undefined;
            openTasks?: undefined;
            handoffHash?: undefined;
            metadata?: undefined;
            query?: undefined;
            triggerType?: undefined;
            reason?: undefined;
            udsScore?: undefined;
            checkpointResults?: undefined;
            handoffId?: undefined;
            label?: undefined;
            description?: undefined;
            providedHash?: undefined;
        };
        additionalProperties: boolean;
        required?: undefined;
    };
    handler: (args: unknown) => Promise<{
        ok: boolean;
        restorePoints: RestorePoint[];
    }>;
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            sessionId: {
                type: string;
                description: string;
            };
            agent?: undefined;
            lane?: undefined;
            generatedAt?: undefined;
            compactReason?: undefined;
            summary?: undefined;
            keyDecisions?: undefined;
            openTasks?: undefined;
            handoffHash?: undefined;
            metadata?: undefined;
            limit?: undefined;
            query?: undefined;
            triggerType?: undefined;
            reason?: undefined;
            udsScore?: undefined;
            checkpointResults?: undefined;
            handoffId?: undefined;
            label?: undefined;
            description?: undefined;
            providedHash?: undefined;
        };
        additionalProperties: boolean;
        required?: undefined;
    };
    handler: (args: unknown) => Promise<{
        ok: boolean;
        stats: SessionStats;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            handoffId: {
                type: string;
                description: string;
            };
            providedHash: {
                type: string;
                description: string;
            };
            sessionId?: undefined;
            agent?: undefined;
            lane?: undefined;
            generatedAt?: undefined;
            compactReason?: undefined;
            summary?: undefined;
            keyDecisions?: undefined;
            openTasks?: undefined;
            handoffHash?: undefined;
            metadata?: undefined;
            limit?: undefined;
            query?: undefined;
            triggerType?: undefined;
            reason?: undefined;
            udsScore?: undefined;
            checkpointResults?: undefined;
            label?: undefined;
            description?: undefined;
        };
        required: string[];
        additionalProperties: boolean;
    };
    handler: (args: unknown) => Promise<{
        ok: boolean;
        error: string;
        matches?: undefined;
        storedHash?: undefined;
    } | {
        ok: boolean;
        matches: boolean;
        storedHash: string;
        error?: undefined;
    }>;
})[];
//# sourceMappingURL=tools.d.ts.map