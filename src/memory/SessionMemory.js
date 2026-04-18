/**
 * Session Memory - Simple persistent storage for agent sessions
 * 
 * Stores what happened in a session so it can be loaded next time.
 * Minimal, single-file approach that doesn't require a database.
 * 
 * Storage format:
 * {
 *   laneId: "swarmmind",
 *   sessions: [
 *     {
 *       id: "sess-2026-04-18-001",
 *       started: "2026-04-18T22:30:00Z",
 *       ended: "2026-04-18T23:45:00Z",
 *       summary: "Fixed identity persistence, added session memory",
 *       decisions: [...],
 *       files_changed: [...],
 *       next_steps: [...]
 *     }
 *   ],
 *   current_session: null,
 *   last_updated: "2026-04-18T23:45:00Z"
 * }
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class SessionMemory {
    constructor(options = {}) {
        this.laneId = process.env.LANE_NAME || 'unknown';
        this.memoryPath = options.memoryPath || this._getDefaultMemoryPath();
        this.maxSessions = options.maxSessions || 100;
        
        // Ensure directory exists
        const dir = path.dirname(this.memoryPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        // Load or create memory
        this.data = this._loadOrCreate();
        
        // Start new session if none active
        if (!this.data.current_session) {
            this.startSession();
        }
    }
    
    _getDefaultMemoryPath() {
        const laneRoots = {
            'archivist': 'S:/Archivist-Agent',
            'swarmmind': 'S:/SwarmMind Self-Optimizing Multi-Agent AI System',
            'library': 'S:/self-organizing-library'
        };
        const root = laneRoots[this.laneId] || process.cwd();
        return path.join(root, '.memory', 'sessions.json');
    }
    
    _loadOrCreate() {
        if (fs.existsSync(this.memoryPath)) {
            try {
                const raw = fs.readFileSync(this.memoryPath, 'utf8');
                return JSON.parse(raw);
            } catch (err) {
                // Corrupted, start fresh
            }
        }
        
        return {
            laneId: this.laneId,
            sessions: [],
            current_session: null,
            last_updated: null
        };
    }
    
    _save() {
        this.data.last_updated = new Date().toISOString();
        fs.writeFileSync(this.memoryPath, JSON.stringify(this.data, null, 2), 'utf8');
    }
    
    /**
     * Start a new session
     */
    startSession(context = {}) {
        const session = {
            id: `sess-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
            started: new Date().toISOString(),
            ended: null,
            summary: null,
            context: context,
            decisions: [],
            files_changed: [],
            next_steps: [],
            key_insights: []
        };
        
        this.data.current_session = session;
        this._save();
        
        return session;
    }
    
    /**
     * End current session with summary
     */
    endSession(summary, nextSteps = []) {
        if (!this.data.current_session) return null;
        
        this.data.current_session.ended = new Date().toISOString();
        this.data.current_session.summary = summary;
        this.data.current_session.next_steps = nextSteps;
        
        // Move to sessions list
        this.data.sessions.push(this.data.current_session);
        
        // Trim old sessions if needed
        while (this.data.sessions.length > this.maxSessions) {
            this.data.sessions.shift();
        }
        
        this.data.current_session = null;
        this._save();
        
        return this.data.sessions[this.data.sessions.length - 1];
    }
    
    /**
     * Record a decision made during session
     */
    recordDecision(decision, rationale) {
        if (!this.data.current_session) return;
        
        this.data.current_session.decisions.push({
            timestamp: new Date().toISOString(),
            decision: decision,
            rationale: rationale
        });
        
        this._save();
    }
    
    /**
     * Record a file changed
     */
    recordFileChange(filepath, change_type, description) {
        if (!this.data.current_session) return;
        
        this.data.current_session.files_changed.push({
            timestamp: new Date().toISOString(),
            path: filepath,
            change_type: change_type, // 'created', 'modified', 'deleted'
            description: description
        });
        
        this._save();
    }
    
    /**
     * Record a key insight learned
     */
    recordInsight(insight) {
        if (!this.data.current_session) return;
        
        this.data.current_session.key_insights.push({
            timestamp: new Date().toISOString(),
            insight: insight
        });
        
        this._save();
    }
    
    /**
     * Get recent sessions for context
     */
    getRecentSessions(count = 5) {
        return this.data.sessions.slice(-count);
    }
    
    /**
     * Get last session summary
     */
    getLastSession() {
        if (this.data.sessions.length === 0) return null;
        return this.data.sessions[this.data.sessions.length - 1];
    }
    
    /**
     * Get current session info
     */
    getCurrentSession() {
        return this.data.current_session;
    }
    
    /**
     * Generate context for new session
     * Returns a summary of recent work for loading into context
     */
    generateContext() {
        const lastSession = this.getLastSession();
        const recentSessions = this.getRecentSessions(3);
        
        let context = `## Session Memory: ${this.laneId}\n\n`;
        
        if (lastSession) {
            context += `### Last Session (${lastSession.started})\n`;
            context += `**Summary:** ${lastSession.summary || 'No summary'}\n`;
            
            if (lastSession.next_steps && lastSession.next_steps.length > 0) {
                context += `**Next Steps:**\n`;
                lastSession.next_steps.forEach((step, i) => {
                    context += `${i + 1}. ${step}\n`;
                });
            }
            
            if (lastSession.key_insights && lastSession.key_insights.length > 0) {
                context += `**Key Insights:**\n`;
                lastSession.key_insights.forEach(insight => {
                    context += `- ${insight.insight}\n`;
                });
            }
        }
        
        if (recentSessions.length > 1) {
            context += `\n### Recent Activity (${recentSessions.length} sessions)\n`;
            recentSessions.slice(0, -1).reverse().forEach(sess => {
                context += `- ${sess.started.split('T')[0]}: ${sess.summary || 'No summary'}\n`;
            });
        }
        
        return context;
    }
    
    /**
     * Get memory stats
     */
    getStats() {
        return {
            laneId: this.laneId,
            total_sessions: this.data.sessions.length,
            has_active_session: !!this.data.current_session,
            last_updated: this.data.last_updated,
            memory_path: this.memoryPath
        };
    }
}

// Singleton
let sessionMemory = null;

function getSessionMemory(options = {}) {
    if (!sessionMemory) {
        sessionMemory = new SessionMemory(options);
    }
    return sessionMemory;
}

module.exports = {
    SessionMemory,
    getSessionMemory
};
