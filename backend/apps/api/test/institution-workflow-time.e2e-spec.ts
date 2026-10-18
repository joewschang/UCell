import { QualificationWorkflowController } from '../src/modules/qualification/qualification-workflow.controller';
import { QualificationWorkflowService } from '../src/modules/qualification/qualification-workflow.service';
describe('Institution workflow invalid approval time is rejected before writes', () => {
  it.each(['', 'not-a-date', '2026-99-99'])('HTTP effectiveAt=%j cannot become an immediate approval or a database error', async effectiveAt => {
    const transaction = jest.fn();
    const service = new QualificationWorkflowService({ $transaction: transaction } as any, {} as any);
    const controller = new QualificationWorkflowController(service);
    await expect(controller.approve('synthetic-workflow', { effectiveAt }, {})).rejects.toMatchObject({
      status: 422, message: 'WORKFLOW_EFFECTIVE_TIME_INVALID',
    });
    expect(transaction).not.toHaveBeenCalled();
  });
});
