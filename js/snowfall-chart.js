import { formatInches } from './utils.js?v=20261106-mountain-weather';
const SVG_NS = 'http://www.w3.org/2000/svg';

export function createSnowfallChart(dailySnowfall, dailyTime, options = {}) {
  const days = dailySnowfall.slice(0, 16);
  if (!days.length) return null;
  const interactive = typeof options.onSelect === 'function';
  const width = Math.max(320, days.length * (interactive ? 64 : 48));
  const height = interactive ? 210 : 140;
  const gap = 10, topPad = 30, bottomPad = 44;
  const plotHeight = height - topPad - bottomPad;
  const barWidth = (width - gap * (days.length + 1)) / days.length;
  const max = Math.max(...days.filter(Number.isFinite), 1);
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('role', interactive ? 'group' : 'img');
  svg.setAttribute('aria-label', `${days.length}-day snowfall forecast.${interactive ? ' Select a day for details. Arrow keys change day.' : ''} Days 8 onward are a longer-range outlook.`);
  svg.style.display = 'block';
  svg.style.minWidth = `${width}px`;
  const targets = [];
  let selected = Math.max(0, Math.min(days.length-1, options.selectedIndex || 0));
  const select = index => {
    selected = index;
    targets.forEach((target,i) => {
      target.setAttribute('aria-pressed', String(i === index));
      target.setAttribute('tabindex', i === index ? '0' : '-1');
    });
    options.onSelect(index);
  };
  days.forEach((amount,i) => {
    const x = gap + i * (barWidth + gap);
    const powder = options.powderIndices?.includes(i) || false;
    const date = dailyTime?.[i];
    const dateLabel = date ? new Date(`${date}T12:00:00`) : null;
    const accessibleDate = dateLabel ? dateLabel.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'}) : `Day ${i+1}`;
    const titleText = `${accessibleDate}: ${Number.isFinite(amount) ? formatInches(amount)+' snowfall' : 'Snowfall unavailable'}${powder ? ' · Potential powder day' : ''}${i>=7 ? ' · Longer-range outlook' : ''}`;
    const group = document.createElementNS(SVG_NS, 'g');
    if (interactive) {
      group.setAttribute('role','button');
      group.setAttribute('tabindex',i===selected?'0':'-1');
      group.setAttribute('aria-pressed',String(i===selected));
      group.setAttribute('aria-label',titleText);
      group.setAttribute('class','forecast-day-target');
      group.setAttribute('data-day-index',String(i));
      targets.push(group);
      const hit = document.createElementNS(SVG_NS,'rect');
      hit.setAttribute('x',x-gap/2);hit.setAttribute('y',0);
      hit.setAttribute('width',barWidth+gap);hit.setAttribute('height',height);
      hit.setAttribute('rx',6);hit.setAttribute('fill','transparent');
      hit.setAttribute('class','forecast-day-hit');group.appendChild(hit);
      group.addEventListener('click',()=>select(i));
      group.addEventListener('keydown',event=>{
        let next;
        if (event.key==='Enter'||event.key===' ') {event.preventDefault();select(i);return;}
        if(event.key==='ArrowRight')next=Math.min(days.length-1,i+1);
        if(event.key==='ArrowLeft')next=Math.max(0,i-1);
        if(event.key==='Home')next=0;
        if(event.key==='End')next=days.length-1;
        if(next===undefined)return;
        event.preventDefault();select(next);targets[next].focus();
        targets[next].scrollIntoView({block:'nearest',inline:'nearest'});
      });
    }
    const barHeight = Number.isFinite(amount) ? Math.max(amount/max*plotHeight,2) : 0;
    const y = topPad+plotHeight-barHeight;
    const bar = document.createElementNS(SVG_NS,'rect');
    bar.setAttribute('x',x);bar.setAttribute('y',y);bar.setAttribute('width',barWidth);bar.setAttribute('height',barHeight);bar.setAttribute('rx',4);
    bar.setAttribute('fill',amount>0?'var(--incoming, #4da0ff)':'rgba(255,255,255,0.12)');
    bar.setAttribute('class',`forecast-bar${powder?' is-powder':''}${i>=7?' is-outlook':''}`);
    if(i>=7){bar.setAttribute('opacity','0.5');bar.setAttribute('stroke','var(--muted)');bar.setAttribute('stroke-dasharray','3 2');}
    const title=document.createElementNS(SVG_NS,'title');
    title.textContent=`${date || 'Day '+(i+1)}: ${titleText}`;bar.appendChild(title);
    group.appendChild(bar);
    const amountText=document.createElementNS(SVG_NS,'text');
    amountText.setAttribute('x',x+barWidth/2);amountText.setAttribute('y',y-7);
    amountText.setAttribute('text-anchor','middle');amountText.setAttribute('fill','var(--text)');
    amountText.setAttribute('font-size',interactive?'13':'10');amountText.setAttribute('font-weight','600');
    amountText.textContent=formatInches(amount);group.appendChild(amountText);
    const label=document.createElementNS(SVG_NS,'text');
    label.setAttribute('x',x+barWidth/2);label.setAttribute('y',height-25);
    label.setAttribute('text-anchor','middle');label.setAttribute('fill','var(--muted)');label.setAttribute('font-size',interactive?'12':'10');
    label.textContent=dateLabel ? dateLabel.toLocaleDateString(undefined,{weekday:'short'}) : `D${i+1}`;
    if(dateLabel){const day=document.createElementNS(SVG_NS,'tspan');day.setAttribute('x',x+barWidth/2);day.setAttribute('dy','17');day.textContent=dateLabel.toLocaleDateString(undefined,{month:'short',day:'numeric'});label.appendChild(day);}
    group.appendChild(label);
    if(interactive) svg.appendChild(group);
    else { // Keep static comparison charts available without adding interaction.
      svg.appendChild(bar);svg.appendChild(amountText);svg.appendChild(label);
    }
  });
  return svg;
}
