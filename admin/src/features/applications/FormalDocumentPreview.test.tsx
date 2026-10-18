import React from 'react';
import {act,create} from 'react-test-renderer';
import {it,expect,vi} from 'vitest';
import {FormalDocumentPreview} from './FormalDocumentPreview';
import {getBlob} from '../../lib/api';
vi.mock('../../lib/api',()=>({getBlob:vi.fn(async()=>new Blob(['test'],{type:'image/png'}))}));
it('loads only clean documents on demand and releases their temporary URL',async()=>{
 const createUrl=vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:test'),revoke=vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{});let tree:any;
 try{await act(async()=>{tree=create(<FormalDocumentPreview document={{id:'DOC',type:'IDENTITY_FRONT',status:'PRESENT',scanStatus:'PENDING'}}/>)});
 expect(tree.root.findByType('button').props.disabled).toBe(false);expect(getBlob).not.toHaveBeenCalled();
 await act(async()=>tree.update(<FormalDocumentPreview document={{id:'DOC',type:'IDENTITY_FRONT',status:'PRESENT',scanStatus:'PENDING'}}/>));
 await act(async()=>tree.root.findByType('button').props.onClick());expect(getBlob).toHaveBeenCalledWith('/admin/formal-member-applications/documents/DOC/content');expect(tree.root.findByType('img').props.src).toBe('blob:test');
 act(()=>tree.unmount());expect(revoke).toHaveBeenCalledWith('blob:test');}finally{createUrl.mockRestore();revoke.mockRestore();vi.clearAllMocks();}
});

it('automatically loads a clean photo when opening comparison',async()=>{
 const c=vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:auto'),v=vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{});let tree:any;
 try{await act(async()=>{tree=create(<FormalDocumentPreview autoLoad document={{id:'AUTO',type:'BANKBOOK_COVER',status:'PRESENT',scanStatus:'CLEAN'}}/>)});expect(getBlob).toHaveBeenCalledWith('/admin/formal-member-applications/documents/AUTO/content');expect(tree.root.findByType('img').props.src).toBe('blob:auto');act(()=>tree.unmount());}finally{c.mockRestore();v.mockRestore();vi.clearAllMocks();}
});

it('opens a private paper PDF using an authenticated blob instead of a public URL',async()=>{vi.mocked(getBlob).mockResolvedValueOnce(new Blob(['%PDF'],{type:'application/pdf'}));const c=vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:pdf'),r=vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{});let tree:any;try{await act(async()=>{tree=create(<FormalDocumentPreview autoLoad document={{id:'PDF',type:'SIGNED_APPLICATION_AGREEMENT',status:'PRESENT',scanStatus:'PENDING',mimeType:'application/pdf'}}/>)});expect(tree.root.findByType('a').props.href).toBe('blob:pdf');expect(tree.root.findByType('a').props.rel).toContain('noopener');expect(tree.root.findAllByType('img')).toHaveLength(0);act(()=>tree.unmount());expect(r).toHaveBeenCalledWith('blob:pdf');}finally{c.mockRestore();r.mockRestore();vi.clearAllMocks();}});
