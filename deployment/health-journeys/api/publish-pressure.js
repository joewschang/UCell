'use strict';
const { mirror } = require('../health-tags');
const game = require('./games.json').find(item => item.id === 'blood-pressure');

module.exports = async function publishPressure(tx) {
  const [draft] = await tx.$queryRaw`SELECT * FROM integration.health_journey_draft WHERE id=1 FOR UPDATE`;
  const [published] = await tx.$queryRaw`SELECT * FROM integration.health_journey_version ORDER BY version DESC LIMIT 1`;
  const { id, description, invite, cover, interest } = game;
  const entry = { id, description, invite, cover, interest, enabled:true, membersOnly:false,
    starts:'', ends:'', campaign:'常態', pinned:[] };
  const add = list => list.some(item => item.id === id) ? list : [...list, entry];
  const live = add(published.games), next = add(draft.games);
  if (live !== published.games) {
    await tx.$executeRaw`INSERT INTO integration.health_journey_version(version,games,actor)
      VALUES(${published.version + 1},${JSON.stringify(live)}::jsonb,'blood-pressure-launch')`;
  }
  if (next !== draft.games) {
    await tx.$executeRaw`UPDATE integration.health_journey_draft SET games=${JSON.stringify(next)}::jsonb,
      revision=revision+1,actor='blood-pressure-launch',updated_at=now() WHERE id=1`;
    await tx.$executeRaw`INSERT INTO integration.health_journey_change(revision,action,actor,reason,before_data,after_data)
      VALUES(${draft.revision+1},'publish','blood-pressure-launch','上架血壓監測',${JSON.stringify(draft.games)}::jsonb,${JSON.stringify(next)}::jsonb)`;
  }
  for (const name of game.tags) {
    await tx.$executeRaw`INSERT INTO integration.topic_tag(name) VALUES(${name}) ON CONFLICT DO NOTHING`;
    await tx.$executeRaw`INSERT INTO integration.topic_tag_assignment(resource_key,tag_id,source,basis)
      SELECT ${id},id,'editor','health-center' FROM integration.topic_tag WHERE name=${name} AND NOT archived ON CONFLICT DO NOTHING`;
  }
  await mirror(tx,id,'blood-pressure-launch');
};
