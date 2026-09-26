import { PrismaService } from '@ucell/database';
import { randomUUID } from 'node:crypto';

const url=process.env.PHASE2_TEST_DATABASE_URL;
if(!url||!/^ucell_jest_[a-f0-9]{32}$/.test(new URL(url).pathname.slice(1))) throw Error('ISOLATED_DATABASE_REQUIRED');

describe('G8 AuditEvent core persistence',()=>{
  const db=new PrismaService();
  afterAll(()=>db.$disconnect());
  it('defaults event/trace evidence and rejects rewrite or deletion',async()=>{
    const correlationId=randomUUID();
    const event=await db.auditEvent.create({data:{actorType:'SYSTEM',action:'G8_AUDIT_CORE_TEST',entityType:'G8_TEST',requestId:'g8-audit-test',correlationId}});
    expect(event.eventCode).toBe('G8_AUDIT_CORE_TEST');
    expect(event.traceId).toBe(correlationId);
    expect(event.result).toBe('SUCCESS');
    expect(event.changedFieldNames).toEqual([]);
    await expect(db.auditEvent.update({where:{auditEventId:event.auditEventId},data:{action:'MUTATED'}})).rejects.toThrow(/append-only/i);
    await expect(db.auditEvent.delete({where:{auditEventId:event.auditEventId}})).rejects.toThrow(/append-only/i);
  });
});
