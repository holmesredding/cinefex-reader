"""Arrange PDF galleries using the selected archive's original image layers."""
import argparse
import json
import math
import re
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image

WIDTH, HEIGHT = 1024, 768


def read_assignment(path):
    text = path.read_text()
    start = text.index('{') if path.name == 'data.js' else text.index(']=') + 2
    return json.loads(text[start:].rstrip(';\n '))


def rounded(value):
    if isinstance(value, float):
        return round(value, 3)
    if isinstance(value, list):
        return [rounded(x) for x in value]
    if isinstance(value, dict):
        return {k: rounded(v) for k, v in value.items()}
    return value


class GalleryBuilder:
    def __init__(self, root, media, number):
        self.root, self.media, self.number = root, media, number
        self.folder = root / 'issues' / str(number)
        self.issue = read_assignment(self.folder / 'data.js')
        self.data = read_assignment(self.folder / 'pdf-pages.js')
        self.report = []

    def path(self, asset):
        return self.media / self.data['metadata'][self.data['assets'][asset]]['path']

    @lru_cache(maxsize=512)
    def size(self, asset):
        with Image.open(self.path(asset)) as image:
            return image.size

    def caption(self, layer, full_background, photos):
        asset, x, y, width, height = layer
        with Image.open(self.path(asset)) as image:
            rgba = np.asarray(image.convert('RGBA'))
        sy, sx = height / rgba.shape[0], width / rgba.shape[1]
        ink = (rgba[:, :, :3].min(axis=2) < 250) & (rgba[:, :, 3] > 8)
        if full_background:
            ink[:math.ceil((85 - y) / sy), :] = False
            for _, px, py, pw, ph in photos:
                x0, x1 = max(0, math.floor((px-x)/sx)), min(ink.shape[1], math.ceil((px+pw-x)/sx))
                y0, y1 = max(0, math.floor((py-y)/sy)), min(ink.shape[0], math.ceil((py+ph-y)/sy))
                ink[y0:y1, x0:x1] = False
        yy, xx = np.nonzero(ink)
        if not len(yy):
            return {'layer': layer, 'words': [], 'height': 0, 'ink': 0, 'flow': True, 'bbox': [0,0,0,0]}
        bounds = [int(xx.min()), int(yy.min()), int(xx.max())+1, int(yy.max())+1]
        bbox = [x+(bounds[0]-1)*sx, y+(bounds[1]-1)*sy,
                (bounds[2]-bounds[0]+2)*sx, (bounds[3]-bounds[1]+2)*sy]
        rows = np.flatnonzero(ink.any(axis=1))
        bands = np.split(rows, np.where(np.diff(rows) > max(3, round(2/sy)))[0]+1)
        heights = [b[-1]-b[0]+1 for b in bands]
        line_height = float(np.median(heights))
        starts = [int(b[0]) for b in bands]
        leading = float(np.median(np.diff(starts))) if len(starts)>1 else line_height*1.4
        safe = max(heights) <= line_height*1.6 and line_height*sy <= 28 and leading > line_height
        if not safe:
            return {'layer':layer,'bbox':bbox,'flow':False,'ink':int(ink.sum()),'reason':'mixed caption layout'}
        gap_limit = max(3, round(line_height*.22))
        words, spaces, covered = [], [], np.zeros_like(ink)
        source_line = 0
        for index, band in enumerate(bands):
            top, bottom = int(band[0]), int(band[-1])+1
            cols = np.flatnonzero(ink[top:bottom].any(axis=0))
            cuts = np.where(np.diff(cols)-1 >= gap_limit)[0]+1
            runs = np.split(cols, cuts)
            paragraph = index > 0 and starts[index]-starts[index-1] > leading*1.45
            if paragraph:
                source_line = 0
                paragraph_top = top
            elif index == 0:
                paragraph_top = top
            offset = (top-(paragraph_top+source_line*leading))*sy
            for wi, run in enumerate(runs):
                left, right = int(run[0]), int(run[-1])+1
                if wi:
                    spaces.append((left-int(runs[wi-1][-1])-1)*sx)
                rect = [x+(left-1)*sx,y+(top-1)*sy,(right-left+2)*sx,(bottom-top+2)*sy]
                words.append({'rect':rect,'offset':offset,'paragraph':paragraph and wi==0})
                assert not covered[top:bottom,left:right].any()
                covered[top:bottom,left:right] = True
            source_line += 1
        assert not (ink & ~covered).any(), 'Caption pixels were omitted'
        return {'layer':layer,'bbox':bbox,'words':words,'leading':leading*sy,
                'space':max(1.5,float(np.median(spaces))-2*sx) if spaces else 4,
                'flow':True,'ink':int(ink.sum()),'covered':int((ink&covered).sum())}

    def flow(self, caption, width):
        if not caption['flow']:
            if caption['bbox'][2] > width:
                return None
            return [([0,0],caption['bbox'])],caption['bbox'][3]
        if not caption['words']:
            return [],0
        x, y, bottom, positioned = 0, 0, 0, []
        for word in caption['words']:
            rect = word['rect']
            if rect[2] > width:
                return None
            if word['paragraph']:
                x=0; y+=caption['leading']*1.5
            elif x and x+rect[2] > width:
                x=0; y+=caption['leading']
            placed_y = y+word['offset']
            positioned.append(([x,placed_y],rect))
            bottom=max(bottom,placed_y+rect[3])
            x+=rect[2]+caption['space']
        return positioned,bottom

    @staticmethod
    def clip(layer, rect, tx=None, ty=None):
        asset,x,y,w,h=layer
        rx,ry,rw,rh=rect
        tx=rx if tx is None else tx
        ty=ry if ty is None else ty
        return [asset,x+tx-rx,y+ty-ry,w,h,[tx,ty,rw,rh]]

    def caption_layers(self, caption, positioned, left, top):
        return [self.clip(caption['layer'],rect,left+pos[0],top+pos[1]) for pos,rect in positioned]

    def fit_photo(self, layer, box):
        asset=layer[0];iw,ih=self.size(asset);x,y,w,h=box
        scale=min(w/iw,h/ih)
        pw,ph=iw*scale,ih*scale
        return [asset,x+(w-pw)/2,y+(h-ph)/2,pw,ph]

    def build_group(self, states):
        original=[self.data['pages'][i] for i in states]
        shared=set(l[0] for l in original[0])
        for layers in original[1:]:
            shared &= {l[0] for l in layers}
        photos=[[l for l in layers if l[0] not in shared] for layers in original]
        if any(len(p)!=1 for p in photos):
            self.report.append({'states':states,'kept':'different captions'})
            return None
        photos=[p[0] for p in photos]
        common=[l for l in original[0] if l[0] in shared]
        backgrounds=[l for l in common if l[3]>=1000 and l[4]>=700]
        if backgrounds:
            assert len(backgrounds)==1
            background=backgrounds[0]
            header=[self.clip(background,[0,0,WIDTH,85])]
            caption=self.caption(background,True,photos)
            extras=[l for l in common if l is not background]
        else:
            header=[l for l in common if l[2]<85]
            caption_layers=[l for l in common if l[3]>150 and l[2]>=85]
            if len(caption_layers)!=1:
                raise ValueError(f'Unrecognised caption {self.number}/{states}')
            caption=self.caption(caption_layers[0],False,photos)
            extras=[l for l in common if l not in header+caption_layers]
        links=[];seen=set()
        for index in states:
            html=(self.folder/self.issue['pages'][index]['file']).read_text()
            videos=list(dict.fromkeys(re.findall(r'href="(ns://Video/[^\"]+)"',re.sub(r'<!--.*?-->', '', html, flags=re.S))))
            source_links=[l for l in self.data['links'].get(str(index),[]) if l.get('url')]
            if len(videos)>1:
                raise ValueError(f'Multiple videos on one state {self.number}/{index}')
            if videos and videos[0] not in seen and source_links:
                seen.add(videos[0]);links.append(source_links[0]['url'])
        icon=extras[0] if extras else None
        if len(extras)>1:
            raise ValueError(f'Extra gallery images {self.number}/{states}')
        icon_count=max(len(links),1 if icon else 0)
        text=self.data.get('texts',{}).get(str(states[0]),[])

        def page(placed, own_states, caption_position=None, icon_position=None, kind='grid'):
            layers=[list(l) for l in header]+placed
            result={'layers':layers,'states':own_states,'texts':text,'links':[]}
            if caption_position:
                pos,cx,cy=caption_position
                layers.extend(self.caption_layers(caption,pos,cx,cy))
            if icon and icon_position:
                ix,iy=icon_position
                for j in range(icon_count):
                    box=[ix+j*64,iy,48,48]
                    layers.append([icon[0],*box])
                    if j<len(links):result['links'].append({'rect':box,'url':links[j]})
                    if icon_count>1:
                        result['texts']=result['texts']+[{'text':str(j+1),'x':box[0]+20,'y':iy+62,'size':10,'color':[.35,.35,.35],'bold':False}]
            result['kind']=kind
            return result

        n=len(photos);pages=[]
        ratios=[self.size(p[0])[0]/self.size(p[0])[1] for p in photos]
        # Wide comparison images leave room for a readable caption column.
        flowed=self.flow(caption,210)
        if n==2 and min(ratios)>=1.9 and flowed and flowed[1]+(80 if icon else 0)<=604:
            height=sum(664/r for r in ratios)+20
            if height<=604:
                placed=[];top=100
                for p,r in zip(photos,ratios):
                    placed.append(self.fit_photo(p,[60,top,664,664/r]));top+=664/r+20
                pages=[page(placed,states,(flowed[0],754,100),(754,124+flowed[1]) if icon else None,'comparison')]
        # Three photographs use the fourth grid cell for their caption.
        if not pages and n==3:
            flowed=self.flow(caption,420)
            row_height=max(442/r for r in ratios)
            if flowed and row_height*2+20<=604 and flowed[1]+(80 if icon else 0)<=row_height:
                placed=[self.fit_photo(p,[60+(i%2)*462,100+(i//2)*(row_height+20),442,row_height]) for i,p in enumerate(photos)]
                pages=[page(placed,states,(flowed[0],534,100+row_height+20),(534,144+row_height+flowed[1]) if icon else None,'three')]
        if not pages:
            remaining=list(zip(photos,states));first=True
            while remaining:
                count=min(4,len(remaining))
                while True:
                    cols=2 if count>1 else 1;rows=math.ceil(count/cols)
                    caption_width=764 if icon and first else 904
                    flowed=self.flow(caption,caption_width) if first else ([],0)
                    if not flowed:
                        raise ValueError(f'Caption does not fit {self.number}/{states}')
                    footer=max(flowed[1],64 if icon and first else 0)
                    available=HEIGHT-100-32-(footer+24 if footer else 0)
                    cellw=(904-(cols-1)*20)/cols;cellh=(available-(rows-1)*20)/rows
                    placed=[self.fit_photo(p,[60+(i%cols)*(cellw+20),100+(i//cols)*(cellh+20),cellw,cellh]) for i,(p,_) in enumerate(remaining[:count])]
                    quality=min((p[3]*p[4])/(old[3]*old[4]) for p,(old,_) in zip(placed,remaining[:count]))
                    if quality>=.18 or count==1:
                        break
                    count-=1
                footer_top=100+available+24
                pages.append(page(placed,[s for _,s in remaining[:count]],(flowed[0],60,footer_top) if first else None,(836,footer_top) if icon and first else None,'grid' if len(pages)==0 else 'continued'))
                remaining=remaining[count:];first=False
        all_original={l[0] for ls in original for l in ls}
        all_output={l[0] for p in pages for l in p['layers']}
        assert all_output==all_original,(self.number,states,'Asset coverage',all_original-all_output)
        for p in pages:
            for layer in p['layers']:
                rect=layer[5] if len(layer)>5 else layer[1:]
                x,y,w,h=rect
                assert x>=-.01 and y>=-.01 and x+w<=1024.01 and y+h<=768.01,(self.number,states,rect)
        self.report.append({'states':states,'pages':len(pages),'kinds':[p['kind'] for p in pages],
                            'captionInk':caption['ink'],'captionCovered':caption.get('covered',caption['ink']),
                            'captionWords':len(caption.get('words',[])),'captionFlow':caption['flow'],
                            'videoLinks':len(links)})
        for p in pages:p.pop('kind')
        return {'states':states,'pages':pages}

    def build(self):
        layouts=[]
        for group in self.issue['groups']:
            states=group['states']
            if len(states)<2:continue
            assert states==list(range(states[0],states[-1]+1))
            result=self.build_group(states)
            if result:layouts.append(result)
        self.data['galleryLayouts']=layouts
        self.data['galleryVersion']=1
        page_count=len(self.data['pages'])-sum(len(g['states'])-len(g['pages']) for g in layouts)
        self.data.setdefault('sourceEstimatedBytes', self.data['estimatedBytes'])
        self.data['estimatedBytes']=self.data['sourceEstimatedBytes']+sum(len(p['layers'])*32 for g in layouts for p in g['pages'])
        return rounded(self.data),page_count


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--reader',type=Path,required=True)
    parser.add_argument('--media',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--issues',default='127-172')
    args=parser.parse_args();args.output.mkdir(parents=True,exist_ok=True)
    reports=[]
    for part in args.issues.split(','):
        bounds=list(map(int,part.split('-')))
        numbers=range(bounds[0],bounds[-1]+1)
        for number in numbers:
            builder=GalleryBuilder(args.reader,args.media,number)
            data,count=builder.build()
            (args.output/f'{number}.json').write_text(json.dumps(data,separators=(',',':')))
            report={'issue':number,'oldPages':len(data['pages']),'pages':count,'groups':builder.report}
            reports.append(report)
            print(f'Issue {number}: {len(data["pages"])} -> {count} pages, {len(data["galleryLayouts"])} galleries',flush=True)
    (args.output/'report.json').write_text(json.dumps(reports,indent=2))


if __name__=='__main__':main()
