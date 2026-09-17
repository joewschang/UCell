#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(here, '..');
const migrationsRoot = resolve(repositoryRoot, 'backend/packages/database/prisma/migrations');
const allowedEnvironments = new Set(['CONNECTED_DEV', 'STAGE']);
const optInValue = 'READ_ONLY_PREFLIGHT';

export function validateRuntime(environment = process.env.UCELL_ENVIRONMENT, optIn = process.env.UCELL_UPGRADE_PREFLIGHT_OPT_IN, databaseUrl = process.env.DATABASE_URL) {
  const errors = [];
  if (!allowedEnvironments.has(environment ?? '')) errors.push('UCELL_ENVIRONMENT must be CONNECTED_DEV or STAGE');
  if (optIn !== optInValue) errors.push(`UCELL_UPGRADE_PREFLIGHT_OPT_IN must equal ${optInValue}`);
  if (!databaseUrl) errors.push('DATABASE_URL is required');
  if (databaseUrl && !/^postgres(?:ql)?:\/\//i.test(databaseUrl)) errors.push('DATABASE_URL must be a PostgreSQL URL');
  return errors;
}

export function localMigrationChecksums(root = migrationsRoot) {
  return new Map(readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const path = resolve(root, entry.name, 'migration.sql');
      if (!existsSync(path)) throw new Error(`Missing migration.sql: ${entry.name}`);
      return [entry.name, createHash('sha256').update(readFileSync(path)).digest('hex')];
    })
    .sort(([left], [right]) => left.localeCompare(right)));
}

function runPsql(databaseUrl, sql) {
  const { DATABASE_URL: _removed, PGPASSWORD: _password, ...baseEnvironment } = process.env;
  const result = spawnSync('psql', ['-X', '-A', '-t', '-F', '\t', '-v', 'ON_ERROR_STOP=1', '-c', sql], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: { ...baseEnvironment, PGDATABASE: databaseUrl },
    windowsHide: true,
  });
  if (result.error) throw new Error(`Unable to execute psql: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`psql read-only check failed: ${(result.stderr || '').trim() || `exit ${result.status}`}`);
  return (result.stdout || '').trim();
}

function scalar(databaseUrl, sql) {
  return runPsql(databaseUrl, sql).split('\t')[0] ?? '';
}

function relationExists(databaseUrl, relation) {
  return scalar(databaseUrl, `SELECT to_regclass('${relation.replaceAll("'", "''")}') IS NOT NULL;`) === 't';
}

function duplicateSummary(databaseUrl, relation, query) {
  if (!relationExists(databaseUrl, relation)) return { groups: 0, rows: 0, relationPresent: false };
  const [groups = '0', rows = '0'] = runPsql(databaseUrl, query).split('\t');
  return { groups: Number(groups), rows: Number(rows), relationPresent: true };
}

export function evaluateMigrations(localChecksums, rows) {
  const failures = [];
  for (const row of rows) {
    if (!row.finishedAt && !row.rolledBackAt) failures.push(`failed/incomplete migration: ${row.name}`);
    const local = localChecksums.get(row.name);
    if (!local) failures.push(`database migration is absent locally: ${row.name}`);
    else if (local !== row.checksum) failures.push(`migration checksum mismatch: ${row.name}`);
  }
  return failures;
}

function readMigrationRows(databaseUrl) {
  if (!relationExists(databaseUrl, 'public._prisma_migrations')) return { missingTable: true, rows: [] };
  const output = runPsql(databaseUrl, `
    SELECT migration_name, checksum, COALESCE(finished_at::text,''), COALESCE(rolled_back_at::text,'')
    FROM public._prisma_migrations
    ORDER BY started_at, migration_name;
  `);
  return {
    missingTable: false,
    rows: output ? output.split(/\r?\n/).map((line) => {
      const [name, checksum, finishedAt, rolledBackAt] = line.split('\t');
      return { name, checksum, finishedAt, rolledBackAt };
    }) : [],
  };
}

export function runPreflight(databaseUrl) {
  const localChecksums = localMigrationChecksums();
  const migrationState = readMigrationRows(databaseUrl);
  const failures = [];
  if (migrationState.missingTable) failures.push('public._prisma_migrations is missing');
  failures.push(...evaluateMigrations(localChecksums, migrationState.rows));

  const applied = migrationState.rows.filter((row) => row.finishedAt && !row.rolledBackAt).length;
  if (applied > localChecksums.size) failures.push(`database has ${applied} applied migrations but repository has ${localChecksums.size}`);
  if (scalar(databaseUrl, "SELECT to_regprocedure('public.ucell_prevent_mutation()') IS NOT NULL;") !== 't') {
    failures.push('prerequisite function public.ucell_prevent_mutation() is missing');
  }

  const conflicts = {
    binaryOpenSlots: duplicateSummary(databaseUrl, 'organization.binary_placement', `
      SELECT count(*), COALESCE(sum(open_rows),0) FROM (
        SELECT count(*) AS open_rows FROM organization.binary_placement
        WHERE effective_to IS NULL GROUP BY parent_qualification_id, side HAVING count(*) > 1
      ) conflicts;
    `),
    formalOpenApplications: duplicateSummary(databaseUrl, 'identity.formal_member_application', `
      SELECT count(*), COALESCE(sum(open_rows),0) FROM (
        SELECT count(*) AS open_rows FROM identity.formal_member_application
        WHERE status IN ('DRAFT','SUBMITTED','UNDER_REVIEW','NEEDS_MORE_INFO')
        GROUP BY person_id HAVING count(*) > 1
      ) conflicts;
    `),
    currentDeliveryProfiles: duplicateSummary(databaseUrl, 'identity.delivery_profile', `
      SELECT count(*), COALESCE(sum(open_rows),0) FROM (
        SELECT count(*) AS open_rows FROM identity.delivery_profile
        WHERE effective_to IS NULL GROUP BY person_id HAVING count(*) > 1
      ) conflicts;
    `),
  };

  for (const [name, summary] of Object.entries(conflicts)) {
    if (summary.groups > 0) failures.push(`${name}: ${summary.groups} conflicting groups / ${summary.rows} rows`);
  }

  return {
    status: failures.length ? 'BLOCKED' : 'PASS',
    mode: 'READ_ONLY',
    localMigrationCount: localChecksums.size,
    appliedMigrationCount: applied,
    conflicts,
    failures,
  };
}

function main() {
  const runtimeErrors = validateRuntime();
  if (runtimeErrors.length) {
    console.error(JSON.stringify({ status: 'BLOCKED', mode: 'READ_ONLY', failures: runtimeErrors }, null, 2));
    process.exitCode = 2;
    return;
  }
  try {
    const result = runPreflight(process.env.DATABASE_URL);
    console.log(JSON.stringify(result, null, 2));
    if (result.status !== 'PASS') process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ status: 'BLOCKED', mode: 'READ_ONLY', failures: [error.message] }, null, 2));
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
