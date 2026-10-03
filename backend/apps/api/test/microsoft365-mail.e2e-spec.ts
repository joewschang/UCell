import { ConfigService } from '@nestjs/config';
import { Microsoft365MailService } from '../src/modules/auth/microsoft365-mail.service';
import { ContactVerificationEmailService } from '../src/modules/auth/contact-verification-email.service';
import { PasswordResetEmailService } from '../src/modules/auth/password-reset-email.service';

const settings = { TRANSACTIONAL_EMAIL_PROVIDER: 'microsoft365_graph',
  M365_MAIL_TENANT_ID: '00000000-0000-0000-0000-000000000001',
  M365_MAIL_CLIENT_ID: '00000000-0000-0000-0000-000000000002',
  M365_MAIL_CLIENT_SECRET: 'TEST_ONLY_CLIENT_SECRET' };
const token = () => new Response(JSON.stringify({ access_token: 'TEST_ONLY_ACCESS_TOKEN', token_type: 'Bearer', expires_in: 3600 }), { status: 200 });
const message = { to: 'test@example.invalid', subject: '測試', text: '內容' };

describe('Microsoft 365 transactional delivery', () => {
  const original = global.fetch;
  afterEach(() => { global.fetch = original; jest.restoreAllMocks(); });
  function mock() {
    const fetch = jest.fn().mockImplementation(async (url: string) => url.includes('/token') ? token() : new Response(null, { status: 202 }));
    global.fetch = fetch; return fetch;
  }
  it('sends with client credentials to only the approved mailbox and caches tokens', async () => {
    const fetch = mock(), service = new Microsoft365MailService(new ConfigService(settings));
    await service.send(message); await service.send(message);
    expect(fetch).toHaveBeenCalledTimes(3);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(`https://login.microsoftonline.com/${settings.M365_MAIL_TENANT_ID}/oauth2/v2.0/token`);
    const form = new URLSearchParams(init.body);
    expect(form.get('scope')).toBe('https://graph.microsoft.com/.default');
    expect(form.get('grant_type')).toBe('client_credentials');
    expect(form.get('client_secret')).toBe(settings.M365_MAIL_CLIENT_SECRET);
    expect(init.redirect).toBe('error'); expect(init.signal).toBeInstanceOf(AbortSignal);
    const [sendUrl, send] = fetch.mock.calls[1];
    expect(sendUrl).toBe('https://graph.microsoft.com/v1.0/users/service%40ucell.life/sendMail');
    expect(send.headers.authorization).toBe('Bearer TEST_ONLY_ACCESS_TOKEN');
    expect(send.redirect).toBe('error'); expect(send.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(send.body)).toEqual({ message: { subject: message.subject,
      body: { contentType: 'Text', content: message.text }, toRecipients: [{ emailAddress: { address: message.to } }] }, saveToSentItems: true });
  });
  it('shares simultaneous token requests and refreshes before expiration', async () => {
    const fetch = mock(), service = new Microsoft365MailService(new ConfigService(settings));
    const now = jest.spyOn(Date, 'now').mockReturnValue(100000);
    await Promise.all([service.send(message), service.send(message)]);
    expect(fetch.mock.calls.filter(([url]) => url.includes('/token'))).toHaveLength(1);
    now.mockReturnValue(3700000); await service.send(message);
    expect(fetch.mock.calls.filter(([url]) => url.includes('/token'))).toHaveLength(2);
  });
  it('does not reuse a token after a configured credential rotation', async () => {
    const fetch = mock(), config = new ConfigService({ ...settings }), service = new Microsoft365MailService(config);
    await service.send(message); config.set('M365_MAIL_CLIENT_SECRET', 'TEST_ONLY_ROTATED_SECRET'); await service.send(message);
    expect(fetch.mock.calls.filter(([url]) => url.includes('/token'))).toHaveLength(2);
  });
  it.each([200, 204, 400, 401, 403, 429, 500])('fails closed for send status %s without retry or payload leakage', async status => {
    const fetch = mock(); fetch.mockResolvedValueOnce(token()).mockResolvedValueOnce(new Response(status === 204 ? null : 'PRIVATE_PROVIDER_ERROR', { status }));
    const service = new Microsoft365MailService(new ConfigService(settings));
    await expect(service.send(message)).rejects.toMatchObject({ response: { code: 'M365_MAIL_DELIVERY_FAILED' } });
    expect(fetch).toHaveBeenCalledTimes(2);
    if (status === 401) { await service.send(message); expect(fetch.mock.calls.filter(([url]) => url.includes('/token'))).toHaveLength(2); }
  });
  it.each([403, 429, 500])('does not attempt delivery after token error %s', async status => {
    const fetch = mock(); fetch.mockResolvedValueOnce(new Response('PRIVATE_TOKEN_ERROR', { status }));
    await expect(new Microsoft365MailService(new ConfigService(settings)).send(message)).rejects.toMatchObject({ response: { code: 'M365_MAIL_DELIVERY_FAILED' } });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('rejects malformed token responses and retries acquisition only on a later request', async () => {
    const fetch = mock(); fetch.mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'PRIVATE', expires_in: '3600' })));
    const service = new Microsoft365MailService(new ConfigService(settings));
    await expect(service.send(message)).rejects.toThrow(); await service.send(message);
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it('does not retry an ambiguous network send', async () => {
    const fetch = mock(); fetch.mockResolvedValueOnce(token()).mockRejectedValueOnce(new Error('PRIVATE_NETWORK_ERROR'));
    await expect(new Microsoft365MailService(new ConfigService(settings)).send(message)).rejects.toMatchObject({ response: { code: 'M365_MAIL_DELIVERY_FAILED' } });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it.each(['a@example.invalid,b@example.invalid', 'test@example.invalid\r\nBcc: other@example.invalid'])('rejects recipient injection before transmission', async to => {
    const fetch = mock();
    await expect(new Microsoft365MailService(new ConfigService(settings)).send({ ...message, to })).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([
    { M365_MAIL_TENANT_ID: 'https://attacker.invalid' }, { M365_MAIL_CLIENT_ID: '' }, { M365_MAIL_CLIENT_SECRET: '' },
  ])('rejects incomplete or unsafe config before transmission: %j', async overrides => {
    const fetch = mock();
    await expect(new Microsoft365MailService(new ConfigService({ ...settings, ...overrides })).send(message)).rejects.toMatchObject({ response: { code: 'M365_MAIL_CONFIGURATION_PENDING' } });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('does not silently fallback when Graph config is missing or provider is misspelled', async () => {
    const fetch = mock(), webhook = { CONTACT_VERIFICATION_EMAIL_WEBHOOK_URL: 'https://example.invalid/send', CONTACT_VERIFICATION_EMAIL_WEBHOOK_TOKEN: 'TEST' };
    await expect(new ContactVerificationEmailService(new ConfigService({ ...webhook, TRANSACTIONAL_EMAIL_PROVIDER: 'microsoft365_graph' })).send(message.to, '123456')).rejects.toMatchObject({ response: { code: 'EMAIL_PROVIDER_CONFIGURATION_PENDING' } });
    await expect(new PasswordResetEmailService(new ConfigService({ TRANSACTIONAL_EMAIL_PROVIDER: 'microsoft365_graph' })).send({to:message.to,resetUrl:'https://stage.ucell.life/reset-password'})).rejects.toMatchObject({ response: { code: 'PASSWORD_RESET_EMAIL_PROVIDER_NOT_CONFIGURED' } });
    expect(() => new Microsoft365MailService(new ConfigService({ TRANSACTIONAL_EMAIL_PROVIDER: 'microsft365_graph' })).isSelected()).toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('delivers verification and reset templates with their existing error contracts', async () => {
    const fetch = mock();
    const verification = new ContactVerificationEmailService(new ConfigService(settings));
    await verification.send(message.to, '123456');
    const verifyBody = JSON.parse(fetch.mock.calls[1][1].body).message;
    expect(verifyBody.subject).toContain('驗證碼'); expect(verifyBody.body.content).toContain('123456'); expect(verifyBody.body.content).toContain('5 分鐘');
    const reset = new PasswordResetEmailService(new ConfigService(settings));
    await reset.send({ to: message.to, resetUrl: 'https://stage.ucell.life/reset-password?token=TEST_ONLY' });
    expect(JSON.parse(fetch.mock.calls[3][1].body).message.body.content).toContain('https://stage.ucell.life/reset-password?token=TEST_ONLY');
    fetch.mockResolvedValueOnce(new Response(null, { status: 403 }));
    await expect(verification.send(message.to, '123456')).rejects.toMatchObject({ response: { code: 'EMAIL_DELIVERY_FAILED' } });
    fetch.mockResolvedValueOnce(new Response(null, { status: 403 }));
    await expect(reset.send({ to: message.to, resetUrl: 'https://stage.ucell.life/reset-password' })).rejects.toMatchObject({ response: { code: 'PASSWORD_RESET_EMAIL_DELIVERY_FAILED' } });
  });
});
