import {Test} from '@nestjs/testing';
import {ValidationPipe} from '@nestjs/common';
import {FastifyAdapter,NestFastifyApplication} from '@nestjs/platform-fastify';
import {PeriodProjectionController} from '../src/modules/analytics/period-projection.controller';
import {PeriodProjectionService} from '../src/modules/analytics/period-projection.service';
import {PeriodExportService} from '../src/modules/analytics/period-export.service';
import {EnvelopeInterceptor} from '../src/common/interceptors/envelope.interceptor';
import {ApiExceptionFilter} from '../src/common/filters/api-exception.filter';
const id='11111111-1111-4111-8111-111111111111';
describe('Period Analytics HTTP serialization contract (authorization has separate DB tests)',()=>{
 let app:NestFastifyApplication;
 const projections={read:jest.fn(async()=>({status:'UNAVAILABLE',projectionStatus:'STALE',result:null,snapshot:null,nextCursor:null,dataThrough:null,definitionVersion:'1'}))};
 const exports={status:jest.fn(async()=>({status:'COMPLETED'})),download:jest.fn(async function*(){yield Buffer.from('name,value\r\n');yield Buffer.from('"synthetic","42"\r\n');})};
 beforeAll(async()=>{
  const module=await Test.createTestingModule({controllers:[PeriodProjectionController],providers:[{provide:PeriodProjectionService,useValue:projections},{provide:PeriodExportService,useValue:exports}]}).compile();
  app=module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(),{logger:false});
  app.setGlobalPrefix('api/v1');app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));
  app.useGlobalInterceptors(new EnvelopeInterceptor());app.useGlobalFilters(new ApiExceptionFilter());
  await app.init();await app.getHttpAdapter().getInstance().ready();
 });
 afterAll(()=>app?.close());
 it('streams actual CSV bytes through the production envelope interceptor',async()=>{
  const res=await app.inject({method:'GET',url:'/api/v1/admin/analytics/period-projections/exports/'+id+'/file'});
  expect(res.statusCode).toBe(200);expect(res.headers['content-type']).toContain('text/csv');
  expect(res.headers['cache-control']).toBe('private, no-store');
  expect(res.headers['content-disposition']).toContain(id+'.csv');
  expect(res.body).toBe('name,value\r\n"synthetic","42"\r\n');
 });
 it('wraps projection evidence in the standard data/meta HTTP envelope',async()=>{
  const res=await app.inject({method:'POST',url:'/api/v1/admin/analytics/period-projections/query',payload:{query:{}}});
  expect(res.statusCode).toBe(201);
  expect(res.json()).toMatchObject({data:{status:'UNAVAILABLE',projectionStatus:'STALE',result:null},meta:{api_version:'v1'}});
 });
 it('rejects malformed UUID and unknown top-level DTO fields before service access',async()=>{
  const before=exports.status.mock.calls.length;
  expect((await app.inject({method:'GET',url:'/api/v1/admin/analytics/period-projections/exports/not-a-uuid/file'})).statusCode).toBe(400);
  expect(exports.status.mock.calls.length).toBe(before);
  expect((await app.inject({method:'POST',url:'/api/v1/admin/analytics/period-projections/query',payload:{query:{},sql:'select 1'}})).statusCode).toBe(400);
 });
 it('returns expired and not-ready errors without streaming data',async()=>{
  exports.status.mockResolvedValueOnce({status:'EXPIRED'});
  expect((await app.inject({method:'GET',url:'/api/v1/admin/analytics/period-projections/exports/'+id+'/file'})).statusCode).toBe(410);
  exports.status.mockResolvedValueOnce({status:'RUNNING'});
  expect((await app.inject({method:'GET',url:'/api/v1/admin/analytics/period-projections/exports/'+id+'/file'})).statusCode).toBe(409);
 });
});
