import {readFileSync,readdirSync} from 'node:fs';
import {resolve,join,relative} from 'node:path';
import ts from 'typescript';
import {expect,it} from 'vitest';
import {uiText} from '../../shared/design-system/i18n';

const root=resolve(import.meta.dirname,'../..');
const displayAttributes=new Set(['title','subtitle','label','placeholder','aria-label','alt','hint','helper','description','message']);
const retained=/\b(?:UCell|UCELL|Every8D|LINE|Google|Microsoft|Entra|Azure|Dynamics|ERP|EZTooL|GPV|RPV|EPV|PV|BV|NASL|SHA|HTTPS|HTTP|HMAC|JSON|CSV|XLS|SKU|JPG|PNG|PDF|MB|NT|TWD|ISO|UTC|OpenAPI|API)\b|7-ELEVEN|(?:TREE|CASE|TIP)-[A-Z0-9-]+|VITE_[A-Z_]+|ADMIN_AUTH_BYPASS|ucell_admin_test|UAT_EXECUTION_R6\.csv/g;

it('前後台可見的固定文字使用繁中詞庫，僅保留必要品牌、格式與識別內容',()=>{
 const failures:string[]=[];
 function check(value:string,file:string,node:ts.Node,source:ts.SourceFile,translated=false){
  if(!/[A-Za-z]/.test(value)||/^\s*\/|YYYY-MM-DD/.test(value))return;
  const display=translated?uiText(value):value;
  if(/[A-Za-z]{2}/.test(display.replace(retained,''))){
   failures.push(`${relative(root,file)}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line+1} ${display.trim()}`);
  }
 }
 function scan(directory:string){for(const item of readdirSync(directory,{withFileTypes:true})){
  const file=join(directory,item.name);
  if(item.isDirectory())scan(file);
  else if(/\.tsx?$/.test(file)&&!/(?:test|spec)\./.test(file)){
   const source=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
   function visit(node:ts.Node){
    if(ts.isJsxText(node))check(node.text,file,node,source);
    if(ts.isJsxAttribute(node)&&displayAttributes.has(node.name.getText(source))&&node.initializer&&ts.isStringLiteral(node.initializer))check(node.initializer.text,file,node,source);
    if(ts.isCallExpression(node)&&node.expression.getText(source)==='uiText'&&node.arguments[0]&&ts.isStringLiteral(node.arguments[0]))check(node.arguments[0].text,file,node,source,true);
    if(ts.isTaggedTemplateExpression(node)&&node.tag.getText(source)==='uiTemplate'&&ts.isTemplateExpression(node.template)){
     check(node.template.head.text,file,node,source,true);
     node.template.templateSpans.forEach(span=>check(span.literal.text,file,node,source,true));
    }
    ts.forEachChild(node,visit);
   }
   visit(source);
  }
 }}
 scan(join(root,'admin/src'));scan(join(root,'member/src'));
 expect(failures).toEqual([]);
});

