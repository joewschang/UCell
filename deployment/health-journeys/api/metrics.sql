WITH events AS (
 SELECT * FROM integration.health_journey_event WHERE occurred_at >= now()- interval '30 days'
), counts AS (
 SELECT e.game,e.campaign,
 count(DISTINCT e.visitor) FILTER (WHERE action='start')::int starters,
 count(*) FILTER (WHERE action='start')::int starts,count(*) FILTER (WHERE action='calculate')::int calculations,
 count(*) FILTER (WHERE action='finish')::int finishes,count(DISTINCT visitor) FILTER(WHERE action='finish')::int finishers,
 count(DISTINCT visitor) FILTER(WHERE action='arrive' AND i.owner<>visitor)::int arrivals,
 count(DISTINCT visitor) FILTER(WHERE action='start' AND i.owner<>visitor)::int invited,
 count(*) FILTER(WHERE action='impression')::int impressions,count(*) FILTER(WHERE action='click')::int clicks,
 count(*) FILTER(WHERE action='detail')::int details,count(*) FILTER(WHERE action='cart')::int carts,count(*) FILTER(WHERE action='registration_start')::int registration_starts,
 count(DISTINCT visitor) FILTER(WHERE action='click' AND resource LIKE 'sku:%')::int shoppers
 FROM events e LEFT JOIN integration.health_journey_invite i ON e.invite=i.id GROUP BY 1,2
), orders AS (
 SELECT DISTINCT ON(o.order_id) e.game,e.campaign,o.order_id,e.person_id purchaser_person_id,o.net_amount,(d.attempt=e.attempt AND d.game=e.game AND d.resource=e.resource) direct
 FROM events e JOIN commerce."order" o ON (o.purchaser_person_id=e.person_id OR (o.purchaser_person_id IS NULL AND o.qualification_id IS NOT NULL AND EXISTS (SELECT 1 FROM audit.audit_event a WHERE a.entity_type='ORDER' AND a.entity_id=o.order_id AND a.action='ORDER_CREATED_CONFIRMED' AND a.actor_id=e.person_id))) AND o.purpose='RETAIL'
 AND o.created_at >=e.occurred_at AND o.created_at < e.occurred_at + interval '7 days' AND o.paid_at IS NOT NULL AND o.currency='TWD'
 JOIN commerce.order_line l ON l.order_id=o.order_id AND e.resource='sku:'||l.sku_snapshot
 LEFT JOIN integration.health_journey_order d ON d.order_id=o.order_id
 WHERE e.action='click' ORDER BY o.order_id,e.occurred_at DESC,e.attempt
), sales AS (
 SELECT game,campaign,count(*)::int orders,count(*) FILTER (WHERE direct)::int direct_orders,count(DISTINCT purchaser_person_id)::int buyers,
 sum(net_amount)::float8 gross,sum(coalesce(r.refunds,0))::float8 refunds
 FROM orders o LEFT JOIN LATERAL (SELECT sum(l.return_amount) refunds FROM commerce.return_case c JOIN commerce.return_line l USING(return_case_id)
 WHERE c.order_id=o.order_id AND c.posted_at IS NOT NULL AND c.status='POSTED') r ON true GROUP BY 1,2
), registrations AS (
 SELECT DISTINCT ON(x.id) x.id,e.game,e.campaign,e.resource FROM events e JOIN LATERAL (
 SELECT a.member_event_registration_id id,a.registered_at dt FROM learning.member_event_registration a JOIN learning.member_event v USING(member_event_id)
 WHERE e.resource='event:'||v.event_code AND a.person_id=e.person_id AND a.status<>'CANCELLED' AND a.registered_at BETWEEN e.occurred_at AND e.occurred_at+interval '7 days'
 UNION ALL SELECT a.learning_enrollment_id,a.enrolled_at FROM learning.learning_enrollment a JOIN learning.learning_course v USING(learning_course_id)
 WHERE e.resource='course:'||v.course_code AND a.person_id=e.person_id AND a.status<>'CANCELLED' AND a.enrolled_at BETWEEN e.occurred_at AND e.occurred_at+interval '7 days'
 )x ON true WHERE e.action='click' ORDER BY x.id,e.occurred_at DESC,e.attempt
), enrollments AS (SELECT game,campaign,count(*) FILTER(WHERE resource LIKE 'event:%')::int bookings,count(*) FILTER(WHERE resource LIKE 'course:%')::int courses FROM registrations GROUP BY 1,2)
SELECT c.*,coalesce(s.orders,0) orders,coalesce(s.direct_orders,0) direct_orders,coalesce(s.buyers,0) buyers,coalesce(s.gross,0) gross,coalesce(s.refunds,0) refunds,coalesce(r.bookings,0) bookings,coalesce(r.courses,0) courses FROM counts c LEFT JOIN sales s USING(game,campaign) LEFT JOIN enrollments r USING(game,campaign) ORDER BY c.game,c.campaign
