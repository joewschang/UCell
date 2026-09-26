import { HealthController } from '../src/modules/health/health.controller';

describe('G8 health readiness',()=>{
  it('reports database-backed readiness without returning connection details',async()=>{
    const controller=new HealthController({$queryRawUnsafe:jest.fn(async()=>[{ '?column?':1 }])} as any);
    await expect(controller.health()).resolves.toMatchObject({status:'ok',service:'ucell-api',database:'ok'});
  });
  it('fails closed when database connectivity is unavailable',async()=>{
    const controller=new HealthController({$queryRawUnsafe:jest.fn(async()=>{throw new Error('postgresql://secret')})} as any);
    await expect(controller.health()).rejects.toMatchObject({status:503,response:{code:'DATABASE_CONNECTIVITY_FAILED'}});
  });
});
