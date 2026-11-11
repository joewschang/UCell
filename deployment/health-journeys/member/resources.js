import {session} from './session.js';import {link} from '../context-ui.js';
const journey=await session(new URL(location.href).searchParams.get('game'));
if(journey){const next=journey.explore();document.querySelector('main').replaceChildren(link('‹ 返回健康中心','/health/'),next);next.querySelector('button').click();}
