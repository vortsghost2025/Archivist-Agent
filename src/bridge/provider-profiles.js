/**
 * Provider Profiles with Virtual Quota Fallback
 * 
 * Location: S:/Archivist-Agent/src/bridge/provider-profiles.js
 * Purpose: Define provider profiles and fallback chains for resilient routing
 * 
 * FIX: Better error handling, consistent return types
 */

// Provider profile definitions
const PROVIDER_PROFILES = {
  'local-fast': {
    name: 'Local Fast',
    provider: 'ollama',
    models: ['qwen2.5-coder:7b', 'deepseek-coder:6.7b'],
    baseURL: 'http://localhost:11434',
    priority: 1,
    limits: {
      requestsPerMinute: 1000,
      tokensPerRequest: 32768
    },
    features: {
      toolCall: true,
      streaming: true,
      lowLatency: true
    }
  },
  
  'cloud-reasoning': {
    name: 'Cloud Reasoning',
    provider: 'z-ai',
    models: ['glm5'],
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    priority: 2,
    limits: {
      requestsPerMinute: 60,
      tokensPerRequest: 128000
    },
    features: {
      toolCall: true,
      streaming: true,
      lowLatency: false
    }
  },
  
  'cloud-cheap': {
    name: 'Cloud Cheap',
    provider: 'openrouter',
    models: ['openrouter/auto'],
    baseURL: 'https://openrouter.ai/api/v1',
    priority: 3,
    limits: {
      requestsPerMinute: 200,
      tokensPerRequest: 32000
    },
    features: {
      toolCall: true,
      streaming: true,
      lowLatency: false
    }
  }
};

// Fallback chains by use case
const FALLBACK_CHAINS = {
  'coding-heavy': {
    name: 'Coding Heavy (Local Only)',
    profiles: ['local-fast'],
    fallback: false,
    reason: 'Coding iterations should stay local for cost control'
  },
  
  'architecture': {
    name: 'Architecture Decisions',
    profiles: ['local-fast', 'cloud-reasoning'],
    fallback: true,
    fallbackCondition: 'onError',
    maxRetries: 1
  },
  
  'debugging': {
    name: 'Debugging (Local Only)',
    profiles: ['local-fast'],
    fallback: false,
    reason: 'Debugging is high-frequency, must stay local'
  },
  
  'general-ask': {
    name: 'General Questions',
    profiles: ['local-fast', 'cloud-cheap'],
    fallback: true,
    fallbackCondition: 'onError',
    maxRetries: 2
  },
  
  'review': {
    name: 'Code Review (Cloud)',
    profiles: ['cloud-reasoning', 'local-fast'],
    fallback: true,
    fallbackCondition: 'onQuotaExceeded',
    maxRetries: 1
  }
};

// Agent to fallback chain mapping
const AGENT_FALLBACK_MAP = {
  'code': 'coding-heavy',
  'build': 'coding-heavy',
  'plan': 'architecture',
  'debug': 'debugging',
  'ask': 'general-ask',
  'general': 'general-ask',
  'orchestrator': 'architecture' // DEPRECATED - for backwards compatibility
};

/**
 * Get fallback chain for an agent
 * @param {string} agent - Agent name
 * @returns {Object} Fallback chain configuration
 */
function getFallbackChain(agent) {
  const chainName = AGENT_FALLBACK_MAP[agent] || 'general-ask';
  return {
    agent,
    chain: FALLBACK_CHAINS[chainName],
    profiles: FALLBACK_CHAINS[chainName].profiles.map(p => PROVIDER_PROFILES[p])
  };
}

/**
 * Get provider profile by name
 * @param {string} profileName - Profile name
 * @returns {Object|null} Provider profile or null if not found
 */
function getProfile(profileName) {
  return PROVIDER_PROFILES[profileName] || null;
}

/**
 * Determine if fallback should occur
 * FIX: Handle both string and Error objects
 * @param {Object} params - Error/quota parameters
 * @returns {boolean} Whether to fallback
 */
function shouldFallback(params) {
  const { error, quotaExceeded, retryCount, maxRetries } = params;
  
  if (retryCount >= maxRetries) {
    return false;
  }
  
  if (quotaExceeded) {
    return true;
  }
  
  // FIX: Normalize error to string
  const errorMsg = typeof error === 'string' ? error : error?.message || '';
  
  const fallbackErrors = [
    'rate_limit_exceeded',
    'model_overloaded',
    'timeout',
    '429'
  ];
  
  if (errorMsg && fallbackErrors.some(e => errorMsg.includes(e))) {
    return true;
  }
  
  return false;
}

/**
 * Get next profile name in fallback chain
 * FIX: Return profile NAME, not object (caller uses getProfile)
 * @param {string} currentProfile - Current profile name
 * @param {string} chainName - Fallback chain name
 * @returns {string|null} Next profile name or null if end of chain
 */
function getNextProfileName(currentProfile, chainName) {
  const chain = FALLBACK_CHAINS[chainName];
  if (!chain || !chain.fallback) {
    return null;
  }
  
  const currentIndex = chain.profiles.indexOf(currentProfile);
  if (currentIndex === -1 || currentIndex >= chain.profiles.length - 1) {
    return null;
  }
  
  return chain.profiles[currentIndex + 1];
}

/**
 * Get next profile object in fallback chain
 * @param {string} currentProfile - Current profile name
 * @param {string} chainName - Fallback chain name
 * @returns {Object|null} Next profile object or null
 */
function getNextProfile(currentProfile, chainName) {
  const nextName = getNextProfileName(currentProfile, chainName);
  return nextName ? getProfile(nextName) : null;
}

/**
 * Log fallback event
 * @param {Object} event - Fallback event details
 */
function logFallbackEvent(event) {
  console.log(`[FALLBACK] ${event.from} → ${event.to} | Reason: ${event.reason} | Agent: ${event.agent}`);
}

module.exports = {
  PROVIDER_PROFILES,
  FALLBACK_CHAINS,
  AGENT_FALLBACK_MAP,
  getFallbackChain,
  getProfile,
  shouldFallback,
  getNextProfile,
  getNextProfileName,
  logFallbackEvent
};
