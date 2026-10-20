import React from 'react';
import {act,create} from 'react-test-renderer';
import {expect,it} from 'vitest';
import OrderList from '../src/OrderList';
it('filters and paginates loaded orders while retaining exact monetary text',()=>{
 const rows=Array.from({length:23},(_,i)=>({id:String(i),reference:`訂單 ${i}`,createdAt:'2026-10-20',amount:'NT$ 10000000000000.0001',status:i%2?'PAID':'CONFIRMED',statusLabel:i%2?'已付款':'已建立',description:i===22?'指定商品':'一般商品'}));
 const tree=create(<OrderList rows={rows} label="測試訂單"/>);const text=()=>JSON.stringify(tree.toJSON());const button=(name:string)=>tree.root.findAllByType('button').find(b=>b.children.includes(name))!;
 expect(tree.root.findByType('tbody').findAllByType('tr')).toHaveLength(10);expect(text()).toContain('10000000000000.0001');
 act(()=>button('下一頁').props.onClick());act(()=>button('下一頁').props.onClick());expect(tree.root.findByType('tbody').findAllByType('tr')).toHaveLength(3);
 act(()=>tree.root.findByType('select').props.onChange({target:{value:'PAID'}}));expect(tree.root.findByType('tbody').findAllByType('tr')).toHaveLength(10);expect(button('上一頁').props.disabled).toBe(true);
 act(()=>tree.root.findByType('input').props.onChange({target:{value:'指定商品'}}));expect(text()).toContain('沒有符合條件的訂單');
 act(()=>tree.root.findByType('select').props.onChange({target:{value:''}}));expect(tree.root.findByType('tbody').findAllByType('tr')).toHaveLength(1);expect(text()).toContain('訂單 22');act(()=>tree.unmount());
});
it('mounts details only when expanded and closes them when changing filters',()=>{
 const tree=create(<OrderList label="訂單" rows={[{id:'1',reference:'訂單紀錄',createdAt:'2026-10-20',amount:'待確認',status:'PAID',statusLabel:'已付款',details:<p>配送待處理</p>}]}/>);
 expect(JSON.stringify(tree.toJSON())).not.toContain('配送待處理');act(()=>tree.root.findByType('button').props.onClick());expect(JSON.stringify(tree.toJSON())).toContain('配送待處理');act(()=>tree.root.findByType('input').props.onChange({target:{value:'2026'}}));expect(JSON.stringify(tree.toJSON())).not.toContain('配送待處理');act(()=>tree.unmount());
});
