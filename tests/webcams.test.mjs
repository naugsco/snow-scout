import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {selectWebcams} from '../js/webcams.js';
import {resorts} from '../js/resorts.js';
import {getSourceKeyForResort} from '../js/utils.js';

test('webcam catalog covers every resort including resorts outside Epic and Ikon', () => {
  const catalog=JSON.parse(fs.readFileSync(new URL('../data/resort-webcams.json',import.meta.url)));
  assert.equal(catalog.resorts.length,resorts.length);
  assert.equal(new Set(catalog.resorts.map(r=>r.sourceKey)).size,resorts.length);
  for(const resort of resorts) {
    const entry=catalog.resorts.find(r=>r.sourceKey===getSourceKeyForResort(resort.name));
    assert.ok(entry,resort.name);
    assert.ok(entry.webcamPage?.startsWith('https://'),resort.name);
    assert.equal(selectWebcams(entry.feeds).length,entry.feeds.length,resort.name);
    if(!entry.feeds.length)assert.ok(entry.note,resort.name);
  }
  const hidden=catalog.resorts.find(r=>r.resort==='Hidden Valley');
  assert.equal(new URL(hidden.webcamPage).hostname,'www.hiddenvalleyresort.com');
});

test('missing cameras produce one honest source-page card',()=>{
  const cams=selectWebcams([], 'https://resort.example/cams');
  assert.equal(cams.length,1);
  assert.equal(cams[0].kind,'page');
  assert.match(cams[0].description,/could not be verified/);
  assert.deepEqual(selectWebcams([]),[]);
});

test('camera selection removes controls, insecure URLs, duplicate feeds and unknown types',()=>{
  const feeds=[
    {kind:'image',url:'https://player.brownrice.com/cam-control/camera-controller.php'},
    {kind:'image',url:'https://player.brownrice.com/snapshot/camera'},
    {kind:'image',url:'https://player.brownrice.com/snapshot/camera'},
    {kind:'image',url:'http://resort.example/camera.jpg'},
    {kind:'script',url:'https://resort.example/camera.js'}
  ];
  assert.equal(selectWebcams(feeds).length,1);
});

test('source links and live player URLs survive camera selection',()=>{
  const cams=selectWebcams([{kind:'image',url:'https://camera.example/snapshot',playerUrl:'https://camera.example/embed'}], 'https://resort.example/cams');
  assert.equal(cams[0].playerUrl,'https://camera.example/embed');
  assert.equal(cams[0].sourceUrl,'https://resort.example/cams');
  assert.equal(cams.filter(c=>c.kind==='page').length,1);
});
