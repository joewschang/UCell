import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{PrismaClient}=require('@prisma/client');
if(!process.env.DATABASE_URL)throw Error('DATABASE_URL_REQUIRED');
const db=new PrismaClient();
try{
 const [missingMemberNo,invalidMemberNo,missingPosition,invalidBallNo,duplicatePosition]=await Promise.all([
  db.$queryRaw`SELECT count(*)::int AS count FROM identity.person WHERE member_no IS NULL`,
  db.$queryRaw`SELECT count(*)::int AS count FROM identity.person WHERE member_no !~ '^[0-9]{10}$'`,
  db.$queryRaw`SELECT count(*)::int AS count FROM organization.binary_tree_membership WHERE binary_position_no IS NULL OR binary_position_no<=0`,
  // V2 validates allocation identity independently of immutable topology.
  db.$queryRaw`WITH ball_positions AS (
    SELECT q.ball_no,q.kind,t.tree_code,m.binary_position_no,a.sequence_no,
      CASE WHEN m.binary_position_no<=3 THEN m.binary_position_no::text ELSE a.sequence_no::text END AS ordinal
    FROM membership.qualification q
    JOIN organization.binary_tree_membership m USING(qualification_id)
    JOIN organization.binary_tree t USING(binary_tree_id)
    LEFT JOIN organization.ball_no_allocation a ON a.qualification_id=q.qualification_id AND a.binary_tree_id=m.binary_tree_id
  )
  SELECT count(*)::int AS count FROM ball_positions
  WHERE ball_no IS NULL OR ordinal IS NULL OR (binary_position_no<=3 AND kind<>'COMPANY_BOOTSTRAP') OR ball_no<>tree_code
    || CASE WHEN binary_position_no<=3 THEN 'X' ELSE '' END
    || CASE WHEN length(ordinal)<6 THEN lpad(ordinal,6,'0') ELSE ordinal END`,
  db.$queryRaw`SELECT count(*)::int AS count FROM (SELECT binary_tree_id,binary_position_no FROM organization.binary_tree_membership GROUP BY 1,2 HAVING count(*)>1) x`
 ]);
 const report={mode:'READ_ONLY_DRY_RUN',memberNo:{missing:missingMemberNo[0].count,invalid:invalidMemberNo[0].count},binaryPosition:{missingOrInvalid:missingPosition[0].count,duplicate:duplicatePosition[0].count},ballNo:{missingOrMismatch:invalidBallNo[0].count}};
 report.status=Object.values(report.memberNo).every(x=>x===0)&&Object.values(report.binaryPosition).every(x=>x===0)&&Object.values(report.ballNo).every(x=>x===0)?'PASS':'ANOMALY';
 console.log(JSON.stringify(report,null,2));if(report.status!=='PASS')process.exitCode=2;
}catch(error){
 const code=error?.meta?.code;
 console.error(['42P01','42703'].includes(code)?'P0_RECONSTRUCTION_DRY_RUN_PRECONDITION: database lacks the required P0 schema; run only against a migrated isolated candidate.':`P0_RECONSTRUCTION_DRY_RUN_FAILED: ${error?.message??error}`);
 process.exitCode=2;
}finally{await db.$disconnect();}
