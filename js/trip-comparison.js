import { icon } from './ui-icons.js?v=20261021-sources-verified';
import { loadLiveForecastForResort } from './data-loader.js?v=20261021-sources-verified';
import { resorts } from './resorts.js?v=20261021-sources-verified';
import { localDate, addDays, nearbyAirports, kayakFlightUrl, directionsUrl, lodgingUrl } from './travel.js?v=20261106-trips';
import { GATEWAYS, validatePlan, snowForSkiDates, dailyTripForecast } from './trip-planning.js?v=20261106-trips';
import { formatInches } from './utils.js?v=20261021-sources-verified';
const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key='snow-scout-trip-plan-v1';
let airports, opener, generation=0;
const dialog=document.createElement('dialog'); dialog.className='trip-dialog'; dialog.setAttribute('aria-labelledby','trip-heading'); document.body.appendChild(dialog);
const initial=()=>({origin:localStorage.getItem('snow-scout-airport')||'',departure:addDays(localDate(),1),customSkiDates:false,skiStart:'',skiEnd:'',returnDate:addDays(localDate(),6),adults:1,currency:'CAD',budget:'',pass:'all',transport:'either',names:['Whistler Blackcomb','Heavenly','Niseko United'],destinations:{}});
function link(label,url){return `<a class="travel-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`;}
export async function openTripComparison(names) {
  opener=document.activeElement;
  let plan;
  try { plan=initial(); const saved=JSON.parse(localStorage.getItem(key)||'null'); if(saved && typeof saved==='object') plan={...plan,...saved}; }
  catch(error) { plan={origin:'',departure:addDays(localDate(),1),customSkiDates:false,skiStart:'',skiEnd:'',returnDate:addDays(localDate(),6),adults:1,currency:'CAD',budget:'',pass:'all',transport:'either',names:[],destinations:{}}; console.error('Saved trip could not load:',error.message); }
  if(names?.length) plan.names=names.slice(0,3);
  if(!Array.isArray(plan.names)) plan.names=[];
  if(!plan.destinations || typeof plan.destinations!=='object') plan.destinations={};
  const dateField = (name, label, hint, required = true) => `<label>${label}<input type="date" name="${name}" value="${esc(plan[name])}" ${required ? 'required' : ''}><small>${hint}</small></label>`;
  const optionalDates = `<label class="trip-custom-toggle"><input type="checkbox" name="customSkiDates" ${plan.customSkiDates ? 'checked' : ''} aria-controls="trip-ski-dates"> Set my ski days <span>(optional)</span></label>
    <div id="trip-ski-dates" class="travel-fields" ${plan.customSkiDates ? '' : 'hidden'}>${dateField('skiStart', 'First day skiing', 'Local date at the resort.', false)}${dateField('skiEnd', 'Last day skiing', 'Local date at the resort.', false)}</div>`;
  dialog.innerHTML=`
    <header class="trip-dialog-head"><div><span class="travel-eyebrow">SNOW SCOUT · TRIP PLANNER</span><h2 id="trip-heading">Find your next snow trip</h2><p>Three resorts. The same dates. Your best way to the mountain.</p></div><button type="button" class="trip-close-button" id="trip-close" aria-label="Close trip comparison">${icon('x')}</button></header>
    <div class="trip-dialog-body"><form id="trip-form" novalidate>
      <section class="trip-form-section" aria-labelledby="trip-journey-heading"><h3 id="trip-journey-heading">Your travel plans</h3><div class="trip-core travel-fields"><label>Home airport<input name="origin" maxlength="3" value="${esc(plan.origin)}" required></label><label>Adults<select name="adults">${[1,2,3,4,5,6].map(n=>`<option ${n===plan.adults?'selected':''}>${n}</option>`).join('')}</select></label>${dateField('departure', 'Depart from home', 'Date at your home airport.')}${dateField('returnDate', 'Return flight date', 'Departure date at your destination.')}</div></section>
      <section class="trip-form-section" aria-labelledby="trip-resorts-heading"><h3 id="trip-resorts-heading">Choose your resorts <span>Up to three</span></h3><div class="trip-selectors travel-fields">${[0,1,2].map(i=>`<label>Resort ${i+1}<select name="resort${i}"><option value="">Choose a resort</option>${resorts.map(r=>`<option value="${esc(r.name)}" ${r.name===plan.names[i]?'selected':''}>${esc(r.name)}</option>`).join('')}</select></label>`).join('')}</div></section>
      <details class="trip-options" ${plan.customSkiDates ? 'open' : ''}><summary>More preferences <span>Ski days, pass, transport &amp; budget</span></summary><div class="trip-options-body">${optionalDates}<div class="trip-preferences travel-fields"><label>Currency<select name="currency">${['CAD','USD','EUR','GBP','JPY','AUD','NZD','CHF'].map(c=>`<option ${c===plan.currency?'selected':''}>${c}</option>`).join('')}</select></label><label>Budget per person<input name="budget" type="number" min="1" placeholder="Optional" value="${esc(plan.budget)}"></label><label>Your pass<select name="pass">${['all','epic','ikon','mountain-collective'].map(p=>`<option value="${p}" ${p===plan.pass?'selected':''}>${p==='all'?'No pass preference':p}</option>`).join('')}</select></label><label>Ground travel<select name="transport">${[['either','Car or transit'],['transit','Prefer no car'],['car','Prefer a rental car']].map(([v,l])=>`<option value="${v}" ${v===plan.transport?'selected':''}>${l}</option>`).join('')}</select></label></div><p class="travel-small">Your budget is a target; trip prices aren’t quoted yet. Allow for overnight flights and transfers when choosing ski days.</p></div></details>
    </form><section class="trip-comparison-section" aria-labelledby="trip-results-heading"><div class="trip-results-heading"><h3 id="trip-results-heading">Your comparison</h3><span>Forecasts are model estimates</span></div><div id="trip-results" class="trip-results"></div></section></div>
    <footer class="trip-dialog-footer"><p id="trip-message" role="status"></p><div class="trip-footer-actions"><span class="trip-save-note">Saved plans stay on this device</span><button class="travel-link" type="button" id="trip-save">Save plan</button><button class="travel-primary" type="submit" form="trip-form">Compare trips</button></div></footer>`;
  dialog.querySelector('#trip-close').onclick=()=>dialog.close();
  if(!dialog.open) dialog.showModal();
  const form=dialog.querySelector('form'), message=dialog.querySelector('#trip-message'), results=dialog.querySelector('#trip-results');
  function read(){const d=new FormData(form);return {...Object.fromEntries(d), adults:Number(d.get('adults')), customSkiDates:form.elements.customSkiDates.checked, names:[0,1,2].map(i=>d.get('resort'+i)).filter(Boolean),destinations:plan.destinations};}
  async function render(){
    const version=++generation;
    plan=read(); results.replaceChildren();
    try {
      validatePlan(plan);
      if(!plan.names.length) throw new Error('Choose at least one resort.');
      if(new Set(plan.names).size!==plan.names.length) throw new Error('Choose different resorts for comparison.');
      if(!airports){const response=await fetch(new URL('../data/travel-airports.json',import.meta.url));if(!response.ok)throw new Error('Airport catalog could not load. Try Update comparison again.');airports=(await response.json()).airports;}
      if(version!==generation || !dialog.open)return;
      if(!airports.some(a=>a.code===plan.origin))throw new Error('Choose a listed passenger airport for your home airport.');
      message.textContent='';
      for(const name of plan.names){
        const r=resorts.find(r=>r.name===name);if(!r)continue;
        const gateway=GATEWAYS[name], choices=nearbyAirports(r,airports);
        const verified=airports.find(a=>a.code===gateway?.code);if(verified&&!choices.some(a=>a.code===verified.code))choices.unshift(verified);
        const chosen=airports.find(a=>a.code===plan.destinations[name]) || verified || choices[0];
        const snow=plan.customSkiDates ? snowForSkiDates(r,plan.skiStart,plan.skiEnd) : null;
        const card=document.createElement('article');card.className='trip-card';
        card.innerHTML=`<h3>${esc(name)}</h3><dl><dt>${plan.customSkiDates ? 'Snow during your ski days' : 'Daily snow forecast · resort-local dates'}</dt><dd class="trip-snow-total">${snow===null?'Forecast unavailable, stale or outside your dates':esc(formatInches(snow))+' modeled'}</dd><dt>Operations now</dt><dd>${r.liveTerrainStatus==='ready'&&Number.isFinite(r.metrics.runsOpen)?r.metrics.runsOpen+' runs reported open':'Opening status unverified'}</dd><dt>Your pass</dt><dd>${plan.pass==='all'?'No preference':r.passes.includes(plan.pass)?'Listed on your pass — check dates and restrictions':'Not listed on your selected pass'}</dd><dt>Trip cost</dt><dd>Not quoted${plan.budget?' · target '+esc(plan.currency)+' '+esc(plan.budget)+'/person':''}</dd></dl><label>Arrival airport<select class="trip-destination">${choices.map(a=>`<option value="${a.code}" ${a.code===chosen?.code?'selected':''}>${a.code} · ${esc(a.city||a.name)}</option>`).join('')}</select></label><p class="travel-small">${gateway?esc(gateway.note):'Airport suggestions are geographic only. Resort-specific transfer service has not been verified.'}</p>${gateway?link('Official access guidance',gateway.url):''}<div class="trip-actions"></div><p class="travel-small">${plan.customSkiDates ? 'Snow totals require coverage of every ski day.' : 'Showing available forecast days only, not a total for your ski trip. Flight arrival and transfer time may reduce ski days.'} ${r.metrics.runsOpen===0?'No runs currently reported open. Confirm opening before booking.':''}</p>`;
        const select=card.querySelector('select'), actions=card.querySelector('.trip-actions');
        function updateSnow() {
          const target=card.querySelector('.trip-snow-total');
          if(plan.customSkiDates) {
            const amount=snowForSkiDates(r,plan.skiStart,plan.skiEnd);
            target.textContent=amount===null?'Forecast unavailable, stale or outside your ski dates':formatInches(amount)+' modeled';
          } else {
            const days=dailyTripForecast(r,plan.departure,plan.returnDate);
            target.replaceChildren();
            if(!days.length) target.textContent='No current forecast available for these travel dates.';
            for(const day of days) { const line=document.createElement('div'); line.textContent=day.date+' · '+formatInches(day.snow)+' modeled'; target.appendChild(line); }
          }
        }
        updateSnow();
        function actionsUpdate(){const a=airports.find(a=>a.code===select.value);if(!a)return;plan.destinations[name]=a.code;actions.innerHTML=(a.code!==plan.origin?link('Search flights',kayakFlightUrl({...plan,destination:a.code})): '<p>Arrival airport matches home. Consider ground travel.</p>')+link(plan.transport==='car'?'Driving route':'Transit options',directionsUrl(r,a,plan.transport!=='car'))+link('Find stays',lodgingUrl(r));}
        select.onchange=actionsUpdate;actionsUpdate();results.appendChild(card);
        if(snow===null && r.liveForecastStatus!=='loading') {
          loadLiveForecastForResort(r).then(()=>{
            if(version!==generation || !card.isConnected)return;
            updateSnow();
          }).catch(()=>{if(version===generation && card.isConnected)card.querySelector('.trip-snow-total').textContent='Live forecast unavailable; try updating again.';});
        }
      }
    }catch(error){message.textContent=error.message;}
  }
  form.elements.customSkiDates.addEventListener('change', () => { const enabled=form.elements.customSkiDates.checked; dialog.querySelector('#trip-ski-dates').hidden=!enabled; form.elements.skiStart.required=enabled; form.elements.skiEnd.required=enabled; });
  form.oninput=()=>{generation++;results.replaceChildren();message.textContent='Preferences changed. Update comparison to apply them.';};
  form.onsubmit=e=>{e.preventDefault();render();};
  dialog.querySelector('#trip-save').onclick=()=>{try{plan=read();validatePlan(plan);localStorage.setItem(key,JSON.stringify(plan));localStorage.setItem('snow-scout-airport',plan.origin);message.textContent='Saved on this device. Reopen Compare trips to return to this plan.';}catch(error){message.textContent='Could not save: '+error.message;}};
  form.elements.origin.oninput=e=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-Z]/g,'');};
  await render();
}
 dialog.addEventListener('close',()=>{opener?.isConnected&&opener.focus();});
export function refreshTripComparison(){if(dialog.open){dialog.querySelector('#trip-results').replaceChildren();dialog.querySelector('#trip-message').textContent='Resort data updated. Update comparison to review the latest conditions.';}}
