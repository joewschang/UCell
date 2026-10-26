import React from 'react';
import {act,create} from 'react-test-renderer';
import {it,expect,vi,afterEach} from 'vitest';
import {StoredEnrollmentDocument} from '../src/StoredEnrollmentDocument';
import {getFormalDocuments} from '../src/memberData';
import {api} from '../src/api';
vi.mock('../src/memberData',()=>({getFormalDocuments:vi.fn()}));
vi.mock('../src/api',()=>({api:vi.fn()}));
afterEach(()=>vi.restoreAllMocks());
it('loads only current stored photos on demand and revokes the private preview on close',async()=>{
 vi.mocked(getFormalDocuments).mockResolvedValue({documents:[{id:'old',type:'IDENTITY_FRONT',status:'SUPERSEDED'},{id:'current',type:'IDENTITY_FRONT',status:'PRESENT'}]} as any);
 vi.mocked(api).mockResolvedValue(new Blob(['image'],{type:'image/png'}));
 const createUrl=vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:private-photo'),revoke=vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{});
 let tree:any;await act(async()=>{tree=create(<StoredEnrollmentDocument applicationId="app" type="IDENTITY_FRONT"/>)});
 expect(tree.root.findAllByType('img')).toHaveLength(0);
 await act(async()=>tree.root.findByType('button').props.onClick());
 expect(api).toHaveBeenCalledWith('/member/formal-applications/app/documents/current/content',expect.objectContaining({responseType:'blob'}));
 expect(tree.root.findByType('img').props.src).toBe('blob:private-photo');expect(createUrl).toHaveBeenCalledOnce();
 await act(async()=>tree.root.findByType('button').props.onClick());expect(revoke).toHaveBeenCalledWith('blob:private-photo');
 act(()=>tree.unmount());
});
it('shows retrieval failures and allows retry without clearing application inputs',async()=>{
 vi.mocked(getFormalDocuments).mockRejectedValueOnce(new Error('照片讀取失敗'));
 let tree:any;await act(async()=>{tree=create(<StoredEnrollmentDocument applicationId="app" type="BANKBOOK_COVER"/>)});
 await act(async()=>tree.root.findByType('button').props.onClick());
 expect(tree.root.findByProps({role:'alert'}).children.join('')).toBe('照片讀取失敗');
 expect(tree.root.findByType('button').props.disabled).toBe(false);act(()=>tree.unmount());
});
