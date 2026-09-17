import {
  assertProviderWebhookInboxTransition,
  type ProviderWebhookInboxStatus,
} from '../src/modules/commerce/provider-webhook-inbox-state';

describe('Provider webhook inbox lifecycle', () => {
  it.each<[ProviderWebhookInboxStatus, ProviderWebhookInboxStatus]>([
    ['RECEIVED', 'VERIFIED'], ['RECEIVED', 'REJECTED'],
    ['VERIFIED', 'PROCESSING'], ['VERIFIED', 'MANUAL_REVIEW'],
    ['PROCESSING', 'PROCESSED'], ['PROCESSING', 'RETRY_PENDING'], ['PROCESSING', 'MANUAL_REVIEW'],
    ['RETRY_PENDING', 'PROCESSING'], ['RETRY_PENDING', 'MANUAL_REVIEW'],
    ['MANUAL_REVIEW', 'PROCESSING'],
  ])('allows %s -> %s', (from, to) => {
    expect(() => assertProviderWebhookInboxTransition(from, to, 1)).not.toThrow();
  });

  it.each<ProviderWebhookInboxStatus>([
    'RECEIVED', 'VERIFIED', 'REJECTED', 'PROCESSING', 'PROCESSED', 'RETRY_PENDING', 'MANUAL_REVIEW',
  ])('allows same-status compare-and-set metadata writes for %s', status => {
    expect(() => assertProviderWebhookInboxTransition(status, status, 0)).not.toThrow();
  });

  it.each<[ProviderWebhookInboxStatus, ProviderWebhookInboxStatus]>([
    ['VERIFIED', 'RECEIVED'], ['REJECTED', 'RECEIVED'], ['REJECTED', 'VERIFIED'],
    ['PROCESSING', 'VERIFIED'], ['PROCESSING', 'RECEIVED'],
    ['PROCESSED', 'PROCESSING'], ['PROCESSED', 'RETRY_PENDING'], ['PROCESSED', 'VERIFIED'],
    ['RETRY_PENDING', 'PROCESSED'], ['MANUAL_REVIEW', 'PROCESSED'],
  ])('rejects %s -> %s', (from, to) => {
    expect(() => assertProviderWebhookInboxTransition(from, to, 1))
      .toThrow(expect.objectContaining({ code: 'PROVIDER_WEBHOOK_STATUS_TRANSITION_INVALID' }));
  });

  it.each([-1, -2, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid attempt count %s', attemptCount => {
    expect(() => assertProviderWebhookInboxTransition('PROCESSING', 'RETRY_PENDING', attemptCount))
      .toThrow(expect.objectContaining({ code: 'PROVIDER_WEBHOOK_ATTEMPT_COUNT_INVALID' }));
  });
});
