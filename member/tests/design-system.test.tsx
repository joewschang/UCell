import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {MoneyState,StatusBadge,AwardLifecycle,UCellButton,statusTone,QualificationBadge} from '@ucell/design-system';
describe('UCell presentation contract',()=>{
 it('preserves pending versus finalized zero money',()=>{expect(renderToStaticMarkup(<MoneyState amount={null} status="PENDING"/>)).toContain('結算中');expect(renderToStaticMarkup(<MoneyState amount={0} status="PAID"/>)).toContain('NT$ 0');expect(renderToStaticMarkup(<MoneyState amount={null}/>)).toContain('待提供')});
 it('maps existing statuses and keeps unknown statuses neutral',()=>{expect(statusTone('ACTIVE')).toBe('success');expect(statusTone('PENDING45D')).toBe('warning');expect(statusTone('PENDING_45D')).toBe('warning');expect(statusTone('SUSPENDED')).toBe('danger');expect(statusTone('CALCULATED')).toBe('info');expect(statusTone('NEW_UNREVIEWED_ENUM')).toBe('neutral');expect(renderToStaticMarkup(<StatusBadge status="SUSPENDED"/>)).toContain('SUSPENDED')});
 it('does not infer completion of other lifecycle stages',()=>{const html=renderToStaticMarkup(<AwardLifecycle status="PENDING45D"/>);expect(html.match(/aria-current="step"/g)).toHaveLength(1);expect(html).toContain('其他階段不代表已完成');expect(renderToStaticMarkup(<AwardLifecycle status="CLAWBACK"/>)).not.toContain('aria-current="step"')});
 it('shows distinct ball context and defaults buttons to non-submit',()=>{expect(renderToStaticMarkup(<QualificationBadge code="Q123" ball="球2" rank="領袖"/>)).toContain('Q123｜領袖｜球2');expect(renderToStaticMarkup(<UCellButton>查看</UCellButton>)).toContain('type="button"')});
 it('meets 4.5:1 contrast for normal text and semantic badges',()=>{
  const css=readFileSync(new URL('../../shared/design-system/tokens.css',import.meta.url),'utf8');const tokens=Object.fromEntries([...css.matchAll(/--ucell-([a-z-]+):(#(?:[0-9a-f]{6}|[0-9a-f]{3}));/g)].map(m=>[m[1],m[2]]));
  function luminance(hex:string){const h=hex.slice(1);const full=h.length===3?[...h].map(c=>c+c).join(''):h;const channels=[0,2,4].map(i=>{const x=parseInt(full.slice(i,i+2),16)/255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4});return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722}
  for(const [fg,bg] of [['text-primary','surface'],['text-secondary','surface'],['text-muted','bg'],['success','success-bg'],['warning','warning-bg'],['danger','danger-bg'],['info','info-bg'],['primary','surface']]){const a=luminance(tokens[fg]),b=luminance(tokens[bg]);expect((Math.max(a,b)+.05)/(Math.min(a,b)+.05),`${fg}/${bg}`).toBeGreaterThanOrEqual(4.5)}
 });
});
