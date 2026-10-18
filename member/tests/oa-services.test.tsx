import {act,create} from 'react-test-renderer';
import {MemoryRouter} from 'react-router-dom';
import {expect,it} from 'vitest';
import Faq from '../src/Faq';
it('filters FAQ answers and exposes an honest no-match state',()=>{
 const tree=create(<MemoryRouter><Faq/></MemoryRouter>);
 act(()=>tree.root.findByType('input').props.onChange({target:{value:'報到憑證'}}));
 expect(tree.root.findAllByType('details')).toHaveLength(1);
 expect(tree.root.findAllByType('a').some(a=>a.props.href==='/events')).toBe(true);
 act(()=>tree.root.findByType('input').props.onChange({target:{value:'不存在的搜尋'}}));
 expect(tree.root.findAllByType('details')).toHaveLength(0);
 expect(tree.root.findByProps({role:'status'}).children.join('')).toContain('找不到');tree.unmount();
});
