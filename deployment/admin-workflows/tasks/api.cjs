'use strict';
const assert = require('node:assert/strict');
const {taskTarget, readTaskPage} = require('../../../backend/apps/api/src/daily-task-routes.cjs');

function patch(source) {
  const once = (before, after) => {
    assert.equal(source.split(before).length, 2, 'Daily operations API anchor: ' + before);
    source = source.replace(before, () => after);
  };
  once('s.setup_status state,coalesce(s.placement_requested_at,s.created_at) since',
    's.setup_status state,q.ball_no,(SELECT a.binary_tree_id FROM organization.ball_no_allocation a WHERE a.qualification_id=s.qualification_id) tree_id,coalesce(s.placement_requested_at,s.created_at) since');
  once("f.status::text state,f.created_at since", "f.status::text state,o.order_no::text order_no,f.fulfillment_key,f.created_at since");
  once("e.payload->>'status' state,e.created_at since", "e.payload->>'status' state,e.run_id::text run_id,e.payload->>'groupId' group_id,e.created_at since");
  const start = source.indexOf('page=Math.min(100000,');
  const end = source.indexOf('async function health(db)', start);
  assert(start > 0 && end > start && source.slice(start,end).includes('pageSize:25,path:d.path}'));
  return source.slice(0,start) + 'return readTaskPage(db,d,page,query);}\n' +
    taskTarget.toString() + '\n' + readTaskPage.toString() + '\n' + source.slice(end);
}
module.exports = {patch};
