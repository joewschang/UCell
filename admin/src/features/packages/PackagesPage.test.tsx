import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {act,create} from 'react-test-renderer';
import {beforeEach,expect,it,vi} from 'vitest';
import {get} from '../../lib/api';
import {PackagesPage} from './PackagesPage';

vi.mock('../../lib/api',()=>({get:vi.fn()}));
beforeEach(()=>vi.mocked(get).mockReset());

it('renders Core package versions and evidence without calculating monetary values',async()=>{
 vi.mocked(get).mockResolvedValue({data:[{packageProfileId:'profile-1',stableCode:'QUALIFICATION_STARTER',packageClass:'QUALIFICATION',status:'ACTIVE',versions:[{packageProfileVersionId:'version-1',version:2,displayName:'正式會員套組',currency:'TWD',priceAmount:'4800.00',selectableProductQuantity:2,selectionMode:'EXACT_QUANTITY',membershipEffect:'FORMAL_MEMBER',qualificationEffect:'CREATE_QUALIFICATION',targetQualificationRequired:false,status:'ACTIVE',effectiveFrom:'2026-09-17T00:00:00.000Z',effectiveTo:null,salesFrom:'2026-09-17T00:00:00.000Z',salesTo:null,approvalReference:'APPROVAL-001',configHash:'a'.repeat(64),selectableProducts:[{productRuleProfileId:'rule-1',minQty:1,maxQty:2,selectionIncrement:1,sortOrder:1,status:'ACTIVE'}]}]}]});
 let tree:ReturnType<typeof create>;await act(async()=>{tree=create(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><PackagesPage/></QueryClientProvider>);await new Promise(resolve=>setTimeout(resolve,20));});
 const rendered=JSON.stringify(tree!.toJSON());expect(get).toHaveBeenCalledWith('/admin/packages');expect(rendered).toContain('正式會員套組');expect(rendered).toContain('4800.00');expect(rendered).toContain('EXACT_QUANTITY');expect(rendered).toContain('APPROVAL-001');expect(rendered).toContain('Core authoritative');expect(rendered).not.toContain('PV =');act(()=>tree!.unmount());
});
