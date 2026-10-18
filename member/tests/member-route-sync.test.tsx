import {useEffect} from 'react';
import {act,create} from 'react-test-renderer';
import {MemoryRouter,useNavigate,useLocation} from 'react-router-dom';
import {afterEach,expect,it,vi} from 'vitest';
import {syncMemberLocation} from '../src/memberRouteSync';
afterEach(()=>vi.unstubAllGlobals());
it.each(['/me','/events?event=UAT_EVENT','/shop','/faq'])('renders the restored %s destination instead of the callback home',async target=>{
 const url=new URL(target,'https://stage.ucell.life');vi.stubGlobal('window',{location:url});
 function Callback(){const nav=useNavigate(),loc=useLocation();useEffect(()=>syncMemberLocation(nav),[]);return <output>{loc.pathname+loc.search}</output>;}
 let tree:ReturnType<typeof create>;await act(async()=>{tree=create(<MemoryRouter initialEntries={['/']}><Callback/></MemoryRouter>)});
 expect(tree!.root.findByType('output').children.join('')).toBe(target);act(()=>tree!.unmount());
});
