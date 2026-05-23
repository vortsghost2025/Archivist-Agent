#!/usr/bin/env bun
/**
 * Bun preload polyfill for Effect v4 runtime compatibility.
 *
 * Effect v4.0.0-beta.48 renamed Effect.catchAll → Effect.catch but
 * OpenCode/Kilo's bundled runtime still calls Effect.catchAll.
 * This polyfill intercepts all Effect exports and aliases catchAll → catch.
 *
 * Load with: BUN_OPTIONS='--preload=S:\Archivist-Agent\scripts\effect-polyfill.cjs' opencode
 */
(function () {
  // Wrap the global Effect constructor/module after it's loaded
  const origDefineProperty = Object.defineProperty;
  const origGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;

  let patched = false;

  function patchEffectModule(mod) {
    if (!mod || patched) return;
    // Effect exports might be on module.exports, or on a named export "Effect"
    const effectExports = mod.Effect || mod;
    if (
      effectExports &&
      typeof effectExports.catch === 'function' &&
      typeof effectExports.catchAll === 'undefined'
    ) {
      effectExports.catchAll = effectExports.catch;
      patched = true;
      if (typeof process !== 'undefined' && process.stderr) {
        process.stderr.write('[effect-polyfill] Applied catchAll → catch alias\n');
      }
    }
  }

  // Intercept require() for the "effect" module
  const Module = require('module');
  const origRequire = Module.prototype.require;
  Module.prototype.require = function (id) {
    const mod = origRequire.apply(this, arguments);
    if (id === 'effect' || id.endsWith('/effect') || id.endsWith('\\effect')) {
      patchEffectModule(mod);
    }
    return mod;
  };

  // Also patch after all modules finish loading via a microtask
  // This catches cases where the module is loaded before our hook is installed
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(() => {
      try {
        const effectMod = require('effect');
        patchEffectModule(effectMod);
      } catch (_) {
        // effect module not yet loaded, that's fine
      }
    });
  }
})();