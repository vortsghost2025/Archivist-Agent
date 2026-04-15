/**
 * Agent Role Permissions Configuration
 * 
 * Location: S:/Archivist-Agent/src/bridge/agent-permissions.js
 * Purpose: Define tool permissions by agent role for security boundaries
 * 
 * Principles:
 * - Code agents can edit but ask before bash
 * - Plan agents are read-only
 * - Debug agents have limited command permission
 * - Reviewer subagents are read-only
 */

// Permission levels
const PERMISSION = {
  ALLOW: 'allow',
  ASK: 'ask',
  DENY: 'deny'
};

// Agent role permission definitions
const AGENT_PERMISSIONS = {
  // Code agent: can edit files, but bash requires approval
  code: {
    name: 'Code Agent',
    description: 'Primary implementation agent with file editing',
    permissions: {
      read: { '*': PERMISSION.ALLOW },
      write: { 
        'S:/Archivist-Agent': PERMISSION.ALLOW,
        'S:/.global': PERMISSION.ASK
      },
      edit: { 
        'S:/Archivist-Agent': PERMISSION.ALLOW,
        'S:/.global': PERMISSION.ASK
      },
      bash: { 
        'git': PERMISSION.ALLOW,
        'cargo': PERMISSION.ALLOW,
        'npm': PERMISSION.ALLOW,
        'node': PERMISSION.ALLOW,
        '*': PERMISSION.ASK  // All other commands need approval
      },
      glob: { '*': PERMISSION.ALLOW },
      grep: { '*': PERMISSION.ALLOW },
      web: { '*': PERMISSION.ALLOW },
      task: { '*': PERMISSION.ALLOW }
    }
  },
  
  // Build agent: same as code
  build: {
    name: 'Build Agent',
    description: 'Build and compilation agent',
    permissions: {
      read: { '*': PERMISSION.ALLOW },
      write: { 
        'S:/Archivist-Agent': PERMISSION.ALLOW,
        'S:/.global': PERMISSION.ASK
      },
      edit: { 
        'S:/Archivist-Agent': PERMISSION.ALLOW,
        'S:/.global': PERMISSION.ASK
      },
      bash: { 
        'cargo': PERMISSION.ALLOW,
        'npm': PERMISSION.ALLOW,
        'node': PERMISSION.ALLOW,
        '*': PERMISSION.ASK
      },
      glob: { '*': PERMISSION.ALLOW },
      grep: { '*': PERMISSION.ALLOW },
      web: { '*': PERMISSION.ALLOW },
      task: { '*': PERMISSION.ALLOW }
    }
  },
  
  // Plan agent: read-only, no file editing
  plan: {
    name: 'Plan Agent',
    description: 'Architecture and planning agent - read only',
    permissions: {
      read: { '*': PERMISSION.ALLOW },
      write: { '*': PERMISSION.DENY },
      edit: { '*': PERMISSION.DENY },
      bash: { 
        'git': PERMISSION.ALLOW,  // Allow git status, diff
        '*': PERMISSION.DENY
      },
      glob: { '*': PERMISSION.ALLOW },
      grep: { '*': PERMISSION.ALLOW },
      web: { '*': PERMISSION.ALLOW },
      task: { '*': PERMISSION.ALLOW }
    }
  },
  
  // Debug agent: read + limited commands
  debug: {
    name: 'Debug Agent',
    description: 'Diagnosis and repair agent',
    permissions: {
      read: { '*': PERMISSION.ALLOW },
      write: { 
        'S:/Archivist-Agent': PERMISSION.ALLOW,
        'S:/.global': PERMISSION.DENY
      },
      edit: { 
        'S:/Archivist-Agent': PERMISSION.ALLOW,
        'S:/.global': PERMISSION.DENY
      },
      bash: { 
        'cargo': PERMISSION.ALLOW,
        'npm': PERMISSION.ALLOW,
        'git': PERMISSION.ALLOW,
        '*': PERMISSION.ASK
      },
      glob: { '*': PERMISSION.ALLOW },
      grep: { '*': PERMISSION.ALLOW },
      web: { '*': PERMISSION.ALLOW },
      task: { '*': PERMISSION.ALLOW }
    }
  },
  
  // Ask agent: read-only, no modifications
  ask: {
    name: 'Ask Agent',
    description: 'Question answering agent - read only',
    permissions: {
      read: { '*': PERMISSION.ALLOW },
      write: { '*': PERMISSION.DENY },
      edit: { '*': PERMISSION.DENY },
      bash: { '*': PERMISSION.DENY },
      glob: { '*': PERMISSION.ALLOW },
      grep: { '*': PERMISSION.ALLOW },
      web: { '*': PERMISSION.ALLOW },
      task: { '*': PERMISSION.DENY }
    }
  },
  
  // General agent: similar to ask
  general: {
    name: 'General Agent',
    description: 'General purpose agent',
    permissions: {
      read: { '*': PERMISSION.ALLOW },
      write: { '*': PERMISSION.DENY },
      edit: { '*': PERMISSION.DENY },
      bash: { '*': PERMISSION.DENY },
      glob: { '*': PERMISSION.ALLOW },
      grep: { '*': PERMISSION.ALLOW },
      web: { '*': PERMISSION.ALLOW },
      task: { '*': PERMISSION.ALLOW }
    }
  },
  
  // Orchestrator: can delegate but limited direct action
  orchestrator: {
    name: 'Orchestrator Agent',
    description: 'Coordination agent - delegates to specialists',
    permissions: {
      read: { '*': PERMISSION.ALLOW },
      write: { '*': PERMISSION.DENY },
      edit: { '*': PERMISSION.DENY },
      bash: { '*': PERMISSION.DENY },
      glob: { '*': PERMISSION.ALLOW },
      grep: { '*': PERMISSION.ALLOW },
      web: { '*': PERMISSION.ALLOW },
      task: { '*': PERMISSION.ALLOW }  // Primary tool for orchestrator
    }
  },
  
  // Reviewer subagent: strict read-only
  reviewer: {
    name: 'Reviewer Subagent',
    description: 'Code review subagent - strict read-only',
    permissions: {
      read: { '*': PERMISSION.ALLOW },
      write: { '*': PERMISSION.DENY },
      edit: { '*': PERMISSION.DENY },
      bash: { '*': PERMISSION.DENY },
      glob: { '*': PERMISSION.ALLOW },
      grep: { '*': PERMISSION.ALLOW },
      web: { '*': PERMISSION.ALLOW },
      task: { '*': PERMISSION.DENY }
    }
  },
  
  // Architect subagent: read + governance access
  architect: {
    name: 'Architect Subagent',
    description: 'Architecture design subagent',
    permissions: {
      read: { '*': PERMISSION.ALLOW },
      write: { 
        'S:/Archivist-Agent': PERMISSION.ASK,
        'S:/.global': PERMISSION.ASK
      },
      edit: { '*': PERMISSION.DENY },
      bash: { '*': PERMISSION.DENY },
      glob: { '*': PERMISSION.ALLOW },
      grep: { '*': PERMISSION.ALLOW },
      web: { '*': PERMISSION.ALLOW },
      task: { '*': PERMISSION.ALLOW }
    }
  }
};

/**
 * Check if an action is permitted for an agent
 * @param {string} agent - Agent name
 * @param {string} tool - Tool name (read, write, edit, bash, etc.)
 * @param {string} resource - Resource being accessed
 * @returns {string} Permission level (allow, ask, deny)
 */
function checkPermission(agent, tool, resource) {
  const agentPerms = AGENT_PERMISSIONS[agent] || AGENT_PERMISSIONS.general;
  const toolPerms = agentPerms.permissions[tool];
  
  if (!toolPerms) {
    return PERMISSION.DENY;
  }
  
  // Check for exact match first
  if (toolPerms[resource]) {
    return toolPerms[resource];
  }
  
  // Check for wildcard
  if (toolPerms['*']) {
    return toolPerms['*'];
  }
  
  return PERMISSION.DENY;
}

/**
 * Get all permissions for an agent
 * @param {string} agent - Agent name
 * @returns {Object} Agent permissions
 */
function getAgentPermissions(agent) {
  return AGENT_PERMISSIONS[agent] || AGENT_PERMISSIONS.general;
}

/**
 * Validate permission configuration
 * @param {string} agent - Agent name
 * @param {Object} action - Action to validate
 * @returns {Object} Validation result
 */
function validatePermission(agent, action) {
  const permission = checkPermission(agent, action.tool, action.resource);
  
  return {
    agent,
    tool: action.tool,
    resource: action.resource,
    permission,
    allowed: permission === PERMISSION.ALLOW,
    needsApproval: permission === PERMISSION.ASK,
    denied: permission === PERMISSION.DENY
  };
}

export {
  PERMISSION,
  AGENT_PERMISSIONS,
  checkPermission,
  getAgentPermissions,
  validatePermission
};
