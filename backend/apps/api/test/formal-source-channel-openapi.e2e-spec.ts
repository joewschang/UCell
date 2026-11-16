import 'reflect-metadata';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {AdminFormalMemberApplicationController} from '../src/modules/member/admin-formal-member-application.controller';
describe('Formal application sourceChannel compatibility',()=>{
 it('documents sourceChannel as optional',()=>{
  const parameters=Reflect.getMetadata('swagger/apiParameters',AdminFormalMemberApplicationController.prototype.list);
  expect(parameters.find((p:any)=>p.name==='sourceChannel')).toMatchObject({in:'query',required:false});
  const spec=JSON.parse(readFileSync(resolve(__dirname,'../../../openapi.generated.json'),'utf8'));
  expect(spec.paths['/api/v1/admin/formal-member-applications'].get.parameters.find((p:any)=>p.name==='sourceChannel')).toMatchObject({in:'query',required:false});
 });
 it('preserves the legacy queue without sourceChannel',()=>{
  const service={adminList:jest.fn(()=>[]),directory:jest.fn()};
  new AdminFormalMemberApplicationController(service as any,{} as any,{} as any).list();
  expect(service.adminList).toHaveBeenCalledWith({status:undefined,take:50});
  expect(service.directory).not.toHaveBeenCalled();
 });
 it('accepts directory queries with and without optional source filter',()=>{
  const service={adminList:jest.fn(),directory:jest.fn(()=>[])};
  const controller=new AdminFormalMemberApplicationController(service as any,{} as any,{} as any);
  controller.list(undefined,undefined,undefined,'1');
  expect(service.directory).toHaveBeenLastCalledWith({page:'1',take:undefined,status:undefined,sourceChannel:undefined,q:undefined});
  controller.list(undefined,undefined,'ADMIN_PAPER','1');
  expect(service.directory).toHaveBeenLastCalledWith({page:'1',take:undefined,status:undefined,sourceChannel:'ADMIN_PAPER',q:undefined});
 });
});
