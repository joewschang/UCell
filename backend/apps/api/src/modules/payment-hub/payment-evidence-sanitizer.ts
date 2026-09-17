export type SafePaymentEvidenceValue =
  | string
  | number
  | boolean
  | null
  | SafePaymentEvidenceValue[]
  | { [key: string]: SafePaymentEvidenceValue };

export class PaymentEvidenceSecurityError extends Error {
  constructor(
    readonly code: 'CARDHOLDER_DATA_FORBIDDEN' | 'PAYMENT_EVIDENCE_UNSUPPORTED_VALUE',
    message: string,
  ) {
    super(message);
    this.name = 'PaymentEvidenceSecurityError';
  }
}

const forbiddenCardKeys = new Set([
  'pan',
  'cardnumber',
  'creditcardnumber',
  'debitcardnumber',
  'cvv',
  'cvc',
  'cvv2',
  'cvc2',
  'cardsecuritycode',
  'track1',
  'track2',
  'trackdata',
  'fulltrackdata',
  'magstripe',
]);

const identifierKeys = new Set([
  'batchref',
  'correlationid',
  'ordernumber',
  'paymentid',
  'providereventid',
  'providertransactionref',
  'terminalref',
]);

const secretKeys = new Set([
  'authorization',
  'apikey',
  'clientsecret',
  'merchantsecret',
  'password',
  'privatekey',
  'signature',
  'signatureraw',
  'token',
  'webhooksecret',
]);

function normalizedKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function containsLikelyPan(value: string): boolean {
  const candidates = value.match(/(?:\d[ -]?){13,19}/g) ?? [];
  return candidates.some((candidate) => {
    const digits = candidate.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19 || /^(\d)\1+$/.test(digits)) return false;
    let sum = 0;
    let doubleDigit = false;
    for (let index = digits.length - 1; index >= 0; index -= 1) {
      let digit = Number(digits[index]);
      if (doubleDigit) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      doubleDigit = !doubleDigit;
    }
    return sum % 10 === 0;
  });
}

export function sanitizePaymentEvidenceMetadata(
  input: Readonly<Record<string, unknown>>,
): { [key: string]: SafePaymentEvidenceValue } {
  return sanitizeObject(input, '$');
}

function sanitizeObject(
  input: Readonly<Record<string, unknown>>,
  path: string,
): { [key: string]: SafePaymentEvidenceValue } {
  const output: { [key: string]: SafePaymentEvidenceValue } = {};
  for (const [key, value] of Object.entries(input)) {
    const normalized = normalizedKey(key);
    if (forbiddenCardKeys.has(normalized)) {
      throw new PaymentEvidenceSecurityError(
        'CARDHOLDER_DATA_FORBIDDEN',
        `Cardholder data field is forbidden in payment evidence metadata at ${path}.${key}.`,
      );
    }
    if (secretKeys.has(normalized)) {
      output[key] = '[REDACTED]';
      continue;
    }
    output[key] = sanitizeValue(value, `${path}.${key}`, identifierKeys.has(normalized));
  }
  return output;
}

function sanitizeValue(value: unknown, path: string, identifier = false): SafePaymentEvidenceValue {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') {
    if (!identifier && containsLikelyPan(value)) {
      throw new PaymentEvidenceSecurityError(
        'CARDHOLDER_DATA_FORBIDDEN',
        `Likely card PAN is forbidden in payment evidence metadata at ${path}.`,
      );
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((item, index) => sanitizeValue(item, `${path}[${index}]`, identifier));
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return sanitizeObject(value as Readonly<Record<string, unknown>>, path);
  }
  throw new PaymentEvidenceSecurityError(
    'PAYMENT_EVIDENCE_UNSUPPORTED_VALUE',
    `Unsupported payment evidence value at ${path}.`,
  );
}
