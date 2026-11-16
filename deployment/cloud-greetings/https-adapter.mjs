/** Node >=24.5. No redirects, no global agent changes, no logging, no auth acquisition. */
import https from 'node:https';
import {endpoint} from './uploader.mjs';
const fail = code => { throw new Error(code); };

export function createHttpsTransport({publishEndpoint, timeoutMs = 30_000, proxyEnv = process.env, request = https.request}) {
  const pinned = endpoint(publishEndpoint);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000) fail('HTTPS_CONFIG_INVALID');
  return async (url, options) => {
    // Reconstruct headers/options: caller cannot override host, agent, CA, TLS, port or path.
    if (url !== pinned || options?.method !== 'POST' || options.redirect !== 'error' || !(options.signal instanceof AbortSignal) ||
        typeof options.body !== 'string' || Buffer.byteLength(options.body) > 10_670_000 ||
        Object.keys(options.headers || {}).sort().join(',') !== 'Authorization,Content-Type,Idempotency-Key' ||
        options.headers['Content-Type'] !== 'application/json' ||
        !/^Bearer [A-Za-z0-9._~+\/-]{1,8100}={0,2}$/.test(options.headers.Authorization || '') ||
        !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(options.headers['Idempotency-Key'] || '')) fail('HTTPS_REQUEST_INVALID');
    if (options.signal.aborted) fail('HTTPS_CANCELLED');
    return new Promise((resolve, reject) => {
      let req, res, agent, settled = false;
      const finish = (code, value) => {
        if (settled) return; settled = true;
        clearTimeout(timer); options.signal.removeEventListener('abort', abort);
        res?.destroy(); req?.destroy(); agent?.destroy();
        code ? reject(new Error(code)) : resolve(value);
      };
      const abort = () => finish('HTTPS_CANCELLED');
      const timer = setTimeout(() => finish('HTTPS_TIMEOUT'), timeoutMs);
      options.signal.addEventListener('abort', abort, {once: true});
      try {
        agent = new https.Agent({keepAlive: false, maxSockets: 1, proxyEnv});
        req = request(pinned, {method: 'POST', agent, rejectUnauthorized: true, minVersion: 'TLSv1.2',
          maxHeaderSize: 8192, signal: options.signal, headers: {
            Authorization: options.headers.Authorization, 'Content-Type': 'application/json',
            'Idempotency-Key': options.headers['Idempotency-Key'], 'Content-Length': Buffer.byteLength(options.body),
            'Accept': 'application/json', 'Accept-Encoding': 'identity',
          }}, incoming => {
          res = incoming;
          res.on('error', () => finish('HTTPS_RESPONSE_FAILED'));
          res.on('aborted', () => finish('HTTPS_RESPONSE_FAILED'));
          const status = res.statusCode;
          if (!Number.isInteger(status) || status < 200 || status > 599) return finish('HTTPS_RESPONSE_INVALID');
          // Never follow Location. Non-success bodies are discarded, not buffered/logged.
          if (status !== 200) return finish(null, new Response(null, {status}));
          const type = res.headers['content-type'], length = res.headers['content-length'];
          if (typeof type !== 'string' || !/^application\/json(?:;|$)/i.test(type) ||
              (res.headers['content-encoding'] && res.headers['content-encoding'] !== 'identity') ||
              (length !== undefined && (typeof length !== 'string' || !/^\d+$/.test(length) || Number(length) > 4096))) return finish('HTTPS_RESPONSE_INVALID');
          let size = 0; const chunks = [];
          res.on('data', chunk => {
            size += chunk.length;
            if (size > 4096) return finish('HTTPS_RESPONSE_TOO_LARGE');
            chunks.push(chunk);
          });
          res.on('end', () => {
            if (!res.complete || (length !== undefined && Number(length) !== size)) return finish('HTTPS_RESPONSE_FAILED');
            finish(null, new Response(Buffer.concat(chunks), {status: 200, headers: {'content-type': 'application/json'}}));
          });
          res.on('close', () => { if (!settled) finish('HTTPS_RESPONSE_FAILED'); });
        });
        req.on('error', () => finish('HTTPS_FAILED'));
        req.on('upgrade', (_response, socket) => { socket.destroy(); finish('HTTPS_RESPONSE_INVALID'); });
        req.end(options.body);
      } catch { finish('HTTPS_FAILED'); }
    });
  };
}

/** Encoding-only candidate interface. Does NOT read environment, send HTTP or substitute secrets. */
export function encodeClientCredentials({tenantId, clientId, audience, placeholder}) {
  const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (![tenantId, clientId, audience].every(v => typeof v === 'string' && guid.test(v)) || typeof placeholder !== 'string' || !placeholder || placeholder.length > 4096) fail('AUTH_CONFIG_INVALID');
  return {url: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    body: new URLSearchParams({grant_type: 'client_credentials', client_id: clientId, scope: `api://${audience}/.default`, client_secret: placeholder}).toString(),
    contentType: 'application/x-www-form-urlencoded'};
}
