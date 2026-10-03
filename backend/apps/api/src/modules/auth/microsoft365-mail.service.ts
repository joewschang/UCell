import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';

const SENDER = 'service@ucell.life';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Server-only Graph transport. Exchange Application RBAC must scope Mail.Send to SENDER. */
export class Microsoft365MailService {
  private cached?: { value: string; expiresAt: number; key: string };
  private pending?: { key: string; request: Promise<string> };
  constructor(private readonly config: ConfigService) {}

  isSelected() {
    const provider = this.config.get<string>('TRANSACTIONAL_EMAIL_PROVIDER');
    if (provider && !['webhook', 'microsoft365_graph'].includes(provider)) {
      throw new ServiceUnavailableException({ code: 'M365_MAIL_CONFIGURATION_PENDING' });
    }
    return provider === 'microsoft365_graph';
  }

  assertConfigured() {
    const tenant = this.config.get<string>('M365_MAIL_TENANT_ID') ?? '';
    const client = this.config.get<string>('M365_MAIL_CLIENT_ID') ?? '';
    const secret = this.config.get<string>('M365_MAIL_CLIENT_SECRET') ?? '';
    if (!UUID.test(tenant) || !UUID.test(client) || !secret.trim()) {
      throw new ServiceUnavailableException({ code: 'M365_MAIL_CONFIGURATION_PENDING' });
    }
    return { tenant, client, secret };
  }

  private async accessToken() {
    const { tenant, client, secret } = this.assertConfigured();
    const key = createHash('sha256').update(JSON.stringify([tenant, client, secret])).digest('hex');
    if (this.cached?.key === key && this.cached.expiresAt > Date.now()) return this.cached.value;
    if (this.pending?.key === key) return this.pending.request;
    const request = (async () => {
      const response = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: client, client_secret: secret,
          grant_type: 'client_credentials', scope: 'https://graph.microsoft.com/.default' }).toString(),
      });
      if (!response.ok) throw Error();
      const token = await response.json() as { access_token?: unknown; expires_in?: unknown; token_type?: unknown };
      if (typeof token.access_token !== 'string' || !token.access_token || token.token_type !== 'Bearer'
        || typeof token.expires_in !== 'number' || !Number.isFinite(token.expires_in) || token.expires_in <= 0) throw Error();
      this.cached = { key, value: token.access_token, expiresAt: Date.now() + Math.max(0, token.expires_in - 60) * 1000 };
      return token.access_token;
    })();
    const pending = { key, request }; this.pending = pending;
    try { return await request; } finally { if (this.pending === pending) this.pending = undefined; }
  }

  async send(input: { to: string; subject: string; text: string }) {
    this.assertConfigured();
    try {
      if (!/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(input.to)) throw Error();
      const token = await this.accessToken();
      const response = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(SENDER)}/sendMail`, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: { subject: input.subject,
          body: { contentType: 'Text', content: input.text },
          toRecipients: [{ emailAddress: { address: input.to } }] }, saveToSentItems: true }),
      });
      if (response.status === 401) this.cached = undefined;
      // Never retry an ambiguous send: the provider may have accepted it before the connection failed.
      if (response.status !== 202) throw Error();
    } catch {
      // Provider payloads can contain credentials, codes and recipient data. Do not expose them.
      throw new ServiceUnavailableException({ code: 'M365_MAIL_DELIVERY_FAILED' });
    }
  }
}
