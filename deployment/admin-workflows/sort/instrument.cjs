'use strict';
const path=require('node:path');
const ts=require(require.resolve('typescript',{paths:[path.join(__dirname,'../../../admin')]}));
// Remember the original row renderer for data-driven table/card maps. It lets a remote page
// be rendered with identical actions and formatting after dates have been sorted across pages.
function instrument(source){
  const file=ts.createSourceFile('screen.js',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  const edits=[];
  function visit(node){
    // Earlier production overlays use the classic JSX runtime for their lists.
    if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.getText(file)==='f.createElement'&&
       ts.isStringLiteral(node.arguments[0])&&['div','ul','ol','section','article','main','table'].includes(node.arguments[0].text)&&node.arguments.length>2){
      edits.push({start:node.expression.getStart(file),end:node.expression.end,value:'ucDateElement'});
    }
    if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='map'&&node.arguments.length===1){
      const callback=node.arguments[0];
      if((ts.isArrowFunction(callback)||ts.isFunctionExpression(callback))&&/(?:\bf\.createElement|\bjsx(?:DEV|s)?|_jsx(?:DEV|s)?)\s*\)?\s*\(/.test(callback.getText(file)) && callback.getWidth(file)<120000){
        const base=node.expression.expression,start=base.getStart(file),end=base.end;
        edits.push({start,end:start,value:'ucDateMap('},{start:end,end:callback.getStart(file),value:','});
        if((node.flags & ts.NodeFlags.OptionalChain)!==0)edits.push({start:callback.end,end:callback.end,value:',true'});
      }
    }
    ts.forEachChild(node,visit);
  }
  visit(file);
  edits.sort((a,b)=>b.start-a.start||b.end-a.end);
  let result=source;
  for(const edit of edits)result=result.slice(0,edit.start)+edit.value+result.slice(edit.end);
  return {code:result,count:edits.length};
}
module.exports=instrument;
