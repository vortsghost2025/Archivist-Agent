#!/usr/bin/env node
'use strict';
/**
 * LANE REGISTRY VALIDATION
 *
 * Pure validation functions for lane-registry.json structure and content.
 * No I/O, no SSH, no Git, no file writes, no service operations.
 *
 * EXPORTS:
 *   validateRegistry(data)  → { errors: [], warnings: [], observations: [] }
 *   VALID_LANE_STATES       → string[]
 *   REQUIRED_LANE_FIELDS    → string[]
 *   REQUIRED_MAILBOXES      → string[]
 *   CANONICAL_LANE_IDS      → string[]
 */

const VALID_LANE_STATES = ['ACTIVE', 'INTEGRATED', 'ARCHIVED', 'FROZEN', 'CONCEPTUAL'];
const REQUIRED_LANE_FIELDS = ['lane_id', 'role', 'lane_state', 'local_path', 'repo', 'branch', 'mailboxes'];
const REQUIRED_MAILBOXES = ['inbox', 'outbox'];
const CANONICAL_LANE_IDS = [
  'archivist', 'authority', 'kernel', 'swarmmind',
  'library', 'control-plane', 'kucoin', 'solana-launch'
];

/**
 * Validate a parsed lane registry object.
 * @param {object} data - Parsed registry JSON
 * @returns {{ errors: object[], warnings: object[], observations: object[] }}
 */
function validateRegistry(data) {
  const errors = [];
  const warnings = [];
  const observations = [];

  if (!data || typeof data !== 'object') {
    errors.push({ code: 'MALFORMED_REGISTRY', severity: 'error', message: 'Registry data is not an object' });
    return { errors, warnings, observations };
  }

  validateStructure(data, errors);
  if (!data.lanes || typeof data.lanes !== 'object') {
    return { errors, warnings, observations };
  }

  const laneIds = Object.keys(data.lanes);
  validateNoDuplicateLaneIds(data, laneIds, errors);

  for (const laneId of laneIds) {
    const lane = data.lanes[laneId];
    if (!lane || typeof lane !== 'object') continue;

    validateRequiredFields(laneId, lane, errors);
    validateLaneState(laneId, lane, errors);
    validateMailboxStructure(laneId, lane, errors);
    validatePathSegment(laneId, lane, warnings, observations);
    warnUnderscoreHyphenMismatch(laneId, lane, warnings);
    warnArchivedMissingTransition(laneId, lane, warnings);
    observeRuntimeAdapter(laneId, lane, observations);
  }

  observeOptionalLanes(laneIds, observations);
  observePlatformRoot(data, observations);

  return { errors, warnings, observations };
}

/** ── Structure ─────────────────────────────────────────────── */

function validateStructure(data, errors) {
  if (!data.schema_version) {
    errors.push({ code: 'MISSING_SCHEMA', severity: 'error', message: 'Missing schema_version', evidence: 'root.schema_version' });
  }
  if (!data.registry_id) {
    errors.push({ code: 'MISSING_REGISTRY_ID', severity: 'error', message: 'Missing registry_id', evidence: 'root.registry_id' });
  }
  if (!data.timestamp) {
    errors.push({ code: 'MISSING_TIMESTAMP', severity: 'error', message: 'Missing timestamp', evidence: 'root.timestamp' });
  }
  if (!data.broadcast) {
    errors.push({ code: 'MISSING_BROADCAST', severity: 'error', message: 'Missing broadcast section', evidence: 'root.broadcast' });
  }
  if (!data.cross_lane_protocol) {
    errors.push({ code: 'MISSING_PROTOCOL', severity: 'error', message: 'Missing cross_lane_protocol section', evidence: 'root.cross_lane_protocol' });
  }
  if (!data.agent_instructions) {
    errors.push({ code: 'MISSING_INSTRUCTIONS', severity: 'error', message: 'Missing agent_instructions section', evidence: 'root.agent_instructions' });
  }
  if (!data.lanes || typeof data.lanes !== 'object') {
    errors.push({ code: 'MISSING_LANES', severity: 'error', message: 'Missing or invalid lanes section', evidence: 'root.lanes' });
    return;
  }
  if (Object.keys(data.lanes).length === 0) {
    errors.push({ code: 'EMPTY_LANES', severity: 'error', message: 'Lanes section is empty', evidence: 'root.lanes' });
  }
}

/** ── Duplicate IDs ────────────────────────────────────────── */

function validateNoDuplicateLaneIds(data, laneIds, errors) {
  const seen = {};
  for (const laneId of laneIds) {
    const lane = data.lanes[laneId];
    if (lane && lane.lane_id) {
      if (seen[lane.lane_id]) {
        errors.push({
          code: 'DUPLICATE_LANE_ID',
          severity: 'error',
          lane: laneId,
          message: 'Duplicate canonical lane_id "' + lane.lane_id + '" — also used by "' + seen[lane.lane_id] + '"',
          evidence: 'lanes["' + laneId + '"].lane_id'
        });
      }
      seen[lane.lane_id] = laneId;
    }
  }
}

/** ── Required fields ──────────────────────────────────────── */

function validateRequiredFields(laneId, lane, errors) {
  for (let i = 0; i < REQUIRED_LANE_FIELDS.length; i++) {
    const field = REQUIRED_LANE_FIELDS[i];
    if (lane[field] === undefined || lane[field] === null) {
      errors.push({
        code: 'MISSING_FIELD',
        severity: 'error',
        lane: laneId,
        message: 'Missing required field "' + field + '"',
        evidence: 'lanes["' + laneId + '"].' + field
      });
    }
  }

  if (lane.lane_state === 'ACTIVE') {
    if (!lane.repo) {
      errors.push({
        code: 'ACTIVE_NO_REPO',
        severity: 'error',
        lane: laneId,
        message: 'Active repository-backed lane is missing repo',
        evidence: 'lanes["' + laneId + '"].repo'
      });
    }
    if (!lane.branch) {
      errors.push({
        code: 'ACTIVE_NO_BRANCH',
        severity: 'error',
        lane: laneId,
        message: 'Active repository-backed lane is missing branch',
        evidence: 'lanes["' + laneId + '"].branch'
      });
    }
    if (!lane.local_path) {
      errors.push({
        code: 'ACTIVE_NO_PATH',
        severity: 'error',
        lane: laneId,
        message: 'Active repository-backed lane is missing local_path',
        evidence: 'lanes["' + laneId + '"].local_path'
      });
    }
  }
}

/** ── Lane state ───────────────────────────────────────────── */

function validateLaneState(laneId, lane, errors) {
  if (lane.lane_state && !VALID_LANE_STATES.includes(lane.lane_state)) {
    errors.push({
      code: 'INVALID_LANE_STATE',
      severity: 'error',
      lane: laneId,
      message: 'Invalid lane_state "' + lane.lane_state + '" — must be one of ' + VALID_LANE_STATES.join(', '),
      evidence: 'lanes["' + laneId + '"].lane_state'
    });
  }
}

/** ── Mailboxes ────────────────────────────────────────────── */

function validateMailboxStructure(laneId, lane, errors) {
  if (!lane.mailboxes || typeof lane.mailboxes !== 'object') {
    if (lane.lane_state !== 'CONCEPTUAL') {
      errors.push({
        code: 'MISSING_MAILBOXES',
        severity: 'error',
        lane: laneId,
        message: 'Missing mailboxes section',
        evidence: 'lanes["' + laneId + '"].mailboxes'
      });
    }
    return;
  }
  for (let i = 0; i < REQUIRED_MAILBOXES.length; i++) {
    const mb = REQUIRED_MAILBOXES[i];
    if (!lane.mailboxes[mb]) {
      errors.push({
        code: 'MISSING_MAILBOX',
        severity: 'error',
        lane: laneId,
        message: 'Missing required mailbox "' + mb + '"',
        evidence: 'lanes["' + laneId + '"].mailboxes.' + mb
      });
    }
  }
}

/** ── Path segment ─────────────────────────────────────────── */

function validatePathSegment(laneId, lane, warnings, observations) {
  if (!lane.mailboxes || !lane.mailboxes.inbox) return;

  const inbox = lane.mailboxes.inbox;

  if (laneId === 'kernel') {
    if (inbox.indexOf('/lanes/kernel-lane/') !== -1) {
      warnings.push({
        code: 'WRONG_PATH_SEGMENT',
        severity: 'warning',
        lane: laneId,
        message: 'Kernel inbox path uses kernel-lane as lane identifier; correct lane identifier is kernel',
        evidence: inbox
      });
    }
    if (inbox.indexOf('/kernel-lane/lanes/kernel/') === -1 && inbox.indexOf('/kernel/lanes/kernel/') === -1) {
      observations.push({
        code: 'UNEXPECTED_KERNEL_PATH',
        severity: 'observation',
        lane: laneId,
        message: 'Kernel inbox path does not follow expected kernel-lane/lanes/kernel/ pattern',
        evidence: inbox
      });
    }
    return;
  }

  if (laneId !== 'kucoin') {
    const lanesIdx = inbox.indexOf('lanes');
    if (lanesIdx >= 0) {
      const afterLanes = inbox.slice(lanesIdx + 6); // skip 'lanes/'
      const slashIdx = afterLanes.indexOf('/');
      if (slashIdx > 0) {
        const segmentLaneId = afterLanes.slice(0, slashIdx);
        const normalizedId = laneId === 'control_plane' ? 'control-plane' : laneId;
        if (segmentLaneId !== normalizedId) {
          warnings.push({
            code: 'LANE_ID_PATH_MISMATCH',
            severity: 'warning',
            lane: laneId,
            message: 'Mailbox path lane segment "' + segmentLaneId + '" differs from canonical identifier "' + normalizedId + '"',
            evidence: inbox
          });
        }
      }
    }
  }
}

/** ── Underscore vs hyphen ─────────────────────────────────── */

function warnUnderscoreHyphenMismatch(laneId, lane, warnings) {
  if (laneId === 'control_plane' && lane.mailboxes) {
    const paths = [lane.mailboxes.inbox, lane.mailboxes.outbox].filter(Boolean);
    let hasHyphenPath = false;
    for (let i = 0; i < paths.length; i++) {
      if (paths[i].indexOf('/control-plane/') !== -1) {
        hasHyphenPath = true;
        break;
      }
    }
    if (hasHyphenPath) {
      warnings.push({
        code: 'UNDERSCORE_HYPHEN_MISMATCH',
        severity: 'warning',
        lane: 'control_plane',
        message: 'Lane key uses underscore (control_plane) but mailbox paths use hyphen (control-plane)',
        evidence: 'registry key: control_plane, paths: .../control-plane/...'
      });
    }
  }
}

/** ── ARCHIVED metadata ────────────────────────────────────── */

function warnArchivedMissingTransition(laneId, lane, warnings) {
  if (lane.lane_state === 'ARCHIVED') {
    const hasNotes = lane.notes && lane.notes.length > 0;
    if (!hasNotes) {
      warnings.push({
        code: 'ARCHIVED_NO_TRANSITION',
        severity: 'warning',
        lane: laneId,
        message: 'ARCHIVED lane has no notes or transition metadata',
        evidence: 'lanes["' + laneId + '"].notes'
      });
    }
  }
}

/** ── Runtime adapter ──────────────────────────────────────── */

function observeRuntimeAdapter(laneId, lane, observations) {
  if (laneId === 'kucoin' && lane.mailboxes && lane.mailboxes.inbox) {
    const inbox = lane.mailboxes.inbox;
    const repoPart = lane.repo ? lane.repo.split('/').pop() : '';
    if (inbox.indexOf('/Archivist-Agent/') !== -1 &&
        (repoPart === 'kucoin-lane' || (lane.local_path && lane.local_path.indexOf('kucoin-lane') !== -1))) {
      observations.push({
        code: 'RUNTIME_ADAPTER_DIFFERENCE',
        severity: 'observation',
        lane: laneId,
        message: 'Mailbox routed through Archivist-Agent rather than co-located in kucoin-lane repository',
        evidence: 'repo: ' + (lane.repo || 'unknown') + ', inbox: ' + inbox
      });
    }
  }
}

/** ── Optional lanes ───────────────────────────────────────── */

function observeOptionalLanes(laneIds, observations) {
  if (laneIds.indexOf('broadcast') === -1) {
    observations.push({
      code: 'OPTIONAL_LANE_ABSENT',
      severity: 'observation',
      message: 'Optional lane "broadcast" is not present in registry lanes section',
      evidence: 'registered lanes: [' + laneIds.join(', ') + ']'
    });
  }
}

/** ── Platform root ────────────────────────────────────────── */

function observePlatformRoot(data, observations) {
  if (!data.lanes) return;
  const keys = Object.keys(data.lanes);
  for (let i = 0; i < keys.length; i++) {
    const lane = data.lanes[keys[i]];
    if (lane.local_path && lane.local_path.indexOf('S:/') === 0) {
      observations.push({
        code: 'PLATFORM_SPECIFIC_ROOT',
        severity: 'observation',
        lane: keys[i],
        message: 'Local path uses Windows root (S:/)',
        evidence: lane.local_path
      });
      break;
    }
  }
}

module.exports = {
  validateRegistry,
  VALID_LANE_STATES,
  REQUIRED_LANE_FIELDS,
  REQUIRED_MAILBOXES,
  CANONICAL_LANE_IDS
};