export const API_VERSION = 'v1';

export * from './calendar/calendar';
export * from './ai-ready/catalog';
export * from './ai-ready/read-gateway';

export const ErrorCodes = {
  AmbiguousQualification: 'AMBIGUOUS_QUALIFICATION',
  QualificationNotOwned: 'QUALIFICATION_NOT_OWNED',
  IdempotencyConflict: 'IDEMPOTENCY_CONFLICT',
  BinarySlotOccupied: 'BINARY_SLOT_OCCUPIED',
  BinaryLeftSubtreeRequired: 'BINARY_LEFT_SUBTREE_REQUIRED',
  RuleVersionImmutable: 'RULE_VERSION_IMMUTABLE',
} as const;
