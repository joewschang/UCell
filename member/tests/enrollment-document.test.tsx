import React from 'react';
import {act,create} from 'react-test-renderer';
import {it,expect,vi,afterEach} from 'vitest';
import {EnrollmentDocument} from '../src/EnrollmentDocument';
afterEach(()=>vi.restoreAllMocks());
it('immediately accepts the original image without OCR, rotation or keyword checks',async()=>{
 vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:photo');vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{});
 const file=new File(['any image bytes'],'photo.jpg',{type:'image/jpeg'}),onReady=vi.fn(),onSelect=vi.fn();let tree:any;
 await act(async()=>{tree=create(<EnrollmentDocument type="IDENTITY_FRONT" uploaded={false} disabled={false} onSelect={onSelect} onReady={onReady}/>)});
 await act(async()=>tree.root.findByType('input').props.onChange({target:{files:[file]}}));
 expect(onReady).toHaveBeenCalledWith(file);expect(onSelect).toHaveBeenCalledOnce();
 expect(JSON.stringify(tree.toJSON())).toContain('已選取照片，尚未上傳。');expect(JSON.stringify(tree.toJSON())).not.toMatch(/辨識|旋轉/);
 act(()=>tree.unmount());
});
it('keeps format and size validation with clear errors',async()=>{
 const onReady=vi.fn();let tree:any;
 await act(async()=>{tree=create(<EnrollmentDocument type="BANKBOOK_COVER" uploaded={false} disabled={false} onSelect={()=>{}} onReady={onReady}/>)});
 await act(async()=>tree.root.findByType('input').props.onChange({target:{files:[new File(['pdf'],'file.pdf',{type:'application/pdf'})]}}));
 expect(onReady).not.toHaveBeenCalled();expect(tree.root.findByProps({role:'alert'}).children.join('')).toContain('JPG 或 PNG');act(()=>tree.unmount());
});
