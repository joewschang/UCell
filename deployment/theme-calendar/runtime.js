(()=>{
const endpoint='https://api.ucell.life/api/v1/public/content/themes/current';
const clips={admin:{classic:'admin_login_triumphant_fanfare',christmas:'christmas_app_intro',newyear:'new_year_fireworks_welcome',lunar:'cny_welcome_raw'},member:{classic:'app_entry_many_coins',christmas:'christmas_app_welcome_chime',newyear:'app_new_year_welcome_ringtone',lunar:'chinese_new_year_app_welcome'}};
let theme='classic',flight,timer,checked=0;
function audio(kind,key=theme){const name=clips[kind][key];return (name===clips[kind].classic?(kind==='admin'?'/assets/audio/':'/welcome-sound/'):'/seasons/audio/')+name+'.mp3'}
async function refresh(){
 if(flight)return flight;
 flight=(async()=>{let delay=60000;try{const response=await fetch(endpoint,{cache:'no-store',signal:AbortSignal.timeout(3500)});if(!response.ok)throw Error();const {data}=await response.json();if(!Object.hasOwn(clips.admin,data.theme))throw Error();theme=data.theme;checked=Date.now();if(data.nextChange)delay=Math.max(300,Math.min(delay,Date.parse(data.nextChange)-Date.now()+80));}catch{checked=0;theme='classic';delay=10000}
 document.documentElement.dataset.season=theme;window.dispatchEvent(new Event('ucell:theme-calendar'));clearTimeout(timer);timer=setTimeout(refresh,delay);
 })().finally(()=>{flight=undefined});return flight;
}
window.ucThemeCalendar={audio,refresh,get confirmed(){return checked>0},get theme(){return theme},ready:()=>flight||(Date.now()-checked<5000?Promise.resolve():refresh())};
refresh();document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
})();
