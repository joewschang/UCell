'use strict';
const games=require('./games.json');
const {mirror}=require('../health-tags');
module.exports=async function setup(db){
  await db.$transaction(async tx=>{
    await tx.$queryRawUnsafe('SELECT true FROM (SELECT pg_advisory_xact_lock(261111053)) lock');
    await tx.$executeRaw`CREATE TABLE IF NOT EXISTS integration.health_journey_version (
      version integer PRIMARY KEY, games jsonb NOT NULL, actor text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`;
    await tx.$executeRaw`CREATE TABLE IF NOT EXISTS integration.health_journey_draft (
      id int PRIMARY KEY, revision int NOT NULL, games jsonb NOT NULL, actor text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`;
    await tx.$executeRaw`CREATE TABLE IF NOT EXISTS integration.health_journey_invite (
      id uuid PRIMARY KEY, source_game text NOT NULL, generic boolean NOT NULL, owner uuid NOT NULL,
      channel text NOT NULL, campaign text NOT NULL, version integer NOT NULL, revoked boolean DEFAULT false NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL)`;
    await tx.$executeRaw`CREATE TABLE IF NOT EXISTS integration.health_journey_event (
      attempt uuid NOT NULL, game text NOT NULL, action text NOT NULL, resource text NOT NULL DEFAULT '',
      visitor uuid NOT NULL, invite uuid REFERENCES integration.health_journey_invite(id), person_id uuid, campaign text NOT NULL,
      version int NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(attempt,game,action,resource))`;
    await tx.$executeRaw`CREATE INDEX IF NOT EXISTS health_journey_event_date ON integration.health_journey_event(occurred_at)`;
    await tx.$executeRaw`CREATE INDEX IF NOT EXISTS health_journey_commerce ON integration.health_journey_event(person_id,resource,occurred_at) WHERE person_id IS NOT NULL`;
    await tx.$executeRaw`CREATE TABLE IF NOT EXISTS integration.health_egfr_stamp(person_id uuid NOT NULL,week date NOT NULL,completed_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(person_id,week))`;
    await tx.$executeRaw`CREATE TABLE IF NOT EXISTS integration.health_journey_order(order_id uuid PRIMARY KEY,attempt uuid NOT NULL,game text NOT NULL,resource text NOT NULL)`;
    await tx.$executeRaw`CREATE TABLE IF NOT EXISTS integration.health_journey_change(revision int PRIMARY KEY,action text NOT NULL,actor text NOT NULL,reason text NOT NULL,before_data jsonb NOT NULL,after_data jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now())`;
    await tx.$executeRaw`CREATE TABLE IF NOT EXISTS integration.health_journey_claim(attempt uuid PRIMARY KEY,claimed_at timestamptz NOT NULL DEFAULT now())`;
    await tx.$executeRaw`CREATE TABLE IF NOT EXISTS integration.health_bp_stamp(person_id uuid NOT NULL, week date NOT NULL, completed_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(person_id,week))`;
    const initial=games.map(({id,description,invite,cover,interest})=>({id,description,invite,cover,interest,enabled:true,membersOnly:false,starts:'',ends:'',campaign:'常態',pinned:[]}));
    const n=await tx.$executeRaw`INSERT INTO integration.health_journey_version(version,games,actor) VALUES(1,${JSON.stringify(initial)}::jsonb,'health-center') ON CONFLICT DO NOTHING`;
    if(!n)return;
    await tx.$executeRaw`INSERT INTO integration.health_journey_draft(id,revision,games,actor) VALUES(1,1,${JSON.stringify(initial)}::jsonb,'health-center')`;
    for(const name of games[2].tags){
      await tx.$executeRaw`INSERT INTO integration.topic_tag(name) VALUES(${name}) ON CONFLICT DO NOTHING`;
      await tx.$executeRaw`INSERT INTO integration.topic_tag_assignment(resource_key,tag_id,source,basis) SELECT 'egfr',id,'editor','health-center' FROM integration.topic_tag WHERE name=${name} AND NOT archived ON CONFLICT DO NOTHING`;
    }
    await mirror(tx,'egfr','health-center');
    await require('./publish-pressure')(tx);
  },{timeout:30000});
};
