'use strict';

function renameBinaryTree(main) {
  const textChanges = [
    ['["對碰樹","/organization/binary","binary-trees"]', '["二元樹","/organization/binary","binary-trees"]'],
    ['title:h==="SPONSOR"?"推薦樹":"對碰樹"', 'title:h==="SPONSOR"?"推薦樹":"二元樹"'],
    ['value:"BINARY",children:"二元安置組織"', 'value:"BINARY",children:"二元樹"'],
    ['title:h==="SPONSOR"?"推薦組織":"二元安置組織"', 'title:h==="SPONSOR"?"推薦組織":"二元樹"'],
    ['"/organization/binary": "二元樹 雙軌 組織樹 左右線"', '"/organization/binary": "對碰樹 雙軌 組織樹 左右線"']
  ];
  for (const [previous, next] of textChanges) {
    if (main.split(previous).length !== 2) throw Error('Binary tree label missing or ambiguous: ' + previous);
    main = main.replace(previous, next);
  }
  return main;
}

module.exports = {renameBinaryTree};
