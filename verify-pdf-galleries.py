"""Check caption coverage, image placement, page mapping and gallery links."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import argparse
import json
import math
import numpy as np
from PIL import Image


def read(path):
    return json.loads(path.read_text().split(']=',1)[1].rstrip(';\n '))


def intersects(a,b):
    return min(a[0]+a[2],b[0]+b[2])-max(a[0],b[0])>.002 and min(a[1]+a[3],b[1]+b[3])-max(a[1],b[1])>.002


def verify(root,media,number):
    d=read(root/f'issues/{number}/pdf-pages.js');groups=d['galleryLayouts'];source_seen=set();pixel_count=0;word_count=0
    for group in groups:
        states=group['states'];flat=[p for page in group['pages'] for p in page['states']]
        assert flat==states,(number,states,'State order')
        assert not source_seen.intersection(states);source_seen.update(states)
        common=set(l[0] for l in d['pages'][states[0]])
        for state in states[1:]:common&={l[0] for l in d['pages'][state]}
        photos={l[0] for state in states for l in d['pages'][state] if l[0] not in common}
        originals={l[0] for state in states for l in d['pages'][state]}
        output={l[0] for page in group['pages'] for l in page['layers']}
        assert originals==output,(number,states,'Asset coverage')
        for page in group['pages']:
            photo_layers=[l for l in page['layers'] if l[0] in photos]
            for i,layer in enumerate(photo_layers):
                assert len(layer)==5,'Photograph was clipped'
                path=media/d['metadata'][d['assets'][layer[0]]]['path']
                with Image.open(path) as im:ratio=im.width/im.height
                assert abs(layer[3]/layer[4]-ratio)<.0001,(number,states,'Photo aspect ratio')
                assert not any(intersects(layer[1:5],other[1:5]) for other in photo_layers[i+1:])
            for layer in page['layers']:
                rect=layer[5] if len(layer)>5 else layer[1:5]
                x,y,w,h=rect
                assert x>=-.002 and y>=-.002 and x+w<=1024.002 and y+h<=768.002,(number,states,'Page bounds',rect)
                if len(layer)>5:
                    assert not any(intersects(rect,p[1:5]) for p in photo_layers),(number,states,'Caption overlaps image')
            for link in page.get('links',[]):
                assert link['url'].startswith(f'https://holmesredding.github.io/cinefex-reader/issues/{number}/index.html#page=')
        source_layers=[l for l in d['pages'][states[0]] if l[0] in common]
        captions=[l for l in source_layers if (l[3]>=1000 and l[4]>=700) or (l[3]>150 and l[2]>=85)]
        assert len(captions)==1
        original=captions[0];asset,ox,oy,ow,oh=original
        path=media/d['metadata'][d['assets'][asset]]['path']
        with Image.open(path) as im:rgba=np.asarray(im.convert('RGBA'))
        ih,iw=rgba.shape[:2];sx,sy=ow/iw,oh/ih
        ink=(rgba[:,:,:3].min(axis=2)<250)&(rgba[:,:,3]>8)
        full=ow>=1000 and oh>=700
        if full:
            for layer in d['pages'][states[0]]:
                if layer[0] not in photos:continue
                _,x,y,w,h=layer
                left=max(0,math.floor((x-ox)/sx));right=min(iw,math.ceil((x+w-ox)/sx))
                top=max(0,math.floor((y-oy)/sy));bottom=min(ih,math.ceil((y+h-oy)/sy))
                ink[top:bottom,left:right]=False
        coverage=np.zeros((ih,iw),dtype=np.uint8)
        for page in group['pages']:
            for layer in page['layers']:
                if layer[0]!=asset:continue
                if len(layer)==5:coverage+=1;continue
                _,x,y,w,h,crop=layer
                left=max(0,math.floor((crop[0]-x)*iw/w+.0001));right=min(iw,math.ceil((crop[0]+crop[2]-x)*iw/w-.0001))
                top=max(0,math.floor((crop[1]-y)*ih/h+.0001));bottom=min(ih,math.ceil((crop[1]+crop[3]-y)*ih/h-.0001))
                coverage[top:bottom,left:right]+=1;word_count+=1
        assert not (ink&(coverage==0)).any(),(number,states,'Lost source lettering',int((ink&(coverage==0)).sum()))
        body=ink.copy()
        if full:body[:math.ceil((85-oy)/sy)]=False
        assert not (body&(coverage!=1)).any(),(number,states,'Repeated caption lettering')
        pixel_count+=int(body.sum())
    page_count=len(d['pages'])-sum(len(g['states'])-len(g['pages']) for g in groups)
    return {'issue':number,'pages':page_count,'galleries':len(groups),'captionPixels':pixel_count,'captionSegments':word_count}


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--reader',type=Path,required=True);p.add_argument('--media',type=Path,required=True);p.add_argument('--report',type=Path,required=True);a=p.parse_args()
    with ThreadPoolExecutor(max_workers=4) as pool:
        results=[]
        for result in pool.map(lambda n:verify(a.reader,a.media,n),range(127,173)):
            results.append(result);print('Verified issue',result['issue'],result['galleries'],'galleries',flush=True)
    a.report.write_text(json.dumps({'issues':46,'galleries':sum(r['galleries'] for r in results),'pages':sum(r['pages'] for r in results),'captionPixels':sum(r['captionPixels'] for r in results),'details':results},indent=2))


if __name__=='__main__':main()
