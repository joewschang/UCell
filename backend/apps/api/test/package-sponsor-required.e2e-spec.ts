import {OrderService} from '../src/modules/order/order.service';
import {UnprocessableEntityException} from '@nestjs/common';
function harness(){
 const tx:any={person:{findUnique:jest.fn(async()=>({status:'EFFECTIVE'}))},qualification:{create:jest.fn(async()=>{throw new Error('REACHED_QUALIFICATION_CREATE');})},order:{create:jest.fn()}};
 const packages={checkoutData:jest.fn(async()=>({version:{profile:{packageClass:'QUALIFICATION'}},pricing:{},selections:[]}))};
 const sponsors={resolveWithin:jest.fn(async()=>({kind:'BALL',sponsorQualificationId:'sponsor'}))};
 const service:any=new OrderService({} as any,{execute:async(_s:any,_k:any,_d:any,fn:any)=>fn(tx)} as any,{} as any,{} as any,packages as any,sponsors as any);
 return {tx,service,sponsors};
}
it.each([undefined,'','   '])('rejects missing online qualification sponsor before creating any qualification/order (%s)',async sponsorCode=>{
 const {service,tx,sponsors}=harness();await expect(service.createPackageForPerson({packageVersionId:'package',selections:[],sponsorCode},'key','request','person')).rejects.toMatchObject({response:{code:'QUALIFICATION_SPONSOR_REQUIRED'}});
 expect(tx.qualification.create).not.toHaveBeenCalled();expect(tx.order.create).not.toHaveBeenCalled();expect(sponsors.resolveWithin).not.toHaveBeenCalled();
});
it('resolves a provided sponsor server-side before qualification creation',async()=>{
 const {service,sponsors}=harness();await expect(service.createPackageForPerson({packageVersionId:'package',selections:[],sponsorCode:'A000001'},'key','request','person')).rejects.toThrow('REACHED_QUALIFICATION_CREATE');expect(sponsors.resolveWithin).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({code:'A000001'}));
});
it('rejects ineligible sponsors without creating a qualification',async()=>{
 const {service,sponsors,tx}=harness();sponsors.resolveWithin.mockRejectedValueOnce(new UnprocessableEntityException({code:'SPONSOR_CODE_INELIGIBLE'}));await expect(service.createPackageForPerson({packageVersionId:'package',selections:[],sponsorCode:'A000001'},'key','request','person')).rejects.toMatchObject({response:{code:'SPONSOR_CODE_INELIGIBLE'}});expect(tx.qualification.create).not.toHaveBeenCalled();
});
it('persists a ball number on the newly created draft before creating the order',async()=>{
 const {service,tx}=harness();
 tx.qualification.create.mockResolvedValueOnce({qualificationId:'new-q'} as never);
 tx.binaryTreeMembership={findUnique:jest.fn(async()=>({binaryTreeId:'tree-a'}))};
 tx.binaryTree={findUnique:jest.fn(async()=>({status:'ACTIVE'}))};
 tx.$queryRaw=jest.fn(async()=>[{ballNo:'A000002'}]);
 tx.qualification.update=jest.fn();
 tx.qualificationHolderHistory={create:jest.fn(async()=>{throw Error('REACHED_HOLDER_HISTORY');})};
 await expect(service.createPackageForPerson({packageVersionId:'package',selections:[],sponsorCode:'A000001'},'key','request','person')).rejects.toThrow('REACHED_HOLDER_HISTORY');
 expect(tx.qualification.create).toHaveBeenCalledWith({data:expect.objectContaining({status:'DRAFT',activeFlag:false})});
 expect(tx.qualification.update).toHaveBeenCalledWith({where:{qualificationId:'new-q'},data:{ballNo:'A000002'}});
 expect(tx.order.create).not.toHaveBeenCalled();
});
