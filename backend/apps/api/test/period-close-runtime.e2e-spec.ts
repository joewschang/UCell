jest.mock('@ucell/database',()=>({...jest.requireActual('@ucell/database'),claimPeriodCloseJob:jest.fn(),processPeriodCloseJob:jest.fn(),releaseFailedOutboxLease:jest.fn()}));
import {claimPeriodCloseJob,processPeriodCloseJob,releaseFailedOutboxLease} from '@ucell/database';
import {pollPeriodCloseJobs} from '../../worker/src/period-close-runtime';
describe('period-close worker delivery controls',()=>{
  const job={periodCloseJobId:'job',periodEnd:new Date(),ruleVersionCode:'TEST'};
  let db:any;
  beforeEach(()=>{
    jest.clearAllMocks();db={$queryRaw:jest.fn(async()=>[{period_close_job_id:'job'}]),periodCloseJob:{findUniqueOrThrow:jest.fn(async()=>job)},outboxEvent:{count:jest.fn(async()=>0)},monthlyRecognitionSchedule:{count:jest.fn(async()=>0)}};
    (claimPeriodCloseJob as jest.Mock).mockResolvedValue({outboxEventId:'outbox'});
    (processPeriodCloseJob as jest.Mock).mockImplementation(async(_db,_lease,work)=>{await work(db,job);return {snapshotId:'sealed'};});
    (releaseFailedOutboxLease as jest.Mock).mockResolvedValue({count:1});
  });
  it('is off by default and rejects malformed enablement',async()=>{
    expect((await pollPeriodCloseJobs(db,{})).enabled).toBe(false);expect(db.$queryRaw).not.toHaveBeenCalled();
    await expect(pollPeriodCloseJobs(db,{PERIOD_CLOSE_WORKER_ENABLED:'yes'})).rejects.toThrow('PERIOD_CLOSE_ENABLEMENT_INVALID');
  });
  it.each(['outboxEvent','monthlyRecognitionSchedule'])('does not claim while %s inputs remain pending',async model=>{
    db[model].count.mockResolvedValue(1);
    expect((await pollPeriodCloseJobs(db,{PERIOD_CLOSE_WORKER_ENABLED:'true'})).blocked).toBe(1);
    expect(claimPeriodCloseJob).not.toHaveBeenCalled();
  });
  it('passes its fenced transaction to the executor and records success',async()=>{
    const execute=jest.fn(async()=>'source');
    expect((await pollPeriodCloseJobs(db,{PERIOD_CLOSE_WORKER_ENABLED:'true'},execute)).completed).toBe(1);
    expect(execute).toHaveBeenCalledWith(db,job);expect(releaseFailedOutboxLease).not.toHaveBeenCalled();
  });
  it('rechecks readiness inside the transaction and defers a newly blocked job',async()=>{
    db.outboxEvent.count.mockResolvedValueOnce(0).mockResolvedValue(1);
    const execute=jest.fn(async()=>'source');
    expect((await pollPeriodCloseJobs(db,{PERIOD_CLOSE_WORKER_ENABLED:'true'},execute)).failed).toBe(1);
    expect(execute).not.toHaveBeenCalled();expect(releaseFailedOutboxLease).toHaveBeenCalled();
  });
  it('releases failures with a safe error without exposing engine details',async()=>{
    const execute=jest.fn(async()=>{throw new Error('sensitive detail');});
    expect((await pollPeriodCloseJobs(db,{PERIOD_CLOSE_WORKER_ENABLED:'true'},execute)).failed).toBe(1);
    expect((releaseFailedOutboxLease as jest.Mock).mock.calls[0][2].message).toBe('PERIOD_CLOSE_EXECUTION_FAILED');
  });
});
