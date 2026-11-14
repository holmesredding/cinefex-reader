(()=>{'use strict';parent.postMessage({cinefexMediaLoading:true},'*');let banner;const urls=new Set(),objects=[];function failed(local=false){parent.postMessage({cinefexMediaError:true},'*');if(banner)return;banner=document.createElement('div');banner.setAttribute('role','alert');banner.style.cssText='position:fixed;bottom:12px;left:12px;right:12px;z-index:99999;padding:12px 16px;background:#252723;color:#fff;font:15px system-ui;display:flex;align-items:center;justify-content:space-between;gap:12px';const text=document.createElement('span');text.textContent=local?'This image is unavailable from Internet Archive.':'Some images could not load.';const button=document.createElement('button');button.type='button';button.textContent=local?'Choose folder':'Retry';button.style.cssText='font:inherit;background:transparent;color:inherit;border:1px solid #aaa;padding:5px 12px;cursor:pointer';button.onclick=()=>local?parent.postMessage({cinefexOpenLocal:true},'*'):location.reload();banner.append(text,button);document.body.append(banner)}const images=[...document.images],backgrounds=[...document.querySelectorAll('[data-media-background]')];for(const im of images)if(im.dataset.mediaSrc)urls.add(im.dataset.mediaSrc);for(const el of backgrounds)urls.add(el.dataset.mediaBackground);function resolve(){if(!urls.size||parent===window)return Promise.resolve(new Map());return new Promise(done=>{const id='media-'+Math.random().toString(36).slice(2);let timer;function finish(map){clearTimeout(timer);removeEventListener('message',receive);done(map)}function receive(e){if(e.source!==parent||e.data?.cinefexResolvedMedia!==id)return;const map=new Map();for(const entry of e.data.entries||[])if(entry.blob){const u=URL.createObjectURL(entry.blob);objects.push(u);map.set(entry.url,u)}finish(map)}addEventListener('message',receive);timer=setTimeout(()=>finish(new Map()),30000);parent.postMessage({cinefexResolveMedia:id,urls:[...urls]},'*')})}function loaded(im){return new Promise(done=>{if(im.complete&&im.getAttribute('src')){if(!im.naturalWidth)failed();done();return}im.addEventListener('load',done,{once:true});im.addEventListener('error',()=>{failed();done()},{once:true});if(!im.getAttribute('src'))done()})}(async()=>{const sources=await resolve(),jobs=[];for(const im of images){const u=im.dataset.mediaSrc;if(u){if(u.startsWith('local-media:')&&!sources.has(u)){im.src='data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/%3E';failed(true)}else im.src=sources.get(u)||u;}jobs.push(loaded(im))}for(const el of backgrounds){const u=sources.get(el.dataset.mediaBackground)||el.dataset.mediaBackground;el.style.backgroundImage=`url("${u}")`;const probe=new Image();probe.src=u;jobs.push(loaded(probe))}await Promise.all(jobs);await(window.cinefexFontsReady||Promise.resolve());if(document.readyState!=='complete')await new Promise(done=>addEventListener('load',done,{once:true}));parent.postMessage({cinefexMediaReady:true},'*')})().catch(()=>{failed();parent.postMessage({cinefexMediaReady:true},'*')});addEventListener('pagehide',()=>{for(const u of objects)URL.revokeObjectURL(u)});})();

(()=>{
 const controls=e=>e.target.closest('input,select,textarea,video,button,[contenteditable]:not([contenteditable=false])');
 const interactive=e=>controls(e)||e.target.closest('a,area');
 document.addEventListener('keydown',e=>{if(e.key!==' '||interactive(e)||e.ctrlKey||e.metaKey||e.altKey)return;e.preventDefault();parent.postMessage({cinefex:true,key:e.key,shiftKey:e.shiftKey,repeat:e.repeat},'*')});
 document.addEventListener('wheel',e=>{if(controls(e)||e.metaKey||e.altKey)return;e.preventDefault();parent.postMessage({cinefex:true,wheel:{deltaX:e.deltaX,deltaY:e.deltaY,deltaMode:e.deltaMode,ctrlKey:e.ctrlKey,clientX:e.clientX,clientY:e.clientY}},'*')},{passive:false});
 document.documentElement.style.touchAction='none';document.body.style.touchAction='none';
 let first=null,suppressUntil=0,panZoomed=false,mouseDrag=null;
 const panStyle=document.createElement('style');
 panStyle.textContent='html[data-reader-pan-zoom] body{cursor:grab;user-select:none;-webkit-user-select:none}html[data-reader-pan-zoom] img{cursor:inherit}html[data-reader-pan-drag] body,html[data-reader-pan-drag] body *{cursor:grabbing!important}html[data-reader-pan-zoom] input,html[data-reader-pan-zoom] textarea,html[data-reader-pan-zoom] [contenteditable]{user-select:text;-webkit-user-select:text}';
 document.head.append(panStyle);
 function stopMouse(){const drag=mouseDrag;mouseDrag=null;if(drag&&drag.target.hasPointerCapture(drag.id))drag.target.releasePointerCapture(drag.id)}
 function mouseMessage(e){return {type:e.type,pointerType:e.pointerType,pointerId:e.pointerId,screenX:e.screenX,screenY:e.screenY,button:e.button,buttons:e.buttons,ctrlKey:e.ctrlKey,metaKey:e.metaKey,altKey:e.altKey};}
 addEventListener('message',e=>{
  if(e.source!==parent)return;
  if(e.data?.cinefexPanMode){panZoomed=!!e.data.cinefexPanMode.zoomed;document.documentElement.toggleAttribute('data-reader-pan-zoom',panZoomed);document.documentElement.toggleAttribute('data-reader-pan-drag',!!e.data.cinefexPanMode.dragging);if(!panZoomed)stopMouse()}
  if(e.data?.cinefexPanCancel)stopMouse();
 });
 document.addEventListener('pointerdown',e=>{
  if(!panZoomed||e.pointerType!=='mouse'||e.button!==0||e.ctrlKey||e.metaKey||e.altKey||controls(e))return;
  mouseDrag={id:e.pointerId,x:e.screenX,y:e.screenY,moved:false,target:e.target};
  try{e.target.setPointerCapture(e.pointerId)}catch{}
  e.preventDefault();parent.postMessage({cinefex:true,mouse:mouseMessage(e)},'*');
 });
 for(const type of ['pointermove','pointerup','pointercancel','lostpointercapture'])document.addEventListener(type,e=>{
  if(!mouseDrag||mouseDrag.id!==e.pointerId)return;
  if(Math.hypot(e.screenX-mouseDrag.x,e.screenY-mouseDrag.y)>4)mouseDrag.moved=true;
  if(mouseDrag.moved)suppressUntil=performance.now()+700;
  e.preventDefault();parent.postMessage({cinefex:true,mouse:mouseMessage(e)},'*');
  if(type!=='pointermove'||!(e.buttons&1))stopMouse();
 });
 document.addEventListener('dragstart',e=>{if(panZoomed&&!controls(e))e.preventDefault()});
 addEventListener('blur',()=>{if(mouseDrag){parent.postMessage({cinefex:true,mouse:{type:'pointercancel',pointerId:mouseDrag.id}},'*');stopMouse()}});
 parent.postMessage({cinefex:true,panReady:true},'*');
 const points=list=>[...list].map(t=>({x:t.screenX,y:t.screenY,cx:t.clientX,cy:t.clientY}));
 for(const type of ['touchstart','touchmove','touchend','touchcancel'])document.addEventListener(type,e=>{
  if(controls(e))return;
  if(type==='touchstart'&&!first&&e.touches.length)first={x:e.touches[0].screenX,y:e.touches[0].screenY};
  const point=e.touches[0]||e.changedTouches[0];
  const moved=first&&point&&Math.hypot(point.screenX-first.x,point.screenY-first.y)>8;
  if(e.touches.length>1||moved)suppressUntil=performance.now()+700;
  if(type==='touchmove'||e.touches.length>1)e.preventDefault();
  parent.postMessage({cinefex:true,touch:{type,points:points(e.touches),changed:points(e.changedTouches),interactive:!!interactive(e)}},'*');
  if(!e.touches.length||type==='touchcancel')first=null;
 },{passive:false});
 document.addEventListener('click',e=>{if(performance.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation()}},true);
 for(const type of ['gesturestart','gesturechange'])document.addEventListener(type,e=>e.preventDefault(),{passive:false});
})();
