'use strict';
// Full-text search over every page (assets/data/search/, built by scripts/indexing/build-search.py).
const $=id=>document.getElementById(id);
const STOP=new Set(`the a an and or of to in on at by for with from as is was were be been are it its this that these those
he she they his her their we our you your i me my not no but so if then than there here which who whom what when where
how all any each also into over out up down about after before more most such only own same can could would should will
just very had has have do did does one two`.split(/\s+/));
const fold=s=>s.normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase();
const tokens=s=>fold(s).replace(/['’]/g,'').match(/[a-z0-9]+/g)||[];
const catalog=Object.fromEntries((window.CATALOG||[]).map(x=>[x.issue,x]));
const PAGE=25;
let meta=null,run=0,state=null;
const shards=new Map(),texts=new Map();
const json=url=>fetch(url).then(r=>{if(!r.ok)throw Error(url);return r.json()});
const loadMeta=async()=>meta||(meta=(await json('assets/data/search/meta.json')).issues);
const shard=w=>{const k=w.slice(0,2);if(!shards.has(k))shards.set(k,json(`assets/data/search/words/${k}.json`).catch(()=>({})));return shards.get(k)};
const issueText=n=>{if(!texts.has(n))texts.set(n,json(`assets/data/search/text/${n}.json`).catch(()=>null));return texts.get(n)};
const decode=s=>{const out=[];let v=0;if(s)for(const t of s.split(',')){v+=parseInt(t,36);out.push(v)}return out};
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

function parse(q){
 const phrases=[...q.matchAll(/"([^"]+)"|“([^”]+)”/g)].map(m=>(m[1]||m[2]).trim()).filter(Boolean);
 const rest=q.replace(/"[^"]*"|“[^”]*”/g,' ');
 const terms=[],seen=new Set();
 const add=(w,prefix)=>{if(w.length<2||(!prefix&&STOP.has(w))||seen.has(w+prefix))return;seen.add(w+prefix);terms.push({w,prefix})};
 for(const p of phrases)for(const w of tokens(p))add(w,false);
 for(const raw of rest.split(/\s+/).filter(Boolean)){const pre=raw.endsWith('*');for(const w of tokens(raw))add(w,pre&&raw.replace(/\*$/,'').toLowerCase().endsWith(w))}
 const marks=[...phrases.map(p=>tokens(p).map(escape).join('\\W+')),...terms.filter(t=>!phrases.some(p=>tokens(p).includes(t.w))).map(t=>escape(t.w)+(t.prefix?'\\w*':''))].filter(Boolean);
 return {phrases,terms,mark:marks.length?new RegExp(`\\b(?:${marks.join('|')})\\b`,'gi'):null,phraseRx:phrases.map(p=>new RegExp(`\\b${tokens(p).map(escape).join('\\W+')}\\b`,'i'))};
}
async function pagesFor(t){
 const table=await shard(t.w);
 if(!t.prefix)return decode(table[t.w]);
 const all=new Set();for(const [w,s] of Object.entries(table))if(w.startsWith(t.w))for(const k of decode(s))all.add(k);
 return [...all].sort((a,b)=>a-b);
}
function intersect(lists){
 lists.sort((a,b)=>a.length-b.length);let out=lists[0]||[];
 for(const l of lists.slice(1)){const s=new Set(l);out=out.filter(k=>s.has(k))}
 return out;
}
const yearOf=n=>(meta?.[n]?.[0]?.match(/\d{4}/)||[''])[0];

async function search(update=true){
 const id=++run,q=$('q').value.trim(),kind=$('kind').value,year=$('year').value,order=$('order').value;
 if(update){const p=new URLSearchParams();if(q)p.set('q',q);if(kind)p.set('kind',kind);if(year)p.set('year',year);if(order!=='oldest')p.set('order',order);history.replaceState(null,'',location.pathname+(p.size?'?'+p:''))}
 $('results').replaceChildren();$('more').hidden=true;$('searchNote').hidden=true;
 if(!q){$('resultCount').textContent='';return}
 const query=parse(q);
 if(!query.terms.length){$('resultCount').textContent='';note('Add a word that is not as common as “the” or “and”.');return}
 $('resultCount').textContent='SEARCHING…';
 try{await loadMeta()}catch{if(id===run){$('resultCount').textContent='';note('The search index is not installed with this copy of the reader.')}return}
 let keys=intersect(await Promise.all(query.terms.map(pagesFor)));
 if(id!==run)return;
 keys=keys.filter(k=>{const n=Math.floor(k/1000),i=k%1000,ads=meta[n]?.[2]||[];if(year&&yearOf(n)!==year)return false;if(kind==='ads'&&!ads.includes(i))return false;if(kind==='articles'&&ads.includes(i))return false;return true});
 if(order==='newest')keys.sort((a,b)=>Math.floor(b/1000)-Math.floor(a/1000)||a%1000-b%1000);
 state={id,query,keys,next:0,shown:0};
 await more();
}
async function more(){
 const s=state;if(!s||s.id!==run)return;$('more').hidden=true;
 const batch=[];
 while(batch.length<PAGE&&s.next<s.keys.length){
  const k=s.keys[s.next++],n=Math.floor(k/1000),i=k%1000,t=await issueText(n);
  if(s.id!==run)return;
  const row=t?.pages?.[i];if(!row)continue;
  if(s.query.phraseRx.some(rx=>!rx.test(row[2])))continue;     // all the words are there, but not as the phrase
  batch.push({n,i,ref:row[0],label:row[1],text:row[2],date:t.date});
 }
 for(const hit of batch)$('results').append(card(hit,s.query));
 s.shown+=batch.length;
 const left=s.next<s.keys.length,phr=s.query.phrases.length;
 $('resultCount').textContent=!s.shown?'NO MATCHES':phr?`${s.shown}${left?'+':''} ${s.shown===1&&!left?'PAGE':'PAGES'} WITH THAT PHRASE`:`${s.keys.length.toLocaleString()} ${s.keys.length===1?'PAGE':'PAGES'}`;
 if(!s.shown&&!left)note('Nothing found. Try fewer words, or end a word with * to match its start (“harryhaus*”).');
 $('more').hidden=!left;
}
function note(t){const n=$('searchNote');n.textContent=t;n.hidden=false}
function card(hit,query){
 const li=document.createElement('li');li.className='hit';
 const a=document.createElement('a');a.href=`issues/${hit.n}/index.html#page=${encodeURIComponent(hit.ref)}`;
 const im=document.createElement('img');im.alt='';im.loading='lazy';im.decoding='async';const cover=catalog[hit.n]?.cover||meta[hit.n]?.[1];if(cover)CinefexSources.image(im,cover);
 const body=document.createElement('span');
 const m=document.createElement('span');m.className='hit-meta';m.textContent=`CINEFEX ${hit.n}, ${hit.date.toUpperCase()}, PAGE ${hit.ref}`;
 const title=document.createElement('span');title.className='hit-title';title.textContent=hit.label;
 const snip=document.createElement('span');snip.className='hit-snippet';snip.append(...snippet(hit.text,query.mark));
 body.append(m,title,snip);a.append(im,body);li.append(a);return li;
}
function snippet(text,rx){
 if(!text)return['(no text on this page)'];
 let at=0;if(rx){rx.lastIndex=0;const m=rx.exec(text);if(m)at=m.index}
 const start=Math.max(0,text.lastIndexOf(' ',Math.max(0,at-110))),end=Math.min(text.length,text.indexOf(' ',at+190)>0?text.indexOf(' ',at+190):text.length);
 const piece=(start>0?'…':'')+text.slice(start,end).trim()+(end<text.length?'…':'');
 if(!rx)return[piece];
 const out=[];let last=0;rx.lastIndex=0;
 for(const m of piece.matchAll(rx)){out.push(piece.slice(last,m.index));const mk=document.createElement('mark');mk.textContent=m[0];out.push(mk);last=m.index+m[0].length}
 out.push(piece.slice(last));return out;
}

for(const y of [...new Set((window.CATALOG||[]).map(x=>(x.date.match(/\d{4}/)||[''])[0]))].filter(Boolean).sort().reverse()){const o=document.createElement('option');o.value=o.textContent=y;$('year').append(o)}
const initial=new URLSearchParams(location.search);
$('q').value=initial.get('q')||'';for(const k of ['kind','year','order'])if(initial.get(k)&&[...$(k).options].some(o=>o.value===initial.get(k)))$(k).value=initial.get(k);
let timer;$('q').addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>search(),300)});
for(const id of ['kind','year','order'])$(id).addEventListener('change',()=>search());
$('searchForm').addEventListener('submit',e=>{e.preventDefault();clearTimeout(timer);search()});
$('more').addEventListener('click',()=>more());
if($('q').value)search(false);else $('q').focus();
