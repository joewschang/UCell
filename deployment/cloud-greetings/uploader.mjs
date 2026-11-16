/** Offline-prepared publisher. No default token provider, HTTP adapter, CLI or logging. */
import {inflateSync} from 'node:zlib';

const PATH = '/api/v1/integrations/dot/daily-greetings/publish';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail = code => { throw new Error(code); };

export function endpoint(value) {
  if (typeof value !== 'string' || !/^https:\/\/[a-z0-9.-]+(?::443)?\/api\/v1\/integrations\/dot\/daily-greetings\/publish$/.test(value)) fail('ENDPOINT_INVALID');
  const u = new URL(value);
  // Explicit DNS name, HTTPS 443, fixed route, no credentials/query/fragment/IP.
  if (!u.hostname.includes('.') || !/^[a-z]/.test(u.hostname) || u.hostname.endsWith('.') || u.hostname.split('.').some(x => !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(x)) || u.pathname !== PATH) fail('ENDPOINT_INVALID');
  return u.href;
}
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const b of bytes) { crc ^= b; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
/** Structural + bounded inflate validation; server still owns native decode/branding. */
export function validatePng(png) {
  if (!Buffer.isBuffer(png) || png.length > 8_000_000 || !png.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) fail('PNG_INVALID');
  let offset = 8, channels, ended = false, dataEnded = false;
  const data = [];
  while (offset < png.length) {
    if (offset + 12 > png.length) fail('PNG_INVALID');
    const n = png.readUInt32BE(offset), end = offset + 12 + n;
    if (end > png.length) fail('PNG_INVALID');
    const type = png.toString('ascii', offset + 4, offset + 8), chunk = png.subarray(offset + 8, end - 4);
    if (crc32(png.subarray(offset + 4, end - 4)) !== png.readUInt32BE(end - 4)) fail('PNG_INVALID');
    if (offset === 8 && type !== 'IHDR') fail('PNG_INVALID');
    if (type === 'IHDR') {
      if (channels || n !== 13 || chunk.readUInt32BE(0) !== 1024 || chunk.readUInt32BE(4) !== 1024 || chunk[8] !== 8 || ![2, 6].includes(chunk[9]) || chunk[10] || chunk[11] || chunk[12]) fail('PNG_INVALID');
      channels = chunk[9] === 2 ? 3 : 4;
    } else if (type === 'IDAT') {
      if (dataEnded) fail('PNG_INVALID');
      data.push(chunk);
    } else if (type === 'IEND') {
      if (n || end !== png.length || !data.length) fail('PNG_INVALID');
      ended = true;
    } else {
      // Deliberately stricter subset: no animation, palettes or metadata chunks.
      fail('PNG_INVALID');
    }
    if (data.length && type !== 'IDAT') dataEnded = true;
    offset = end;
  }
  if (!ended) fail('PNG_INVALID');
  try {
    const stride = 1 + 1024 * channels, expected = stride * 1024;
    const decoded = inflateSync(Buffer.concat(data), {maxOutputLength: expected + 1, info: true});
    if (decoded.buffer.length !== expected || decoded.engine.bytesWritten !== Buffer.concat(data).length) fail('PNG_INVALID');
    for (let i = 0; i < expected; i += stride) if (decoded.buffer[i] > 4) fail('PNG_INVALID');
  } catch { fail('PNG_INVALID'); }
}
export function releasedDate(now) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) fail('DATE_INVALID');
  // Taipei UTC+8, release at 07:00: calendar day at UTC+1.
  return new Date(now.getTime() + 3600_000).toISOString().slice(0, 10);
}
function validatePayload(body, now) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).sort().join(',') !== 'contentBase64,date,message,title') fail('PAYLOAD_INVALID');
  if (typeof body.date !== 'string' || body.date < '2026-11-17' || body.date !== releasedDate(now)) fail('DATE_INVALID');
  for (const [value, max] of [[body.title, 8], [body.message, 60]]) {
    if (typeof value !== 'string' || !value.trim() || value !== value.trim() || [...value].length > max || /[<>\x00-\x1f\x7f\u200b-\u200f\u202a-\u202e\u2060-\u206f]|https?:|www\./i.test(value)) fail('COPY_INVALID');
  }
  const b64 = body.contentBase64;
  if (typeof b64 !== 'string' || b64.length > 10_666_668 || b64.length < 60 || b64.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) fail('PNG_INVALID');
  const png = Buffer.from(b64, 'base64');
  if (png.toString('base64') !== b64) fail('PNG_INVALID');
  validatePng(png);
}
/** Persist only this JSON plus its UUID for restart retries; never persist a token. */
export function prepareRequest(body, idempotencyKey, now = new Date()) {
  if (typeof idempotencyKey !== 'string' || !UUID.test(idempotencyKey)) fail('KEY_INVALID');
  validatePayload(body, now);
  return Object.freeze({idempotencyKey, body: JSON.stringify(body)});
}

// Stop awaiting an adapter/provider even if it ignores cancellation. No continuation sends
// after a timed-out provider resolves; the actual HTTPS adapter also destroys its socket.
function abortable(action, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new Error('ATTEMPT_CANCELLED'));
    if (signal.aborted) return abort();
    signal.addEventListener('abort', abort, {once: true});
    Promise.resolve().then(action).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

// Cleanup must not hold the journal mutex if an injected stream ignores cancellation.
function cancelBody(body) {
  try { void Promise.resolve(body?.cancel()).catch(() => {}); } catch {}
}

/**
 * tokenProvider({signal}) -> opaque bearer string, fresh for this attempt.
 * transport(url, fetchOptions) -> Web Response; MUST enforce redirect:error, TLS,
 * signal, and the exact destination without logging headers/body. No adapter here.
 * No callback receives a raw upstream error; caller gets fixed diagnostic codes.
 */
export function createUploader({publishEndpoint, tokenProvider, transport, now = () => new Date(), sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), maxAttempts = 3, attemptTimeoutMs = 30_000}) {
  const url = endpoint(publishEndpoint);
  if (!Number.isInteger(attemptTimeoutMs) || attemptTimeoutMs < 1 || attemptTimeoutMs > 30_000) fail('TIMEOUT_INVALID');
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 3) fail('ATTEMPTS_INVALID');
  if (typeof tokenProvider !== 'function' || typeof transport !== 'function') fail('ADAPTER_REQUIRED');
  return async function upload(request) {
    if (!request || typeof request.body !== 'string' || request.body.length > 10_670_000 || typeof request.idempotencyKey !== 'string' || !UUID.test(request.idempotencyKey)) fail('REQUEST_INVALID');
    // Snapshot once: mutations while awaiting providers must not alter a retry.
    const body = request.body, key = request.idempotencyKey;
    let payload;
    try { payload = JSON.parse(body); } catch { fail('PAYLOAD_INVALID'); }
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      validatePayload(payload, now());
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), attemptTimeoutMs);
      let retry = false, token, response;
      try {
        try { token = await abortable(() => tokenProvider({signal: controller.signal}), controller.signal); } catch { fail('AUTH_UNAVAILABLE'); }
        if (typeof token !== 'string' || !/^[A-Za-z0-9._~+\/-]+=*$/.test(token) || token.length > 8100) fail('AUTH_UNAVAILABLE');
        // A slow provider must not send yesterday's request across the release boundary.
        validatePayload(payload, now());
        try {
          response = await abortable(() => transport(url, {method: 'POST', redirect: 'error', signal: controller.signal,
            headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': key}, body}), controller.signal);
        } catch { retry = true; }
        token = undefined;
        if (response) {
          if (response.redirected || (response.url && response.url !== url)) fail('RESPONSE_INVALID');
          if ([429, 502, 503, 504].includes(response.status)) {
            cancelBody(response.body); retry = true;
          } else {
            if (response.status !== 200) {
              cancelBody(response.body);
              fail(response.status === 409 ? 'PUBLISH_CONFLICT' : 'PUBLISH_REJECTED');
            }
            if (!/^application\/json(?:;|$)/i.test(response.headers.get('content-type') || '') || !response.body) fail('RESPONSE_INVALID');
            const reader = response.body.getReader(), chunks = []; let size = 0;
            try {
              for (;;) { const {done, value} = await abortable(() => reader.read(), controller.signal); if (done) break; size += value.length; if (size > 4096) fail('RESPONSE_INVALID'); chunks.push(value); }
            } finally { cancelBody(reader); }
            let result;
            try { result = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail('RESPONSE_INVALID'); }
            if (!result || result.date !== payload.date || typeof result.id !== 'string' || !UUID.test(result.id) || !['PUBLISHED', 'ALREADY_PUBLISHED'].includes(result.status)) fail('RESPONSE_INVALID');
            return Object.freeze({date: result.date, id: result.id, status: result.status});
          }
        } else if (!retry) fail('RESPONSE_INVALID');
      } catch (error) {
        const code = error instanceof Error ? error.message : '';
        fail(['AUTH_UNAVAILABLE', 'DATE_INVALID', 'RESPONSE_INVALID', 'PUBLISH_CONFLICT', 'PUBLISH_REJECTED'].includes(code) ? code : 'UPLOAD_FAILED');
      } finally { token = undefined; if (response?.body && !response.body.locked) cancelBody(response.body); clearTimeout(timer); }
      if (retry && attempt < maxAttempts - 1) {
        try { await sleep(1000 * 2 ** attempt); } catch { fail('RETRY_INTERRUPTED_SAME_REQUEST'); }
      }
    }
    fail('PUBLISH_UNCERTAIN_RETRY_SAME_REQUEST');
  };
}
