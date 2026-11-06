// Production supplies one Durable Object's persistent state for this account.
import { Buffer } from 'node:buffer';
const LAYERS = new Set(['clouds_new','precipitation_new','temp_new']);
export function createWeatherTileGateway({ key, enabled = false, fetchImpl = fetch, now = Date.now, limit = 45, state: savedState, persist } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 45) throw new Error('Weather request limit must be 1–45/minute.');
  const state = savedState || {starts:[], blockedUntil:enabled && key ? now()+60000 : 0, permanentlyBlocked:false, pausedMessage:'Weather service is warming up its request budget. Please wait one minute.'};
  const starts=state.starts, pending=new Map();
  async function save() {
    try { await persist(structuredClone(state)); return true; }
    catch { state.permanentlyBlocked=true; state.pausedMessage='Weather quota storage is unavailable. Requests stopped.'; return false; }
  }
  const failure = (status, message, retry = 0) => ({ status, message, retry });
  function status() {
    return { enabled: Boolean(enabled && key && !state.permanentlyBlocked && now() >= state.blockedUntil),
      message: !enabled || !key ? 'Weather overlays are paused until the controlled weather service is enabled.' : state.permanentlyBlocked || now() < state.blockedUntil ? state.pausedMessage : '',
      retry: state.permanentlyBlocked ? 0 : Math.max(0,Math.ceil((state.blockedUntil-now())/1000)) };
  }
  async function tile(layer,z,x,y) {
    if (!LAYERS.has(layer) || ![z,x,y].every(Number.isInteger) || z<0 || z>6 || x<0 || y<0 || x>=2**z || y>=2**z) return failure(400,'Invalid weather tile.');
    const health=status();
    if(!health.enabled) return failure(503,health.message,health.retry);
    const id=`${layer}/${z}/${x}/${y}`;
    if(pending.has(id)) return pending.get(id);
    while(starts.length && starts[0]<=now()-60000)starts.shift();
    if(starts.length>=limit) return failure(429,'Weather map request budget reached. Please wait before reopening this layer.',Math.max(1,Math.ceil((starts[0]+60000-now())/1000)));
    starts.push(now()); // Every attempted upstream request counts, including failed requests.
    const task=(async()=>{
      if(persist) {
        if(!await save())return failure(503,state.pausedMessage);
        const latest=status();
        if(!latest.enabled)return failure(503,latest.message,latest.retry);
      }
      let response;
      try {
        response=await fetchImpl(`https://tile.openweathermap.org/map/${id}.png?appid=${encodeURIComponent(key)}`,{redirect:'error',signal:AbortSignal.timeout(8000)});
      }catch{
        state.blockedUntil=Math.max(state.blockedUntil,now()+60000); state.pausedMessage='Weather provider could not connect. Requests paused for a minute.';
        if(persist && !await save())return failure(503,state.pausedMessage);
        return failure(502,state.pausedMessage,60);
      }
      if(!response.ok){
        if(response.status===401 || response.status===403){state.permanentlyBlocked=true;state.pausedMessage='Weather credentials were rejected. Overlays paused until the service is reconfigured.';}
        else {
          const raw=response.headers.get('retry-after');
          const seconds=raw && /^\d+$/.test(raw)?Number(raw):raw?Math.ceil((Date.parse(raw)-now())/1000):0;
          const cooldown=response.status===429?Math.max(900,Number.isFinite(seconds)?seconds:0):60;
          state.blockedUntil=Math.max(state.blockedUntil,now()+cooldown*1000);
          state.pausedMessage=response.status===429?'OpenWeather quota exceeded. All weather overlay requests paused.':'Weather provider returned an error. Requests paused for a minute.';
        }
        if(persist && !await save())return failure(503,state.pausedMessage);
        return failure(response.status===429?429:502,state.pausedMessage,status().retry);
      }
      if(!response.headers.get('content-type')?.startsWith('image/')){
        state.blockedUntil=Math.max(state.blockedUntil,now()+60000);state.pausedMessage='Weather provider returned an invalid tile. Requests paused.';
        if(persist && !await save())return failure(503,state.pausedMessage);
        return failure(502,state.pausedMessage,60);
      }
      try {
        const bytes=Buffer.from(await response.arrayBuffer());
        if(!bytes.length || bytes.length>2*1024*1024) throw new Error('Invalid tile size');
        // No persistent cache or added browser freshness without an approved caching policy.
        return {status:200,bytes,type:response.headers.get('content-type')};
      }catch{state.blockedUntil=Math.max(state.blockedUntil,now()+60000);state.pausedMessage='Weather tile could not be read. Requests paused.';if(persist && !await save())return failure(503,state.pausedMessage);
        return failure(502,state.pausedMessage,60);}
    })();
    pending.set(id,task);
    try{return await task;}finally{pending.delete(id);}
  }
  return { status,tile };
}
