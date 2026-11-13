'use strict';
const $=id=>document.getElementById(id),data=window.ISSUE,byId=new Map(data.pages.map((p,i)=>[p.ref,i]));
let frame=$('page');
const pageWidth=data.width||1024,pageHeight=data.height||768;frame.style.width=pageWidth+'px';frame.style.height=pageHeight+'px';
let current=0,fullSize=false,pageReady=false,toastTimer;const storageKey='cinefex-reader-'+data.issue;let saved=[],remembered=null;
try{const stored=JSON.parse(localStorage.getItem(storageKey)||'{}');saved=Array.isArray(stored.saved)?stored.saved.filter(id=>byId.has(id)):[];remembered=byId.has(stored.position)?stored.position:null}catch{}
function persist(){try{localStorage.setItem(storageKey,JSON.stringify({saved,position:data.pages[current].ref}));localStorage.setItem('cinefex-reader-last',String(data.issue))}catch{}}
function toast(text){$('toast').textContent=text;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2200)}
let pendingHighlight=null;
const galleryChoices=new Map();
function pruneGalleryChoices(groups){for(const group of galleryChoices.keys())if(!groups.has(group)&&group!==data.pages[current]?.group){for(const b of galleryChoices.get(group))for(const im of b.querySelectorAll('img'))CinefexSources.releaseImage(im);galleryChoices.delete(group)}}
const pageCache=createPageCache();
function fit(){const v=$('viewport'),style=getComputedStyle(v),w=v.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),h=v.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom);const scale=fullSize?1:Math.max(.05,Math.min(w/pageWidth,h/pageHeight));$('paper').style.width=pageWidth*scale+'px';$('paper').style.height=pageHeight*scale+'px';frame.style.transform=`scale(${scale})`}
function syncSaved(){const active=saved.includes(data.pages[current].ref);$('saveButton').setAttribute('aria-pressed',String(active));$('saveButton').querySelector('span').textContent=active?'Saved':'Save page';$('savedList').replaceChildren();if(!saved.length){const p=document.createElement('p');p.className='empty';p.textContent='No saved pages yet.';$('savedList').append(p)}for(const id of saved){const index=byId.get(id),p=data.pages[index],row=document.createElement('div');row.className='saved-page';const b=document.createElement('button'),title=document.createElement('span'),small=document.createElement('small');title.textContent=p.title;small.textContent=`Page ${p.group+1}${p.gallery?' · Gallery':''}`;b.append(title,small);b.onclick=()=>{show(index);closeMobileContents()};const remove=document.createElement('button');remove.textContent='×';remove.setAttribute('aria-label',`Remove saved ${p.title} page ${p.group+1}`);remove.onclick=()=>{saved=saved.filter(x=>x!==id);persist();syncSaved()};row.append(b,remove);$('savedList').append(row)}}
let galleryOpen=true;
const galleryToggle=document.createElement('button');galleryToggle.id='galleryToggle';galleryToggle.className='gallery-toggle';galleryToggle.type='button';galleryToggle.textContent='Images';galleryToggle.hidden=true;galleryToggle.setAttribute('aria-controls','galleryTray');galleryToggle.setAttribute('aria-expanded','false');document.querySelector('.reading-heading').prepend(galleryToggle);
function syncGallery(){const p=data.pages[current],available=p.gallery&&data.groups[p.group].states.length>1;galleryToggle.hidden=!available;galleryToggle.setAttribute('aria-expanded',String(available&&galleryOpen));galleryToggle.textContent=galleryOpen?'Hide images':'Images';$('galleryTray').classList.toggle('visible',available&&galleryOpen)}
galleryToggle.onclick=()=>{galleryOpen=!galleryOpen;syncGallery()};
function show(index,mode='push'){
 if(!Number.isInteger(index)||!data.pages[index])return;current=index;const p=data.pages[index],group=data.groups[p.group];
 pageCache.open(index);
 $('section').textContent=p.title;$('position').textContent=`${p.gallery?'Gallery · ':''}${p.group+1} / ${data.groups.length}`;

 $('previous').disabled=p.group===0;$('next').disabled=p.group===data.groups.length-1;$('progress').value=p.group;$('progress').setAttribute('aria-valuetext',`Page ${p.group+1} of ${data.groups.length}, ${p.title}`);const percentage=(p.group+1)/data.groups.length*100;$('progress').style.setProperty('--progress',percentage+'%');$('percent').textContent=Math.round(percentage)+'%';
 $('choices').replaceChildren();syncGallery();
 if(p.gallery&&group.states.length>1){$('galleryCount').textContent=`${group.states.indexOf(index)+1} of ${group.states.length}`;
  let choices=galleryChoices.get(p.group);
  if(!choices){choices=group.states.map((n,k)=>{const b=document.createElement('button'),im=document.createElement('img');CinefexSources.image(im,data.pages[n].preview);im.alt='';b.append(im);b.setAttribute('aria-label',`Gallery image ${k+1}`);b.title=`Image ${k+1} of ${group.states.length}`;b.onclick=()=>show(n);return b});galleryChoices.set(p.group,choices)}
  choices.forEach((b,k)=>b.setAttribute('aria-pressed',String(group.states[k]===index)));$('choices').append(...choices);
 }
 for(const s of document.querySelectorAll('.story'))s.classList.toggle('active',s.dataset.title===p.title);for(const b of document.querySelectorAll('.story-actions button')){const active=b.dataset.title===p.title&&(b.dataset.kind==='gallery')===p.gallery;b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')}
 if(mode!=='none'){const url='#page='+encodeURIComponent(p.ref);if(mode==='replace')history.replaceState(null,'',url);else if(location.hash!==url)history.pushState(null,'',url)}
 syncSaved();persist();fit();
}
function turn(delta){const g=data.groups[data.pages[current].group+delta];if(g)show(g.states[0])}
function note(text){$('noticeText').textContent=text;$('notice').showModal()}
const films=data.films;
let clipRequest=null,clipObjectURL=null,clipGeneration=0;
function releaseClip(){clipGeneration++;clipRequest?.abort();clipRequest=null;if(clipObjectURL){URL.revokeObjectURL(clipObjectURL);clipObjectURL=null}}
async function play(name){
 if(!data.videos.includes(name)){note('This clip is missing from the archive. Other clips are available under Clips.');return}
 pageCache.pause();releaseClip();const generation=clipGeneration,film=films.find(f=>f.file===name),v=$('video'),status=$('videoStatus');v.pause();v.removeAttribute('src');v.load();$('videoTitle').textContent=film?film.title+' · '+film.detail.toLowerCase():name;status.replaceChildren();if(!$('player').open)$('player').showModal();
 const source=data.mediaSources?.['assets/videos/'+name],url=source?.url||'assets/videos/'+encodeURIComponent(name);
 try{
  status.textContent='Loading clip…';
  const local=source?await CinefexSources.resolve(url,data.localAssets?.[url]):null;
  if(generation!==clipGeneration)return;
  if(local){clipObjectURL=URL.createObjectURL(local);v.src=clipObjectURL;}else if(source?.inZip){
   status.textContent='Loading clip…';clipRequest=new AbortController();const response=await fetch(url,{signal:clipRequest.signal});if(!response.ok)throw new Error('Clip unavailable');const reader=response.body.getReader(),chunks=[];let received=0;const total=source.bytes||Number(response.headers.get('Content-Length'));
   for(;;){const {done,value}=await reader.read();if(done)break;chunks.push(value);received+=value.length;if(generation!==clipGeneration)return;status.textContent=total?`Loading clip… ${Math.min(99,Math.floor(received/total*100))}%`:'Loading clip…'}
   if(generation!==clipGeneration)return;if(source.bytes&&received!==source.bytes)throw new Error('Incomplete clip');clipObjectURL=URL.createObjectURL(new Blob(chunks,{type:'video/mp4'}));v.src=clipObjectURL;
  }else v.src=url;
  status.textContent='';try{await v.play()}catch{if(generation===clipGeneration)status.textContent='Press Play to start.'}
 }catch(error){
  if(error.name==='AbortError'||generation!==clipGeneration)return;status.textContent='This clip couldn’t load. ';const retry=document.createElement('button');retry.type='button';retry.textContent='Retry';retry.onclick=()=>play(name);const open=document.createElement('a');open.textContent='Open source';open.href=url;open.target='_blank';open.rel='noopener noreferrer';open.style.marginLeft='1em';status.append(retry,open);
 }
}
$('player').addEventListener('close',releaseClip);
window.addEventListener('pagehide',releaseClip);

function route(href,fitRect){if(typeof href!=='string'||href==='#')return;if(href.startsWith('reader://state/')){const target=Number(href.slice(15));if(fitRect){try{pendingHighlight=JSON.parse(fitRect)}catch{}}show(target);}else if(href.startsWith('ns://Page/')){const id=href.slice(10),index=byId.get(id)??byId.get(id+'.1');if(index!==undefined)show(index);else note('This page is missing from the archive.')}else if(href.startsWith('ns://Video/'))play(href.slice(11));else if(href.startsWith('ns://'))note('This service is no longer available.');else if(/^(https?:|mailto:)/i.test(href))window.open(href,'_blank','noopener,noreferrer')}
function key(e){if(document.querySelector('dialog[open]'))return;if(e.ctrlKey||e.metaKey||e.altKey)return;if(e.key===' '){e.preventDefault?.();if(!e.repeat)turn(e.shiftKey?-1:1)}else if(e.key==='ArrowRight'){e.preventDefault?.();turn(1)}else if(e.key==='ArrowLeft'){e.preventDefault?.();turn(-1)}else if(e.key==='Escape'){if(galleryOpen){galleryOpen=false;syncGallery();galleryToggle.focus()}else closeMobileContents()}}
window.addEventListener('message',e=>{if(e.source!==frame.contentWindow||!e.data?.cinefex)return;if(e.data.wheel)wheel(e.data.wheel,true);else if(e.data.key)key(e.data);else route(e.data.href,e.data.fit)});
window.addEventListener('keydown',e=>{if(!e.target.closest('input,select,textarea,video,button,a,[contenteditable]:not([contenteditable=false])'))key(e)});
let wheelTotal=0,wheelLast=0,wheelTurn=0;
function wheel(e,fromPage=false){
 if(document.querySelector('dialog[open]')||e.ctrlKey||e.metaKey||e.altKey)return;
 const v=$('viewport'),dy=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?v.clientHeight:1);
 if(fullSize){if(fromPage)v.scrollBy(e.deltaX||0,dy);return}
 if(Math.abs(e.deltaX||0)>Math.abs(e.deltaY)||!dy)return;
 e.preventDefault?.();const now=performance.now(),gap=now-wheelLast;wheelLast=now;
 if(gap>180||Math.sign(dy)!==Math.sign(wheelTotal))wheelTotal=0;
 if((wheelTurn&&now-wheelTurn<450)||(wheelTurn&&gap<180&&wheelTotal===0))return;
 wheelTotal+=dy;if(Math.abs(wheelTotal)<40)return;
 turn(Math.sign(wheelTotal));wheelTotal=0;wheelTurn=now;
}
$('viewport').addEventListener('wheel',e=>wheel(e),{passive:false});
function closeMobileContents(){document.body.classList.remove('contents-open');updateContentsButton()}
function updateContentsButton(){$('contentsButton').setAttribute('aria-expanded',String(innerWidth<=760?document.body.classList.contains('contents-open'):!document.body.classList.contains('focus')))}
$('contentsButton').onclick=()=>{document.body.classList.toggle(innerWidth<=760?'contents-open':'focus');updateContentsButton();fit()};$('closeContents').onclick=closeMobileContents;$('scrim').onclick=closeMobileContents;
$('previous').onclick=()=>turn(-1);$('next').onclick=()=>turn(1);$('progress').max=data.groups.length-1;$('progress').addEventListener('input',e=>show(data.groups[Number(e.target.value)].states[0],'replace'));
$('saveButton').onclick=()=>{const id=data.pages[current].ref,existed=saved.includes(id);saved=existed?saved.filter(s=>s!==id):[...saved,id];persist();syncSaved();toast(existed?'Saved page removed':'Page saved')};
$('videosButton').onclick=()=>$('videos').showModal();$('helpButton').onclick=()=>$('help').showModal();$('coverButton').onclick=()=>{show(0);closeMobileContents()};$('indexButton').onclick=()=>{show(data.index);closeMobileContents()};
$('zoomButton').onclick=()=>{fullSize=!fullSize;$('zoomButton').textContent=fullSize?'Fit':'100%';$('zoomButton').setAttribute('aria-pressed',String(fullSize));$('zoomButton').title=fullSize?'Fit page to window':'View at original size';fit()};
$('fullscreenButton').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{toast('Use your browser’s full-screen command.')}};document.addEventListener('fullscreenchange',()=>{$('fullscreenButton').setAttribute('aria-label',document.fullscreenElement?'Exit full screen':'Full screen');fit()});
data.stories.forEach((story,i)=>{const title=story.title,s=document.createElement('section');s.className='story';s.dataset.title=title;const top=document.createElement('div');top.className='story-top';const number=document.createElement('span');number.className='story-number';number.textContent=String(i+1).padStart(2,'0');const h=document.createElement('h3');h.textContent=title;const preview=document.createElement('button');preview.className='story-preview';preview.setAttribute('aria-label',`Read ${title}`);const image=document.createElement('img');CinefexSources.image(image,story.image);image.alt='';image.loading='lazy';image.decoding='async';preview.append(image);preview.onclick=()=>{show(story.article??story.gallery);closeMobileContents()};top.append(preview,h);const actions=document.createElement('div');actions.className='story-actions';for(const [kind,label,index] of [['article','Read',story.article],['gallery','Gallery',story.gallery]]){if(index===null)continue;const b=document.createElement('button');b.textContent=label;b.dataset.title=title;b.dataset.kind=kind;b.setAttribute('aria-label',`${title}: ${label}`);b.onclick=()=>{show(index);closeMobileContents()};actions.append(b)}s.append(top,actions);$('chapterList').append(s)});
for(const film of films){const b=document.createElement('button');b.className='film-card';b.setAttribute('aria-label',`Play ${film.title}, ${film.detail.toLowerCase()}`);const art=document.createElement('div');art.className='film-art';const im=document.createElement('img');CinefexSources.image(im,film.poster);im.alt='';im.loading='lazy';const circle=document.createElement('span');circle.className='play-circle';circle.innerHTML='<svg><use href="#i-play"/></svg>';const duration=document.createElement('span');duration.className='film-duration';duration.textContent=film.duration;art.append(im,circle,duration);const title=document.createElement('strong');title.textContent=film.title;const detail=document.createElement('small');detail.textContent=film.detail;b.append(art,title,detail);b.onclick=()=>{$('videos').close();play(film.file)};$('videoList').append(b)}
for(const b of document.querySelectorAll('[data-close]'))b.onclick=()=>$(b.dataset.close).close();for(const d of document.querySelectorAll('dialog'))d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close()}});
$('player').addEventListener('close',()=>{$('video').pause();$('video').removeAttribute('src');$('video').load()});$('video').addEventListener('error',()=>{$('videoStatus').textContent='This clip couldn’t play. Close it and try again.'});
document.title=`Cinefex Reader · Issue ${data.issue}`;
document.querySelector('.issue-meta').children[0].textContent='ISSUE '+data.issue;
document.querySelector('.issue-meta').children[1].textContent=data.date.toUpperCase();
document.querySelector('h1').textContent='Contents';
const cover=document.querySelector('#coverButton img');CinefexSources.image(cover,data.cover);cover.alt='Cinefex issue '+data.issue+' cover';
document.querySelector('#coverButton strong').textContent='Issue '+data.issue;
document.querySelector('#coverButton small').textContent=data.date;
document.querySelector('.section-label > span').textContent=String(data.stories.length).padStart(2,'0')+' STORIES';

document.getElementById('filmHelp').textContent=`Use Clips or a play button on the page.`;
if(data.index===null)$('indexButton').hidden=true;
if(!data.videos.length){$('videosButton').hidden=true;const dd=$('filmHelp');dd.hidden=true;dd.previousElementSibling.hidden=true;}
if(data.edition==='archive'){const guide=document.querySelector('#help dl');guide.children[1].textContent='Turn pages with the arrow keys, Space or mousewheel. Shift–Space goes back.';guide.children[3].textContent='Use 100% to zoom; Fit to resize.';}
document.querySelector('#help dl').children[1].textContent='Turn pages with the arrow keys, Space or mousewheel. Shift–Space goes back.';
const contentsIndex=data.contentsIndex??data.pages.findIndex(p=>p.key==='masthead.html:0');
if(contentsIndex>=0&&contentsIndex!==null){const b=document.createElement('button');b.textContent='Contents page';b.id='originalContentsButton';b.onclick=()=>{show(contentsIndex);closeMobileContents()};document.querySelector('.sidebar-bottom').prepend(b);}

function fromHash(){const id=new URLSearchParams(location.hash.slice(1)).get('page');show(byId.get(id)??byId.get(remembered)??0,'none')}
window.addEventListener('popstate',fromHash);window.addEventListener('hashchange',fromHash);window.addEventListener('resize',()=>{updateContentsButton();fit()});new ResizeObserver(fit).observe($('viewport'));updateContentsButton();fromHash();

{const link=document.createElement("a");link.href="https://archive.org/details/"+data.sourceItem;link.textContent="Source files on Archive.org";link.target="_blank";link.rel="noopener noreferrer";document.querySelector("#help .about").append(document.createElement("br"),link)}

function createPageCache(){
 const entries=new Map(),failures=new Map(),attempted=new Set(),paper=$('paper'),original=frame;
 const maxPages=7,maxEstimatedBytes=96*1024*1024;
 let originalUsed=false,activeIndex=-1,direction=1,galleryDirection=1,clock=0,timer=0,loading=null;
 const connection=navigator.connection;
 function blocked(){return document.hidden||$('player').open||connection?.saveData||['slow-2g','2g'].includes(connection?.effectiveType)}
 function candidates(){
  if(activeIndex<0)return [];const p=data.pages[activeIndex],group=data.groups[p.group],result=[];
  const add=n=>{if(Number.isInteger(n)&&n!==activeIndex&&!result.includes(n))result.push(n)};
  const state=group.states.indexOf(activeIndex);if(p.gallery){add(group.states[state+galleryDirection]);add(group.states[state-galleryDirection])}
  const ahead=connection?.effectiveType==='3g'?1:3;
  for(let offset=1;offset<=ahead;offset++)add(data.groups[p.group+offset*direction]?.states[0]);
  return result.slice(0,4);
 }
 function dispose(record){
  if(record.index===activeIndex)return;
  clearTimeout(record.timeout);entries.delete(record.index);if(loading===record)loading=null;record.element.removeEventListener('load',record.loaded);
  record.element.src='about:blank';record.element.remove();
 }
 function trim(){
  let bytes=[...entries.values()].reduce((sum,r)=>sum+r.bytes,0);
  while(entries.size>maxPages||bytes>maxEstimatedBytes){
   const victim=[...entries.values()].filter(r=>r.index!==activeIndex&&r!==loading).sort((a,b)=>a.used-b.used)[0];
   if(!victim)break;bytes-=victim.bytes;dispose(victim);
  }
  pruneGalleryChoices(new Set([...entries.values()].map(r=>data.pages[r.index].group)));
 }
 function activeReady(record){
  pageReady=record.ready;
  record.element.contentWindow?.postMessage({cinefexDark:document.documentElement.dataset.theme==='dark'},'*');
  if(record.ready&&pendingHighlight){record.element.contentWindow.postMessage({cinefexHighlight:pendingHighlight},'*');pendingHighlight=null}
  fit();
 }
 function create(index,foreground){
  const element=!originalUsed?(originalUsed=true,original):document.createElement('iframe');
  element.removeAttribute('id');element.title='Cinefex magazine page';element.setAttribute('scrolling','no');element.loading='eager';
  element.style.width=pageWidth+'px';element.style.height=pageHeight+'px';element.hidden=true;element.setAttribute('aria-hidden','true');
  const record={index,element,ready:false,failed:false,used:++clock,bytes:pageWidth*pageHeight*16};
  record.loaded=()=>{
   if(entries.get(index)!==record)return;
   try{if(element.contentDocument?.URL==='about:blank')return}catch{}
   clearTimeout(record.timeout);if(!record.mediaReady)return;record.ready=true;
   try{const doc=element.contentDocument;if(doc){const images=[...doc.images];record.failed ||= images.some(im=>im.getAttribute('src')&&im.complete&&!im.naturalWidth);record.bytes=pageWidth*pageHeight*4+images.reduce((n,im)=>n+im.naturalWidth*im.naturalHeight*4,0)}}catch{}
   if(loading===record)loading=null;
   if(record.index===activeIndex)activeReady(record);
   if(record.failed){failures.set(index,Date.now()+30000);if(record.index!==activeIndex)dispose(record)}
   trim();schedule();
  };
  entries.set(index,record);element.addEventListener('load',record.loaded);
  if(!foreground){loading=record;record.timeout=setTimeout(()=>{if(record.index!==activeIndex&&entries.get(index)===record){failures.set(index,Date.now()+30000);dispose(record);schedule()}},45000)}
  if(element!==original)paper.append(element);
  element.src=data.pages[index].file+'?v=nav2';
  return record;
 }
 function pause(){clearTimeout(timer);timer=0;if(loading&&loading.index!==activeIndex){attempted.delete(loading.index);dispose(loading)}}
 function schedule(){clearTimeout(timer);if(!blocked()&&entries.get(activeIndex)?.ready)timer=setTimeout(pump,600)}
 function pump(){
  timer=0;if(blocked()||loading||!entries.get(activeIndex)?.ready)return;
  const next=candidates().find(index=>!entries.has(index)&&!attempted.has(index)&&!(failures.get(index)>Date.now()));
  if(next===undefined)return;attempted.add(next);create(next,false);trim();
 }
 function open(index){
  clearTimeout(timer);timer=0;attempted.clear();
  if(loading&&loading.index!==index)dispose(loading);
  if(activeIndex>=0){const delta=data.pages[index].group-data.pages[activeIndex].group;if(Math.abs(delta)===1)direction=Math.sign(delta);else if(delta!==0)direction=1;else if(index!==activeIndex)galleryDirection=Math.sign(index-activeIndex);if(delta!==0)galleryDirection=1}
  const previous=entries.get(activeIndex);activeIndex=index;
  if(previous&&previous.index!==index&&!previous.ready)dispose(previous);
  if(previous){previous.element.hidden=true;previous.element.setAttribute('aria-hidden','true');previous.element.removeAttribute('id')}
  let record=entries.get(index);
  if(record?.failed){activeIndex=-1;dispose(record);activeIndex=index;record=null}
  record ||= create(index,true);record.used=++clock;clearTimeout(record.timeout);if(loading===record)loading=null;
  frame=record.element;frame.id='page';frame.hidden=false;frame.removeAttribute('aria-hidden');activeReady(record);
  if(previous?.failed&&previous!==record)dispose(previous);
  trim();schedule();
 }
 addEventListener('message',event=>{
  if(!event.data?.cinefexMediaError&&!event.data?.cinefexMediaReady&&!event.data?.cinefexMediaLoading)return;
  const record=[...entries.values()].find(r=>r.element.contentWindow===event.source);if(!record)return;
  if(event.data.cinefexMediaLoading){record.mediaReady=false;record.ready=false;record.failed=false;if(record.index===activeIndex){pageReady=false;pause()}return}
  if(event.data.cinefexMediaReady){record.mediaReady=true;record.loaded();return}
  record.failed=true;failures.set(record.index,Date.now()+30000);
  if(record.index!==activeIndex){dispose(record);schedule()}
 });
 document.addEventListener('visibilitychange',()=>document.hidden?pause():schedule());
 connection?.addEventListener?.('change',()=>{pause();schedule()});
 $('player').addEventListener('close',schedule);addEventListener('pagehide',pause);
 function clear(){pause();activeIndex=-1;for(const r of [...entries.values()])dispose(r);attempted.clear();failures.clear();for(const choices of galleryChoices.values())for(const b of choices)for(const im of b.querySelectorAll('img'))CinefexSources.releaseImage(im);galleryChoices.clear();pageReady=false}
 return {open,pause,resume:schedule,clear};
}

addEventListener('cinefexsourcechange',()=>{if($('player').open)$('player').close();pageCache.clear();show(current,'none')});
{const button=document.createElement('button');button.id='readStatusButton';button.type='button';function sync(){const read=CinefexReading.isRead(data.issue);button.textContent=read?'Mark as unread':'Mark as read';button.setAttribute('aria-pressed',String(read))}button.onclick=()=>CinefexReading.setRead(data.issue,!CinefexReading.isRead(data.issue));document.querySelector('.sidebar-bottom').append(button);addEventListener('cinefexreadingchange',sync);sync()}

addEventListener('message',e=>{if(e.source===frame.contentWindow&&e.data?.cinefexOpenLocal)document.querySelector('#infoButton')?.click()});
