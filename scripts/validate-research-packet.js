#!/usr/bin/env node
'use strict';

/**
 * validate-research-packet.js
 * Validates a research evidence packet against the schema.
 *
 * Usage:
 *   node scripts/validate-research-packet.js evidence/research-radar/v1/packets/example/example-evidence-packet.json
 */

const fs = require('fs');
const path = require('path');

const SCHEMA_PATH = path.join(process.cwd(), 'schemas', 'research-evidence-packet-v1.json');

function loadSchema() {
  const raw = fs.readFileSync(SCHEMA_PATH, 'utf8');
  return JSON.parse(raw);
}

function validateNested(obj, schema, pathPrefix = '') {
  let errors = [];

  // Required fields
  const required = schema.required || [];
  for (const field of required) {
    if (!(field in obj)) {
      errors.push(`${pathPrefix}${field} (required)`);
    }
  }

  // Properties
  for (const [key, spec] of Object.entries(schema.properties || {})) {
    if (!(key in obj)) continue;

    const value = obj[key];
    const expected = spec.type;

    // Type checks
    if (expected === 'string' && typeof value !== 'string') {
      errors.push(`${pathPrefix}${key} expected string, got ${typeof value}`);
    } else if (expected === 'number' && typeof value !== 'number') {
      errors.push(`${pathPrefix}${key} expected number, got ${typeof value}`);
    } else if (expected === 'boolean' && typeof value !== 'boolean') {
      errors.push(`${pathPrefix}${key} expected boolean, got ${typeof value}`);
    } else if (expected === 'array' && !Array.isArray(value)) {
      errors.push(`${pathPrefix}${key} expected array, got ${typeof value}`);
    } else if (expected === 'object' && spec.additionalProperties !== true && (typeof value !== 'object' || Array.isArray(value) || value === null)) {
      errors.push(`${pathPrefix}${key} expected object`);
    }

    // Enum
    if (spec.enum && !spec.enum.includes(value)) {
      errors.push(`${pathPrefix}${key} value "${value}" not in enum ${spec.enum.join(', ')}`);
    }

    // Ranges
    if (expected === 'number') {
      if (spec.minimum !== undefined && value < spec.minimum) {
        errors.push(`${pathPrefix}${key} value ${value} < minimum ${spec.minimum}`);
      }
      if (spec.maximum !== undefined && value > spec.maximum) {
        errors.push(`${pathPrefix}${key} value ${value} > maximum ${spec.maximum}`);
      }
    }

    // Pattern
    if (spec.pattern && typeof value === 'string') {
      const re = new RegExp(spec.pattern);
      if (!re.test(value)) {
        errors.push(`${pathPrefix}${key} does not match pattern ${spec.pattern}`);
      }
    }

    // Recurse into nested objects (except provenance is handled separately for clarity)
    if (expected === 'object' && spec.properties && spec.additionalProperties === false && value && typeof value === 'object') {
      const nestedErrors = validateNested(value, spec, `${pathPrefix}${key}.`);
      errors = errors.concat(nestedErrors);
    }
  }

  return errors;
}

function validatePacket(packetPath, schema) {
  const raw = fs.readFileSync(packetPath, 'utf8');
  const pkt = JSON.parse(raw);

  // Validate top-level packet structure
  const errors = validateNested(pkt, schema, '');

  // Provenance is a nested object; validate it separately with its own schema
  if (pkt.provenance && schema.properties.provenance) {
    const provErrors = validateNested(pkt.provenance, schema.properties.provenance, 'provenance.');
    errors.push(...provErrors);
  }

  return errors;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node scripts/validate-research-packet.js <packet-path>');
    process.exit(1);
  }

  const packetPath = args[0];
  if (!fs.existsSync(packetPath)) {
    console.error('File not found:', packetPath);
    process.exit(1);
  }

  const schema = loadSchema();
  const errors = validatePacket(packetPath, schema);

  if (errors.length === 0) {
    console.log('✓ Packet is valid:', packetPath);
    console.log('  Schema:', schema.title);
    process.exit(0);
  } else {
    console.log('✗ Validation failed:', packetPath);
    for (const err of errors) {
      console.log('  -', err);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { validatePacket, loadSchema };
