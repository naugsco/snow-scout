import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createSnowfallChart} from '../js/snowfall-chart.js';
class Element {
  constructor(tag){this.tag=tag;this.attrs={};this.style={};this.children=[];this.textContent='';this.events={};}
  setAttribute(k,v){this.attrs[k]=v;}
  addEventListener(type,handler){this.events[type]=handler;}
  focus(){this.focused=true;}
  scrollIntoView(){this.scrolled=true;}
  appendChild(child){this.children.push(child);return child;}
}
test('the chart shows all 16 days with dates, outlook distinction, and missing snowfall kept unknown',()=>{
  const original=globalThis.document;
  globalThis.document={createElementNS:(_,tag)=>new Element(tag)};
  try {
    const days=Array.from({length:16},(_,i)=>i===12?null:i);
    const dates=days.map((_,i)=>new Date(Date.UTC(2026,10,9+i)).toISOString().slice(0,10));
    const svg=createSnowfallChart(days,dates);
    const bars=svg.children.filter(x=>x.tag==='rect');
    assert.equal(bars.length,16);
    assert.equal(bars[6].attrs.opacity,undefined);
    assert.equal(bars[7].attrs.opacity,'0.5');
    assert.match(bars[12].children[0].textContent,/unavailable/);
    assert.match(bars[15].children[0].textContent,/2026-11-24/);
    assert.ok(Number.parseInt(svg.style.minWidth)>=16*48);
    assert.equal(svg.attrs.role,'img');
    const labels=svg.children.filter(x=>x.tag==='text'&&x.children.length);
    assert.equal(labels.length,16);
    assert.notEqual(labels[0].children[0].textContent,labels[7].children[0].textContent);
  } finally {globalThis.document=original;}
});

test('day selection works with clicks and keyboard, including zero and unavailable snow; only powder indices animate',()=>{
  const original=globalThis.document;
  globalThis.document={createElementNS:(_,tag)=>new Element(tag)};
  try {
    const selected=[];
    const svg=createSnowfallChart([0,6,null],['2026-11-09','2026-11-10','2026-11-11'],{powderIndices:[1],onSelect:i=>selected.push(i)});
    assert.equal(svg.attrs.role,'group');
    assert.equal(svg.children.length,3);
    assert.equal(svg.children[0].attrs['aria-pressed'],'true');
    svg.children[1].events.click();
    assert.deepEqual(selected,[1]);
    assert.equal(svg.children[1].attrs['aria-pressed'],'true');
    assert.equal(svg.children[0].attrs.tabindex,'-1');
    const bars=svg.children.map(group=>group.children.find(x=>(x.attrs.class||'').startsWith('forecast-bar')));
    assert.equal(bars.filter(x=>x.attrs.class.includes('is-powder')).length,1);
    assert.match(svg.children[2].attrs['aria-label'],/unavailable/);
    let prevented=false;
    svg.children[1].events.keydown({key:'End',preventDefault(){prevented=true;}});
    assert.equal(prevented,true);
    assert.deepEqual(selected,[1,2]);
    assert.equal(svg.children[2].focused,true);
    assert.equal(svg.children[2].scrolled,true);
    svg.children[2].events.keydown({key:'Home',preventDefault(){}});
    assert.deepEqual(selected,[1,2,0]);
    svg.children[0].events.keydown({key:' ',preventDefault(){}});
    assert.deepEqual(selected,[1,2,0,0]);
  } finally {globalThis.document=original;}
});
