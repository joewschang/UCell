async function monthlyBirthdays(db) {
 const rows = await db.$queryRawUnsafe(`
   WITH calendar AS (
     SELECT date_trunc('month', now() AT TIME ZONE 'Asia/Taipei')::date AS first_day
   )
   SELECT to_char(c.first_day,'YYYY-MM') AS month, p.member_no AS "memberNo",
          p.legal_name AS name,
          least(extract(day from p.birth_date)::int,
                extract(day from c.first_day + interval '1 month - 1 day')::int) AS day
   FROM calendar c LEFT JOIN identity.person p ON
     p.status='EFFECTIVE' AND p.security_status='NORMAL' AND p.membership_state IS NOT NULL
     AND extract(month from p.birth_date)=extract(month from c.first_day)
   ORDER BY day, p.member_no
 `);
 return {month:rows[0].month, members:rows.filter(r=>r.memberNo).map(({memberNo,name,day})=>({memberNo,name,day}))};
}
module.exports={monthlyBirthdays};
