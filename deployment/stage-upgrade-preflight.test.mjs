import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { evaluateMigrations, validateRuntime } from './stage-upgrade-preflight.mjs';

test('fails closed without explicit environment, opt-in, and database URL', () => {
  assert.equal(validateRuntime(undefined, undefined, undefined).length, 3);
  assert.deepEqual(validateRuntime('PRODUCTION', 'READ_ONLY_PREFLIGHT', 'postgresql://example'), [
    'UCELL_ENVIRONMENT must be CONNECTED_DEV or STAGE',
  ]);
});

test('accepts only explicit CONNECTED_DEV or STAGE read-only execution', () => {
  assert.deepEqual(validateRuntime('CONNECTED_DEV', 'READ_ONLY_PREFLIGHT', 'postgresql://example'), []);
  assert.deepEqual(validateRuntime('STAGE', 'READ_ONLY_PREFLIGHT', 'postgres://example'), []);
});

test('detects failed migrations, drift, and unknown database migrations', () => {
  const local = new Map([['001_ok', 'aaa'], ['002_pending', 'bbb']]);
  const failures = evaluateMigrations(local, [
    { name: '001_ok', checksum: 'bad', finishedAt: '2026-09-17', rolledBackAt: '' },
    { name: '002_pending', checksum: 'bbb', finishedAt: '', rolledBackAt: '' },
    { name: '003_unknown', checksum: 'ccc', finishedAt: '2026-09-17', rolledBackAt: '' },
  ]);
  assert.deepEqual(failures, [
    'migration checksum mismatch: 001_ok',
    'failed/incomplete migration: 002_pending',
    'database migration is absent locally: 003_unknown',
  ]);
});

test('implementation remains read-only and contains all conflict checks', () => {
  const source = readFileSync(new URL('./stage-upgrade-preflight.mjs', import.meta.url), 'utf8');
  for (const required of [
    'organization.binary_placement',
    'identity.formal_member_application',
    'identity.delivery_profile',
    'public.ucell_prevent_mutation()',
    'public._prisma_migrations',
  ]) assert.match(source, new RegExp(required.replaceAll('.', '\\.'), 'u'));
  assert.doesNotMatch(source, /\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|CREATE)\s+(?:TABLE|INDEX|INTO|FROM|FUNCTION)/iu);
  assert.doesNotMatch(source, /\baz\b|containerapp|keyvault/iu);
});
