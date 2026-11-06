import { createWeatherTileGateway } from '../server/weather-tiles.mjs';
const ORIGIN='https://naugsco.github.io';
const headers = origin => ({'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin',...(origin===ORIGIN?{'Access-Control-Allow-Origin':ORIGIN}:{})});
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
export default {
  async fetch(request,env) {
    const url=new URL(request.url),origin=request.headers.get('Origin');
    if(url.pathname==='/health' && request.method==='GET')return json({service:'snow-scout-weather',version:'20261106',status:'ok'});
    if(origin && origin!==ORIGIN)return json({error:'Origin not allowed.'},403);
    if(request.method==='OPTIONS'){
      if(origin!==ORIGIN)return json({error:'Origin required.'},403);
      return new Response(null,{status:204,headers:{...headers(origin),'Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600'}});
    }
    if(request.method!=='GET')return json({error:'GET required.'},405,origin);
    if(!url.pathname.startsWith('/api/weather/'))return json({error:'Not found.'},404,origin);
    if(url.pathname!=='/api/weather/status' && origin!==ORIGIN)return json({error:'Origin required.'},403);
    try {
      const id=env.WEATHER_ACCOUNT.idFromName('openweather-account-v1');
      const response=await env.WEATHER_ACCOUNT.get(id).fetch(request);
      const h=new Headers(response.headers);for(const [k,v]of Object.entries(headers(origin)))if(k!=='Content-Type')h.set(k,v);
      return new Response(response.body,{status:response.status,headers:h});
    }catch{return json({error:'Weather service unavailable. Requests stopped.'},503,origin);}
  }
};
