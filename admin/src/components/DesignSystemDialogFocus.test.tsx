import {afterEach,expect,it,vi} from 'vitest';
import {act,create} from 'react-test-renderer';
import {ConfirmDialog,DetailDrawer,LoadingState} from '@ucell/design-system';

let restoreGlobals=()=>{};
afterEach(()=>restoreGlobals());

function installFocusTarget(){
 const documentDescriptor=Object.getOwnPropertyDescriptor(globalThis,'document');
 const elementDescriptor=Object.getOwnPropertyDescriptor(globalThis,'HTMLElement');
 class FocusTarget{isConnected=true;focus=vi.fn()}
 const target=new FocusTarget();
 Object.defineProperty(globalThis,'HTMLElement',{configurable:true,value:FocusTarget});
 Object.defineProperty(globalThis,'document',{configurable:true,value:{activeElement:target}});
 restoreGlobals=()=>{
  if(documentDescriptor)Object.defineProperty(globalThis,'document',documentDescriptor);else delete (globalThis as Record<string,unknown>).document;
  if(elementDescriptor)Object.defineProperty(globalThis,'HTMLElement',elementDescriptor);else delete (globalThis as Record<string,unknown>).HTMLElement;
  restoreGlobals=()=>{};
 };
 return target;
}

function dialogMock(){
 const dialog={open:false,showModal:vi.fn(),close:vi.fn()};
 dialog.showModal.mockImplementation(()=>{dialog.open=true});
 dialog.close.mockImplementation(()=>{dialog.open=false});
 return dialog;
}

it('restores the DetailDrawer trigger focus after closing',()=>{
 const target=installFocusTarget(),dialog=dialogMock();let tree:ReturnType<typeof create>;
 act(()=>{tree=create(<DetailDrawer open title="明細" onClose={vi.fn()}>內容</DetailDrawer>,{createNodeMock:node=>node.type==='dialog'?dialog:{}})});
 act(()=>tree!.update(<DetailDrawer open={false} title="明細" onClose={vi.fn()}>內容</DetailDrawer>));
 expect(dialog.showModal).toHaveBeenCalledOnce();expect(dialog.close).toHaveBeenCalledOnce();expect(target.focus).toHaveBeenCalledWith({preventScroll:true});
 act(()=>tree!.unmount());
});

it('restores the ConfirmDialog trigger focus after closing',()=>{
 const target=installFocusTarget(),dialog=dialogMock();let tree:ReturnType<typeof create>;
 act(()=>{tree=create(<ConfirmDialog open title="確認" onCancel={vi.fn()} onConfirm={vi.fn()}/>,{createNodeMock:node=>node.type==='dialog'?dialog:node.type==='input'?{value:''}:{}})});
 act(()=>tree!.update(<ConfirmDialog open={false} title="確認" onCancel={vi.fn()} onConfirm={vi.fn()}/>));
 expect(dialog.showModal).toHaveBeenCalledOnce();expect(dialog.close).toHaveBeenCalledOnce();expect(target.focus).toHaveBeenCalledWith({preventScroll:true});
 act(()=>tree!.unmount());
});

it('does not focus a removed dialog trigger',()=>{
 const target=installFocusTarget(),dialog=dialogMock();let tree:ReturnType<typeof create>;
 act(()=>{tree=create(<DetailDrawer open title="明細" onClose={vi.fn()}>內容</DetailDrawer>,{createNodeMock:node=>node.type==='dialog'?dialog:{}})});
 target.isConnected=false;
 act(()=>tree!.update(<DetailDrawer open={false} title="明細" onClose={vi.fn()}>內容</DetailDrawer>));
 expect(target.focus).not.toHaveBeenCalled();
 act(()=>tree!.unmount());
});

it('marks a loading state as busy for assistive technology',()=>{
 const tree=create(<LoadingState label="正在載入 Ball 360…"/>);
 expect(tree.root.findByProps({role:'status'}).props['aria-busy']).toBe('true');
 act(()=>tree.unmount());
});
