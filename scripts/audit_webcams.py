#!/usr/bin/env python3
"""Probe camera URLs with bounded GETs and record reproducible evidence."""
import concurrent.futures, datetime, http.client, json, pathlib, re, urllib.request, urllib.error, urllib.parse
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'output/webcam-audit'

def probe(url):
    result={'url':url}
    try:
        url=urllib.parse.quote(url,safe=":/?&=%#@+;,~!$()*[]")
        req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0','Range':'bytes=0-131071'})
        with urllib.request.urlopen(req, timeout=18) as response:
            data=response.read(131072)
            ct=response.headers.get('Content-Type','').lower()
            result.update(status=response.status,finalUrl=response.url,contentType=ct,
                          frameOptions=response.headers.get('X-Frame-Options',''),
                          csp=response.headers.get('Content-Security-Policy',''),
                          cors=response.headers.get('Access-Control-Allow-Origin',''),
                          lastModified=response.headers.get('Last-Modified',''))
            text=data.decode('utf-8','replace')
            if data.startswith((b'\xff\xd8\xff',b'\x89PNG',b'GIF8',b'RIFF')): kind='image'
            elif text.lstrip().startswith('#EXTM3U'): kind='hls'
            elif 'video/' in ct: kind='video'
            elif 'multipart/x-mixed-replace' in ct: kind='mjpeg'
            elif '<html' in text.lower() or '<!doctype' in text.lower(): kind='html'
            else: kind='other'
            result['detectedKind']=kind
            if kind=='html':
                result['title']=' '.join(re.findall(r'<title[^>]*>(.*?)</title>',text,re.I|re.S))[:250]
                result['candidates']=list(dict.fromkeys(re.findall(r'''(?:https?:)?//[^\s<>"'\\]+(?:\.m3u8|\.jpg|\.jpeg|\.png|/embed/[^\s<>"'\\]+)[^\s<>"'\\]*''',text)))[:100]
                (OUT/'html').mkdir(exist_ok=True)
                import hashlib
                (OUT/'html'/ (hashlib.sha256(url.encode()).hexdigest()[:16]+'.html')).write_text(text)
            if kind=='hls':
                result['playlist']=text[:12000]
    except (urllib.error.URLError,TimeoutError,OSError,ValueError,http.client.HTTPException,UnicodeError) as exc:
        result.update(error=str(exc),status=getattr(exc,'code',None))
    return result

def probe_hls(url):
    """Check a master, child playlist, and a real media segment, including CORS."""
    chain=[]
    for _ in range(4):
        result=probe(url)
        chain.append(result)
        if result.get('detectedKind')!='hls':
            return {'ok': result.get('detectedKind')=='video' and all(r.get('cors')=='*' for r in chain), 'chain':chain}
        entries=[line.strip() for line in result.get('playlist','').splitlines() if line.strip() and not line.startswith('#')]
        if not entries: return {'ok':False,'chain':chain,'error':'Empty playlist'}
        url=urllib.parse.urljoin(result.get('finalUrl',url),entries[0])
    return {'ok':False,'chain':chain,'error':'Playlist nesting exceeds audit limit'}

def main():
    OUT.mkdir(exist_ok=True,parents=True)
    catalog=json.loads((ROOT/'data/resort-webcams.json').read_text())
    urls=list(dict.fromkeys(u for r in catalog['resorts'] for u in
        [r.get('webcamPage'), *[f['url'] for f in r['feeds']],
         *[f.get('playerUrl') for f in r['feeds']]] if u))
    results=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        for i,r in enumerate(pool.map(probe,urls)):
            results.append(r)
            if i%50==0: print(f'{i+1}/{len(urls)} checked',flush=True)
    lookup={r['url']:r for r in results}
    checks=[]
    for resort in catalog['resorts']:
        feeds=[]
        for feed in resort['feeds']:
            result=lookup[feed['url']]
            expected='html' if feed['kind']=='iframe' else feed['kind']
            ok=result.get('detectedKind')==expected and not (feed['kind']=='iframe' and result.get('frameOptions'))
            hls=probe_hls(feed['url']) if feed['kind']=='hls' else None
            if hls: ok=ok and hls['ok']
            feeds.append({'url':feed['url'],'kind':feed['kind'],'ok':ok,'result':result, 'hls':hls})
        checks.append({'resort':resort['resort'],'feeds':feeds,'page':lookup.get(resort.get('webcamPage'))})
    report={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'resorts':checks,'results':results}
    (OUT/'catalog-audit.json').write_text(json.dumps(report,indent=2))
    failures=[(r['resort'],f['url']) for r in checks for f in r['feeds'] if not f['ok']]
    print(json.dumps({'resorts':len(checks),'urls':len(results),'failedFeeds':failures},indent=2),flush=True)
if __name__=='__main__':main()
