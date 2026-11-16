/** Local filesystem only. Requires a private persistent directory on one host, not NFS. */
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync, lstatSync, realpathSync, openSync, fsyncSync, closeSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createUploader, prepareRequest, endpoint, releasedDate} from './uploader.mjs';
const fail = code => { throw new Error(code); };
const hash = value => createHash('sha256').update(value).digest('hex');
const states = ['READY', 'IN_FLIGHT', 'RETRYABLE', 'SUCCEEDED', 'BLOCKED', 'EXPIRED', 'EXHAUSTED'];
const terminal = ['SUCCEEDED', 'BLOCKED', 'EXPIRED', 'EXHAUSTED'];
function privateDirectory(directory) {
  if (typeof directory !== 'string' || resolve(directory) !== directory) fail('JOURNAL_PATH_INVALID');
  const stat = lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || realpathSync(directory) !== directory || (stat.mode & 0o077) || stat.uid !== process.getuid()) fail('JOURNAL_PATH_INVALID');
  for (const name of ['jobs.sqlite', 'lock.sqlite', 'jobs.sqlite-journal', 'lock.sqlite-journal']) {
    try {
      const file = lstatSync(join(directory, name));
      if (!file.isFile() || file.isSymbolicLink() || file.nlink !== 1 || file.uid !== process.getuid() || (file.mode & 0o077) || file.size > 512 * 1024 * 1024) fail('JOURNAL_FILE_INVALID');
    } catch (error) { if (error.code !== 'ENOENT' || !name.endsWith('-journal')) throw error; }
  }
}
function configure(db) {
  db.exec('PRAGMA busy_timeout=0; PRAGMA synchronous=FULL; PRAGMA trusted_schema=OFF;');
  if (db.prepare('PRAGMA quick_check').get().quick_check !== 'ok') fail('JOURNAL_CORRUPT');
}
/** Explicit one-time creation only. Never silently recreates an existing or missing journal. */
export function initializeJournal(directory) {
  let jobs, lock;
  try {
    if (typeof directory !== 'string' || resolve(directory) !== directory) fail('JOURNAL_PATH_INVALID');
    mkdirSync(directory, {mode: 0o700});
    for (const name of ['jobs.sqlite', 'lock.sqlite']) {
      const fd = openSync(join(directory, name), 'wx', 0o600); closeSync(fd);
    }
    privateDirectory(directory);
    jobs = new DatabaseSync(join(directory, 'jobs.sqlite')); configure(jobs);
    jobs.exec(`CREATE TABLE metadata(version INTEGER NOT NULL); INSERT INTO metadata VALUES(1);
      CREATE TABLE jobs(date TEXT PRIMARY KEY, request_key TEXT UNIQUE NOT NULL, body TEXT NOT NULL, digest TEXT NOT NULL,
      endpoint TEXT NOT NULL, state TEXT NOT NULL, attempts INTEGER NOT NULL, next_at INTEGER NOT NULL, result TEXT);
      CREATE TRIGGER immutable_request BEFORE UPDATE OF date,request_key,body,digest,endpoint ON jobs
      BEGIN SELECT RAISE(ABORT,'immutable request'); END;`);
    lock = new DatabaseSync(join(directory, 'lock.sqlite')); configure(lock);
    lock.exec('CREATE TABLE mutex(id INTEGER PRIMARY KEY); INSERT INTO mutex VALUES(1);');
    const fd = openSync(directory, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); }
  } catch { fail('JOURNAL_INIT_FAILED'); }
  finally { jobs?.close(); lock?.close(); }
}
async function exclusive(directory, action) {
  let jobs, lock, acquired = false;
  try {
    privateDirectory(directory);
    lock = new DatabaseSync(join(directory, 'lock.sqlite')); configure(lock);
    try { lock.exec('BEGIN IMMEDIATE'); acquired = true; }
    catch (error) { if (error.errcode === 5) fail('JOURNAL_BUSY'); throw error; }
    jobs = new DatabaseSync(join(directory, 'jobs.sqlite')); configure(jobs);
    if (jobs.prepare('SELECT version FROM metadata').get()?.version !== 1) fail('JOURNAL_CORRUPT');
    return await action(jobs);
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    fail(['JOURNAL_BUSY', 'JOURNAL_CORRUPT', 'DATE_RESERVED', 'REQUEST_INVALID', 'JOB_MISSING', 'DATE_INVALID'].includes(code) ? code : 'JOURNAL_UNAVAILABLE');
  } finally {
    jobs?.close();
    if (acquired) lock.exec('ROLLBACK');
    lock?.close();
  }
}
function clock(now) {
  const value = now();
  if (!(value instanceof Date) || !Number.isSafeInteger(value.getTime()) || value.getTime() < 0) fail('DATE_INVALID');
  return value;
}
function validate(row) {
  try {
    if (!row || typeof row.body !== 'string' || row.body.length > 10_670_000 || hash(row.body) !== row.digest ||
        !states.includes(row.state) || !Number.isInteger(row.attempts) || row.attempts < 0 || row.attempts > 3 ||
        !Number.isSafeInteger(row.next_at) || row.next_at < 0 || endpoint(row.endpoint) !== row.endpoint ||
        !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) fail('JOURNAL_CORRUPT');
    const payload = JSON.parse(row.body);
    if (payload.date !== row.date) fail('JOURNAL_CORRUPT');
    // Validate stored request independently of today's release date, then check current date in run.
    prepareRequest(payload, row.request_key, new Date(row.date + 'T07:00:00+08:00'));
    if ((row.state === 'READY' && row.attempts !== 0) || (['IN_FLIGHT','RETRYABLE','SUCCEEDED'].includes(row.state) && row.attempts < 1) || (row.state === 'EXHAUSTED' && row.attempts !== 3)) fail('JOURNAL_CORRUPT');
    if (row.state === 'SUCCEEDED') {
      const r = JSON.parse(row.result);
      if (Object.keys(r).sort().join(',') !== 'date,id,status' || r.date !== row.date || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(r.id) || !['PUBLISHED','ALREADY_PUBLISHED'].includes(r.status)) fail('JOURNAL_CORRUPT');
    } else if (row.result !== null) fail('JOURNAL_CORRUPT');
    return row;
  } catch { fail('JOURNAL_CORRUPT'); }
}
const summary = row => Object.freeze({date: row.date, idempotencyKey: row.request_key, digest: row.digest, state: row.state, attempts: row.attempts, nextAttemptAt: row.next_at, ...(row.result ? {result: JSON.parse(row.result)} : {})});
function update(db, row, state, next = 0, result = null) {
  db.prepare('UPDATE jobs SET state=?,attempts=?,next_at=?,result=? WHERE date=?').run(state, row.attempts, next, result ? JSON.stringify(result) : null, row.date);
  return validate(db.prepare('SELECT * FROM jobs WHERE date=?').get(row.date));
}
export async function enqueueJournal({directory, publishEndpoint, request, now = () => new Date()}) {
  let body, key, date, url;
  try {
    body = request.body; key = request.idempotencyKey;
    if (typeof body !== 'string' || body.length > 10_670_000) fail('REQUEST_INVALID');
    const payload = JSON.parse(body); prepareRequest(payload, key, clock(now)); date = payload.date; url = endpoint(publishEndpoint);
  } catch { fail('REQUEST_INVALID'); }
  return exclusive(directory, db => {
    const old = db.prepare('SELECT * FROM jobs WHERE date=? OR request_key=?').get(date, key);
    if (old) {
      validate(old);
      if (old.date !== date || old.request_key !== key || old.body !== body || old.endpoint !== url) fail('DATE_RESERVED');
      return summary(old);
    }
    db.prepare('INSERT INTO jobs VALUES(?,?,?,?,?,?,0,0,NULL)').run(date, key, body, hash(body), url, 'READY');
    return summary(validate(db.prepare('SELECT * FROM jobs WHERE date=?').get(date)));
  });
}
export async function inspectJournal({directory, date}) {
  return exclusive(directory, db => {
    const row = db.prepare('SELECT * FROM jobs WHERE date=?').get(date);
    if (!row) fail('JOB_MISSING');
    return summary(validate(row));
  });
}
/** One durable attempt per invocation; total cap of 3 survives process restarts. */
export async function runJournal({directory, date, tokenProvider, transport, now = () => new Date()}) {
  return exclusive(directory, async db => {
    let row = db.prepare('SELECT * FROM jobs WHERE date=?').get(date);
    if (!row) fail('JOB_MISSING');
    validate(row);
    if (terminal.includes(row.state)) return summary(row);
    const at = clock(now);
    if (row.date !== releasedDate(at)) return summary(update(db, row, 'EXPIRED'));
    if (row.attempts >= 3) return summary(update(db, row, 'EXHAUSTED'));
    if (row.next_at > at.getTime()) return summary(row);
    // Durable reservation BEFORE auth/network. A crash can consume a slot without sending.
    row.attempts++;
    row = update(db, row, 'IN_FLIGHT', at.getTime() + 1000 * 2 ** (row.attempts - 1));
    const upload = createUploader({publishEndpoint: row.endpoint, tokenProvider, transport, now, maxAttempts: 1});
    let result, state;
    try {
      result = await upload({body: row.body, idempotencyKey: row.request_key}); state = 'SUCCEEDED';
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code === 'DATE_INVALID') state = 'EXPIRED';
      else if (['AUTH_UNAVAILABLE','PUBLISH_REJECTED','PUBLISH_CONFLICT'].includes(code)) state = 'BLOCKED';
      else state = row.attempts >= 3 ? 'EXHAUSTED' : 'RETRYABLE';
    }
    // If this commit fails, persistent IN_FLIGHT is recovered with the SAME key/body.
    return summary(update(db, row, state, state === 'RETRYABLE' ? row.next_at : 0, result));
  });
}
