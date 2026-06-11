function runRecoverySuite() {
  return runNodeScript(discovery.getLocalPath('archivist'), ['scripts/recovery-test-suite.js']);
}