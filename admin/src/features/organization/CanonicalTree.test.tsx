import React from 'react';
import {act,create} from 'react-test-renderer';
import {expect,it} from 'vitest';
import {CanonicalTree,authoritativeActiveLabel,hasApprovedLeaderCompanyBinding,type CanonicalPosition} from './CanonicalTree';

function position(overrides:Partial<CanonicalPosition>={}):CanonicalPosition{
 return {
  positionNo:1,ballNo:'TREE-A000001',binaryPositionNo:'1',path:'',qualificationId:'opaque-id',ownerType:'COMPANY',activeLabel:'Always Active (Company Rule)',
  companyProfile:{status:'AVAILABLE',planCode:'LEADER',profileVersion:'COMPANY_BOOTSTRAP_PROFILE_V1'},parentPositionNo:null,side:null,
  ...overrides
 };
}

it('shows LEADER only from a complete server binding at a bootstrap position',()=>{
 const approved=position();
 expect(hasApprovedLeaderCompanyBinding(approved)).toBe(true);
 expect(authoritativeActiveLabel(approved)).toBe('Always Active (Company Rule)');

 for(const unavailable of [
  position({companyProfile:null}),
  position({companyProfile:{status:'UNAVAILABLE',planCode:null,profileVersion:null}}),
  position({companyProfile:{status:'AVAILABLE',planCode:'LEADER',profileVersion:null}}),
  position({ballNo:null})
 ]){
  expect(hasApprovedLeaderCompanyBinding(unavailable)).toBe(false);
  expect(authoritativeActiveLabel(unavailable)).toBe('Always Active (Company Rule)');
 }
});

it('keeps Company-held Member-origin Balls Always Active without turning them into LEADER',()=>{
 const memberOriginHeldByCompany=position({positionNo:4,companyProfile:null});
 const nonBootstrapWithBinding=position({positionNo:4});
 const forgedMemberProfile=position({positionNo:4,ownerType:'MEMBER'});
 expect(hasApprovedLeaderCompanyBinding(memberOriginHeldByCompany)).toBe(false);
 expect(authoritativeActiveLabel(memberOriginHeldByCompany)).toBe('Always Active (Company Rule)');
 expect(hasApprovedLeaderCompanyBinding(nonBootstrapWithBinding)).toBe(false);
 expect(authoritativeActiveLabel(nonBootstrapWithBinding)).toBe('Always Active (Company Rule)');
 expect(hasApprovedLeaderCompanyBinding(forgedMemberProfile)).toBe(false);
 expect(authoritativeActiveLabel(forgedMemberProfile)).toBeNull();
});

it('fails closed when a Qualification occupies a position but its Ball Number is unavailable',()=>{
 let view:ReturnType<typeof create>;
 act(()=>{view=create(<CanonicalTree positions={[position({positionNo:4,ballNo:null,companyProfile:null,ownerType:null,activeLabel:null})]} onSelect={()=>{}}/>);});
 const button=view!.root.findByType('button'),output=JSON.stringify(view!.toJSON());
 expect(output).toContain('資格已占用 · Ball Number 證據未提供');
 expect(output).toContain('Ball Number 證據未提供');
 expect(output).not.toContain('AVAILABLE');
 expect(String(button.props['aria-label'])).toContain('Ball Number 證據未提供');
 expect(button.props.title).toBe('Ball Number 證據未提供');
 act(()=>view!.unmount());
});
