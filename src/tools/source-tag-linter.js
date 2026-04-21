/**
 * Source-Tag Linter
 *
 * Validates that execution claims are properly attributed with source tags.
 * Prevents contamination between verified observations and unverified claims.
 */

const SOURCE_TAGS = ['VERIFIED_NOW', 'CLAIMED_IN_TRANSCRIPT', 'INFERRED', 'UNKNOWN', 'CAPABILITY_NOW'];

const FIRST_PERSON_EXECUTION_PATTERNS = [
  /\bI\s+(fixed|edited|read|wrote|created|deleted|moved|renamed|modified|updated|added|removed|changed|checked|verified|tested|ran|executed|handled|resolved|implemented|built|deployed|configured|set up|installed)\b/i,
  /\bI've\s+(fixed|edited|read|wrote|created|deleted|moved|renamed|modified|updated|added|removed|changed|checked|verified|tested|run|executed|handled|resolved|implemented|built|deployed|configured|set up|installed)\b/i,
  /\bI'm\s+(fixing|editing|reading|writing|creating|deleting|moving|renaming|modifying|updating|adding|removing|changing|checking|verifying|testing|running|executing|handling|resolving|implementing|building|deploying|configuring|setting up|installing)\b/i
];

const NON_EXECUTION_PATTERNS = [
  /\bI\s+(think|believe|suspect|guess|assume|suppose|wonder|feel|hope|expect)\b/i
];

function hasFirstPersonExecutionClaim(text) {
  const hasExecution = FIRST_PERSON_EXECUTION_PATTERNS.some(pattern => pattern.test(text));
  const hasNonExecution = NON_EXECUTION_PATTERNS.some(pattern => pattern.test(text));
  return hasExecution && !hasNonExecution;
}

function hasSourceTag(text) {
  return SOURCE_TAGS.some(tag => text.includes(tag + ':') || text.includes(tag + ' '));
}

function hasMixedSources(text) {
  let count = 0;
  for (const tag of SOURCE_TAGS) {
    if (text.includes(tag)) {
      count++;
    }
  }
  return count > 1;
}

function lintForContamination(text) {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const issues = [];

  sentences.forEach((sentence, index) => {
    // Check 1: First-person execution claim without source tag
    if (hasFirstPersonExecutionClaim(sentence) && !hasSourceTag(sentence)) {
      issues.push({
        type: 'UNTAGGED_EXECUTION_CLAIM',
        severity: 'HIGH',
        line: index + 1,
        sentence: sentence.slice(0, 100) + (sentence.length > 100 ? '...' : ''),
        message: 'First-person execution claim lacks source tag (VERIFIED_NOW | CLAIMED_IN_TRANSCRIPT | INFERRED | UNKNOWN)'
      });
    }

    // Check 2: Mixed source tags in one sentence (BLOCKING - contamination vector)
    if (hasMixedSources(sentence)) {
      issues.push({
        type: 'MIXED_SOURCES',
        severity: 'HIGH',
        line: index + 1,
        sentence: sentence.slice(0, 100) + (sentence.length > 100 ? '...' : ''),
        message: 'Sentence contains multiple source tags - split into separate sentences'
      });
    }

    // Check 3: Source tag in wrong position (not at start)
    if (hasSourceTag(sentence)) {
      const startsWithTag = SOURCE_TAGS.some(tag =>
        sentence.trim().startsWith(tag + ':') || sentence.trim().startsWith(tag + ' ')
      );
      if (!startsWithTag && hasFirstPersonExecutionClaim(sentence)) {
        issues.push({
          type: 'TAG_NOT_AT_START',
          severity: 'LOW',
          line: index + 1,
          sentence: sentence.slice(0, 100) + (sentence.length > 100 ? '...' : ''),
          message: 'Source tag should appear at start of sentence for clarity'
        });
      }
    }
  });

  return {
    passed: issues.filter(i => i.severity === 'HIGH').length === 0,
    issueCount: issues.length,
    highSeverityCount: issues.filter(i => i.severity === 'HIGH').length,
    issues
  };
}

module.exports = {
  lintForContamination,
  hasFirstPersonExecutionClaim,
  hasSourceTag,
  hasMixedSources
};
