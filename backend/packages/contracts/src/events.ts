export interface SaleConfirmedEvent {
  eventType: 'SALE_CONFIRMED';
  externalSystem: 'MANUAL' | 'D365_BC' | 'PAYMENT';
  externalEventId: string;
  orderId: string;
  qualificationId: string;
  amount: string;
  occurredAt: string;
  ruleVersionId?: string;
  correlationId: string;
}

export interface ReturnConfirmedEvent {
  eventType: 'RETURN_CONFIRMED';
  externalSystem: 'MANUAL' | 'D365_BC';
  externalEventId: string;
  returnId: string;
  originalOrderId: string;
  qualificationId: string;
  amount?: string;
  occurredAt: string;
  correlationId: string;
}
