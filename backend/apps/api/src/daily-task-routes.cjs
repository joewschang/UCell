'use strict';
// IDs originate from the authorized category query. Keep customer names and contact details out of URLs.
function taskTarget(code, row) {
  const route = (path, params) => path + '?' + new URLSearchParams({daily: code, ...params});
  switch (code) {
    case 'REVIEW':
    case 'SUPPLEMENT':
      return route('/applications', {applicationId: row.id});
    case 'PAPER_ORDER':
      return route('/paper-intake', {applicationId: row.id});
    case 'PAYMENT':
      return route('/orders', {orderId: row.id});
    case 'SPONSOR':
      return route('/qualifications', {qualificationId: row.id});
    case 'PLACEMENT':
      return row.tree_id && row.ball_no
        ? route('/admin/organization/trees/' + encodeURIComponent(row.tree_id), {candidateBallNo: row.ball_no})
        : route('/qualifications', {qualificationId: row.id});
    case 'SHIPMENT':
      return route('/fulfillment', {orderNo: row.order_no, fulfillment: row.fulfillment_key});
    case 'PAYOUT':
      return route('/payouts', {run: row.run_id, group: row.group_id});
    default:
      return null;
  }
}
async function readTaskPage(db, definition, rawPage, query) {
  const page = Math.min(100000, Math.max(1, Math.floor(Number(rawPage) || 1)));
  const pageSize = 25;
  const text = String(query ?? '').trim().slice(0,120);
  // Return the newest match and the requested page from the same read snapshot.
  const [result] = await db.$queryRawUnsafe(`WITH matches AS MATERIALIZED (
    SELECT *, since < now()-($4::int*interval '1 hour') AS overdue
    FROM (${definition.query}) t
    WHERE ($1='' OR coalesce(name,'') ILIKE '%'||$1||'%' OR coalesce(reference,'') ILIKE '%'||$1||'%')
  ), page_rows AS (
    SELECT * FROM matches ORDER BY since DESC NULLS LAST,id DESC LIMIT $2 OFFSET $3
  )
  SELECT (SELECT count(*)::int FROM matches) AS total,
    coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY since DESC NULLS LAST,id DESC) FROM page_rows p), '[]'::jsonb) AS rows,
    (SELECT to_jsonb(m) FROM matches m ORDER BY since DESC NULLS LAST,id DESC LIMIT 1) AS latest`,
    text,pageSize,(page-1)*pageSize,definition.hours);
  const rows = result.rows.map(({id,name,reference,state,since,overdue,...target}) => ({
    id,name,reference,state,since,overdue,targetPath:taskTarget(definition.code, {id,...target})
  }));
  return {rows,total:result.total,page,pageSize,path:definition.path,
    latestTargetPath:result.latest ? taskTarget(definition.code,result.latest) : null};
}
module.exports = {taskTarget, readTaskPage};
