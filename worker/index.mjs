import { createWeatherTileGateway } from '../server/weather-tiles.mjs';
import { ClickCounter, tokenMatches, MAX_BODY_BYTES } from './clicks.mjs';
export { ClickCounter };
// snowscout.ski is the public site; the github.io origin stays allowed until the custom-domain cutover is confirmed.
const ORIGINS=new Set(['https://snowscout.ski','https://www.snowscout.ski','https://naugsco.github.io']);
const allowed = origin => ORIGINS.has(origin);
const headers = origin => ({'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin',...(allowed(origin)?{'Access-Control-Allow-Origin':origin}:{})});
const json = (body,status=200,origin=null) => new Response(JSON.stringify(body),{status,headers:headers(origin)});

export class WeatherAccount {
  constructor(ctx,env) {
    this.ctx=ctx;this.env=env;
    ctx.blockConcurrencyWhile(async()=>{
      let state=await ctx.storage.get('quota-v1');
      if(!state) state={starts:[],blockedUntil:Date.now()+60000,permanentlyBlocked:false,pausedMessage:'Weather service is warming up its request budget. Please wait one minute.',resetTag:env.OPENWEATHER_CIRCUIT_RESET_ID||'initial'};
      const tag=env.OPENWEATHER_CIRCUIT_RESET_ID||'initial';
      if(state.resetTag!==tag) { state.resetTag=tag;state.permanentlyBlocked=false;state.blockedUntil=Math.max(state.blockedUntil,Date.now()+60000); }
      await ctx.storage.put('quota-v1',state);
      this.gateway=createWeatherTileGateway({key:env.OPENWEATHER_API_KEY,enabled:env.OPENWEATHER_ENABLED==='true',state,persist: snapshot=>ctx.storage.put('quota-v1',snapshot)});
    });
  }
  async fetch(request) {
    const url=new URL(request.url);
    if(url.pathname==='/api/weather/status')return json({...this.gateway.status(),service:'snow-scout-weather',limitPerMinute:45,persistentQuota:true});
    const match=url.pathname.match(/^\/api\/weather\/tiles\/([a-z_]+)\/(\d{1,2})\/(\d{1,3})\/(\d{1,3})\.png$/);
    if(!match)return json({error:'Unknown weather resource.'},404);
    const tile=await this.gateway.tile(match[1],...match.slice(2).map(Number));
    if(tile.status!==200){const response=json({error:tile.message},tile.status);if(tile.retry)response.headers.set('Retry-After',String(tile.retry));return response;}
    return new Response(tile.bytes,{headers:{'Content-Type':tile.type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  }
}
async function clickCounter(env,request,origin){
  try {
    const response=await env.CLICK_COUNTER.get(env.CLICK_COUNTER.idFromName('clicks-v1')).fetch(request);
    const h=new Headers(response.headers);for(const [k,v]of Object.entries(headers(origin)))if(k!=='Content-Type')h.set(k,v);
    return new Response(response.body,{status:response.status,headers:h});
  }catch{return json({error:'Click counter unavailable.'},503,origin);}
}
export default {
  async fetch(request,env) {
    const url=new URL(request.url),origin=request.headers.get('Origin');
    if(url.pathname==='/health' && request.method==='GET')return json({service:'snow-scout-weather',version:'20261121-clicks',status:'ok'});
    if(origin && !allowed(origin))return json({error:'Origin not allowed.'},403);
    if(request.method==='OPTIONS'){
      if(!allowed(origin))return json({error:'Origin required.'},403);
      return new Response(null,{status:204,headers:{...headers(origin),'Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600'}});
    }
    if(url.pathname==='/api/clicks'){
      if(request.method!=='POST')return json({error:'POST required.'},405,origin);
      if(!allowed(origin))return json({error:'Origin required.'},403);
      const length=Number(request.headers.get('Content-Length'));
      if(!Number.isInteger(length) || length<1 || length>MAX_BODY_BYTES)return json({error:'Click body must be 1–512 bytes.'},413,origin);
      return clickCounter(env,request,origin);
    }
    if(url.pathname==='/api/clicks/summary'){
      if(request.method!=='GET')return json({error:'GET required.'},405);
      if(!tokenMatches(request.headers.get('Authorization'),env.CLICK_STATS_TOKEN))return json({error:'Unauthorized.'},401);
      return clickCounter(env,request,null);
    }
    if(request.method!=='GET')return json({error:'GET required.'},405,origin);
    if(!url.pathname.startsWith('/api/weather/'))return json({error:'Not found.'},404,origin);
    if(url.pathname!=='/api/weather/status' && !allowed(origin))return json({error:'Origin required.'},403);
    try {
      const id=env.WEATHER_ACCOUNT.idFromName('openweather-account-v1');
      const response=await env.WEATHER_ACCOUNT.get(id).fetch(request);
      const h=new Headers(response.headers);for(const [k,v]of Object.entries(headers(origin)))if(k!=='Content-Type')h.set(k,v);
      return new Response(response.body,{status:response.status,headers:h});
    }catch{return json({error:'Weather service unavailable. Requests stopped.'},503,origin);}
  }
};
