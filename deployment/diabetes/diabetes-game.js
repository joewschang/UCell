'use strict';
const {Get, Post, Req, ConflictException} = require('@nestjs/common');
const {mirror} = require('./health-tags');

module.exports = function install({HealthGameService, MemberHealthGame, PublicHealthGame}) {
  const proto = HealthGameService.prototype;
  const init = proto.onModuleInit;
  proto.onModuleInit = async function () {
    await init.call(this);
    await this.db.$transaction(async tx => {
      await tx.$queryRawUnsafe('SELECT true FROM (SELECT pg_advisory_xact_lock(261111053)) lock');
      const [state] = await tx.$queryRawUnsafe("SELECT to_regclass('integration.health_diabetes_week') IS NOT NULL AS ready");
      if (state.ready) return;
      await tx.$executeRaw`CREATE TABLE integration.health_diabetes_week (
        person_id uuid NOT NULL, week date NOT NULL, completed_at timestamptz,
        PRIMARY KEY (person_id,week))`;
      for (const tag of ['血糖健康', '日常觀察', '身體活動']) {
        await tx.$executeRaw`INSERT INTO integration.topic_tag(name) VALUES (${tag}) ON CONFLICT DO NOTHING`;
        await tx.$executeRaw`INSERT INTO integration.topic_tag_assignment(resource_key,tag_id,source,basis)
          SELECT 'diabetes',id,'editor','health-center' FROM integration.topic_tag WHERE name=${tag} AND NOT archived ON CONFLICT DO NOTHING`;
      }
      await mirror(tx, 'diabetes', 'health-center');
    });
  };
  const view = proto.view;
  proto.view = async function (person, admin = false) {
    const result = await view.call(this, person, admin);
    if (admin) [result.diabetesStats] = await this.db.$queryRaw`SELECT count(*)::int AS started,
      count(completed_at)::int AS finished FROM integration.health_diabetes_week`;
    return result;
  };
  async function overview(service, person) {
    const {config} = await service.config();
    if (!config.open || !person) return {open:config.open};
    const [stats] = await service.db.$queryRaw`SELECT count(completed_at)::int AS weeks
      FROM integration.health_diabetes_week WHERE person_id=${person}::uuid`;
    return {open:true, weeks:stats.weeks};
  }
  function route(cls, key, decorator, path, member, handler) {
    Object.defineProperty(cls.prototype,key,{value:handler,configurable:true});
    if (member) Req()(cls.prototype,key,0);
    decorator(path)(cls.prototype,key,Object.getOwnPropertyDescriptor(cls.prototype,key));
  }
  route(PublicHealthGame,'diabetes',Get,'diabetes',false,function(){return overview(this.service);});
  route(MemberHealthGame,'diabetes',Get,'diabetes',true,function(req){return overview(this.service,req.user.personId);});
  for (const action of ['start','finish']) {
    route(MemberHealthGame,'diabetes_'+action,Post,'diabetes/'+action,true,function(req){
      const person = req.user.personId;
      return this.service.db.$transaction(async tx => {
        const [config] = await tx.$queryRaw`SELECT (config->>'open')::boolean AS open FROM integration.health_game_config WHERE id=1 FOR SHARE`;
        if (!config.open) throw new ConflictException('活動已暫停');
        const [clock] = await tx.$queryRaw`SELECT date_trunc('week',now() AT TIME ZONE 'Asia/Taipei')::date::text AS week`;
        if (action === 'start') {
          await tx.$executeRaw`INSERT INTO integration.health_diabetes_week(person_id,week)
            VALUES(${person}::uuid,${clock.week}::date) ON CONFLICT DO NOTHING`;
        } else {
          const n = await tx.$executeRaw`UPDATE integration.health_diabetes_week SET completed_at=coalesce(completed_at,now())
            WHERE person_id=${person}::uuid AND week=${clock.week}::date`;
          if (!n) throw new ConflictException('請重新開始本週任務');
        }
        return {week:clock.week, completed:action==='finish'};
      });
    });
  }
};
