import {describe,it,expect} from 'vitest';
import {importRtf} from './rtf-import';
const parse=(s:string)=>importRtf(new TextEncoder().encode(s));
describe('RTF product copy import',()=>{
 it('preserves Chinese unicode and basic formatting',()=>{const r=parse('{\\rtf1\\ansi\\uc1 \\u20013?\\u25991? {\\b Bold} {\\i Italic}\\par second}');expect(r.document.blocks).toHaveLength(2);const first=r.document.blocks[0] as any;expect(first.runs.map((r:any)=>r.text).join('')).toBe('中文 Bold Italic');expect(first.runs.find((r:any)=>r.text==='Bold').bold).toBe(true);expect(first.runs.find((r:any)=>r.text==='Italic').italic).toBe(true);});
 it('decodes legacy Big5 escaped bytes',()=>{const r=parse("{\\rtf1\\ansi\\ansicpg950 \\'a4\\'a4\\'a4\\'e5}");expect((r.document.blocks[0] as any).runs[0].text).toBe('中文');});
 it('omits embedded objects and untrusted field instructions',()=>{const r=parse('{\\rtf1{\\fonttbl hidden}{\\pict abc}{\\object SECRET}{\\field{\\*\\fldinst HYPERLINK javascript:bad}{\\fldrslt visible}}}');expect(r.omittedMedia).toBe(true);expect(JSON.stringify(r.document)).toContain('visible');expect(JSON.stringify(r.document)).not.toMatch(/SECRET|javascript|hidden/);});
 it('rejects malformed or oversized documents',()=>{expect(()=>parse('not rtf')).toThrow();expect(()=>parse('{\\rtf1 broken')).toThrow();expect(()=>importRtf(new Uint8Array(1048577))).toThrow();});
});
