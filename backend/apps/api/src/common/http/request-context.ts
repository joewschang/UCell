export interface UCellRequestContext {
  requestId: string;
  correlationId: string;
  actorType: 'USER' | 'SYSTEM' | 'JOB' | 'INTEGRATION';
  actorId?: string;
  personId?: string;
  qualificationId?: string;
}
