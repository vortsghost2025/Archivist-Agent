# Plan: Investigate Nvidia NIM API Discrepancy

## Problem
GLM 5.2 and DeepSeek work on user's other monitor but fail from this SSH session with:
- 410 Gone (default model `google/gemma-2-2b-it` is EOL)
- 400 "unsupported parameters Max tokens"
- 500 "Missing request extension" on chat/completions

## Root Cause Hypothesis
Something differs between the working environment (other monitor) and this SSH session:
- API key, base URL, or request format
- Network/proxy/firewall
- Rate limiting on this IP
- Model name format or parameter naming

## Investigation Steps

### 1. Compare API Configuration
- [ ] Check if other monitor uses different `NVIDIA_NIM_API_KEY` or `NVIDIA_NIM_BASE_URL`
- [ ] Check if other monitor uses different model name format (e.g., `nvidia/z-ai/glm-5.2` vs `z-ai/glm-5.2`)
- [ ] Check if other monitor uses different endpoint path

### 2. Test Request Format Variations
- [ ] Test `max_tokens` vs `maxTokens` parameter naming
- [ ] Test different model name formats
- [ ] Test Anthropic-compatible `/v1/messages` endpoint
- [ ] Test with/without `stream` parameter
- [ ] Test with explicit `Content-Type` and `Accept` headers

### 3. Network/Proxy Diagnostics
- [ ] Check for proxy configuration in this environment
- [ ] Test direct connectivity vs proxied
- [ ] Compare IP addresses between environments

### 4. API Key Permissions
- [ ] Verify API key has "Public API Endpoints" permission enabled (Nvidia requirement)
- [ ] Check if key is rate-limited on this IP

### 5. Working Request Capture
- [ ] Ask user for exact curl command that works on other monitor
- [ ] Replicate exactly from this environment

## Success Criteria
- Identify the specific difference causing failures
- Document working request format for this environment
- Update `.env` with correct configuration

## Deliverable
- Root cause identification
- Working configuration for `.env`
- Documentation of parameter/format requirements