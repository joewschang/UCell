const assert=require('node:assert/strict'),path=require('path');
const {contentDocument,contentMediaIds}=require(path.resolve(__dirname,'../../../backend/apps/api/dist/modules/member/product-content-format'));
const id='11111111-1111-4111-8111-111111111111';
const doc=contentDocument({blocks:[{type:'paragraph',runs:[{text:'<script>not executable</script>',bold:true,onclick:'bad',href:'https://example.com/'}]},{type:'image',mediaId:id,caption:'圖片說明'},{type:'youtube',videoId:'abcdefghijk',caption:'影片'}]});
assert.equal(doc.blocks[0].runs[0].onclick,undefined);assert.deepEqual(contentMediaIds(doc),[id]);
for(const bad of [{blocks:[{type:'iframe',url:'javascript:alert(1)'}]},{blocks:[{type:'paragraph',runs:[{text:'bad',href:'javascript:bad'}]}]},{blocks:[{type:'image',mediaId:'../private',caption:''}]},{blocks:[{type:'paragraph',runs:[{text:'x'.repeat(50001)}]}]},{blocks:Array(101).fill({type:'paragraph',runs:[]})}])assert.throws(()=>contentDocument(bad));
console.log('CONTENT_FORMAT_QA_PASSED: typedBlocks,safeLinks,noHtmlExecution,mediaIds,bounds');
