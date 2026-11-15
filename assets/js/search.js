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
const PAGE=25,ISSUES=12;
let meta=null,wordShards=null,run=0,state=null,retry=null;
async function loadMeta(){if(!meta){const data=await CinefexSearchData.load('meta');meta=data.issues;wordShards=new Set(data.shards)}return meta}
const shard=w=>wordShards.has(w.slice(0,2))?CinefexSearchData.load(`words/${w.slice(0,2)}`):Promise.resolve({});
const issueText=n=>CinefexSearchData.load(`text/${n}`);
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
 const id=++run,q=$('q').value.trim(),kind=$('kind').value,year=$('year').value,order=$('order').value,view=$('searchView').value;
 if(update){const p=new URLSearchParams();if(q)p.set('q',q);if(kind)p.set('kind',kind);if(year)p.set('year',year);if(order!=='oldest')p.set('order',order);p.set('view',view);history.replaceState(null,'',location.pathname+(p.size?'?'+p:''))}
 for(const im of $('results').querySelectorAll('img'))CinefexSources.releaseImage(im);
 $('results').replaceChildren();$('more').hidden=true;$('searchNote').hidden=true;$('retrySearch').hidden=true;retry=null;
 $('more').textContent=view==='issues'?'More issues':'More results';
 if(!q){$('resultCount').textContent='';return}
 const query=parse(q);
 if(!query.terms.length){$('resultCount').textContent='';note('Add a word that is not as common as “the” or “and”.');return}
 $('resultCount').textContent='Searching…';
 let keys;
 try{await loadMeta();if(id!==run)return;keys=intersect(await Promise.all(query.terms.map(pagesFor)))}catch{if(id===run)failed(()=>search(false));return}
 if(id!==run)return;
 keys=keys.filter(k=>{const n=Math.floor(k/1000),i=k%1000,ads=meta[n]?.[2]||[];if(year&&yearOf(n)!==year)return false;if(kind==='ads'&&!ads.includes(i))return false;if(kind==='articles'&&ads.includes(i))return false;return true});
 if(order==='newest')keys.sort((a,b)=>Math.floor(b/1000)-Math.floor(a/1000)||a%1000-b%1000);
 const groups=new Map();for(const k of keys){const n=Math.floor(k/1000);if(!groups.has(n))groups.set(n,{n,keys:[]});groups.get(n).keys.push(k)}
 state={id,query,keys,view,groups:[...groups.values()],groupNext:0,groupsShown:0,next:0,shown:0,countNext:0,countPages:0,countIssues:0,total:query.phrases.length?null:{pages:keys.length,issues:groups.size}};
 await more();
}
async function finishBatch(s){
 if(s.id!==run||s.counting)return;
 if(!s.total){
  s.counting=true;
  $('resultCount').textContent='Counting results…';
  $('retrySearch').hidden=true;$('searchNote').hidden=true;
  try{
   while(s.countNext<s.groups.length){
    const chunk=s.groups.slice(s.countNext,s.countNext+4);
    const hits=await Promise.all(chunk.map(group=>groupHits(group,s.query)));
    if(s.id!==run)return;
    for(const rows of hits){s.countPages+=rows.length;if(rows.length)s.countIssues++}
    s.countNext+=chunk.length;
   }
   s.total={pages:s.countPages,issues:s.countIssues};
  }catch{if(s.id===run)failed(()=>finishBatch(s));return}finally{s.counting=false}
 }
 if(s.id!==run)return;
 const {pages,issues}=s.total;
 $('resultCount').textContent=pages?`${pages.toLocaleString()} ${pages===1?'result':'results'} in ${issues} ${issues===1?'issue':'issues'}`:'No matches';
 if(!pages)note('Nothing found. Try fewer words, or end a word with * to match its start (“harryhaus*”).');
 $('more').hidden=s.view==='issues'?s.groupsShown>=issues:s.shown>=pages;
}
async function more(){
 if(state?.view==='issues')return moreIssues();
 const s=state;if(!s||s.id!==run||s.loading||s.counting)return;s.loading=true;
 $('more').hidden=true;$('retrySearch').hidden=true;$('searchNote').hidden=true;
 if(!s.total)$('resultCount').textContent='Searching…';
 const start=s.next;
 const batch=[];
 try{
 while(batch.length<PAGE&&s.next<s.keys.length){
  const k=s.keys[s.next++],n=Math.floor(k/1000),i=k%1000,t=await issueText(n);
  if(s.id!==run)return;
  const row=t?.pages?.[i];if(!row)continue;
  if(s.query.phraseRx.some(rx=>!rx.test(row[2])))continue;     // all the words are there, but not as the phrase
  batch.push({n,i,ref:row[0],label:row[1],text:row[2],date:t.date});
 }
 for(const hit of batch)$('results').append(card(hit,s.query));
 s.shown+=batch.length;
 }catch{if(s.id===run){s.next=start;failed(()=>more())}return}finally{s.loading=false}
 await finishBatch(s);
}
async function groupHits(group,query){
 if(group.hits)return group.hits;
 const text=await issueText(group.n),hits=[];
 for(const key of group.keys){
  const i=key%1000,row=text.pages[i];
  if(!row)throw Error('Search page is missing');
  if(query.phraseRx.some(rx=>!rx.test(row[2])))continue;
  hits.push({n:group.n,i,ref:row[0],label:row[1],text:row[2],date:text.date});
 }
 group.hits=hits;return hits;
}
async function moreIssues(){
 const s=state;if(!s||s.id!==run||s.loading||s.counting)return;s.loading=true;
 $('more').hidden=true;$('retrySearch').hidden=true;$('searchNote').hidden=true;
 if(!s.total)$('resultCount').textContent='Searching…';
 const start=s.groupNext,batch=[];
 try{
  while(batch.length<ISSUES&&s.groupNext<s.groups.length){
   const chunk=s.groups.slice(s.groupNext,s.groupNext+Math.min(4,ISSUES-batch.length));
   if(s.query.phrases.length)await Promise.all(chunk.map(group=>groupHits(group,s.query)));
   if(s.id!==run)return;
   s.groupNext+=chunk.length;
   for(const group of chunk){group.count=group.hits?group.hits.length:group.keys.length;if(group.count)batch.push(group)}
  }
  for(const group of batch)$('results').append(issueCard(group,s));
  s.groupsShown+=batch.length;
 }catch{if(s.id===run){s.groupNext=start;failed(()=>moreIssues())}return}finally{s.loading=false}
 await finishBatch(s);
}
function issueCard(group,s){
 const li=document.createElement('li');li.className='issue-result';li.dataset.issue=group.n;
 const details=document.createElement('details'),summary=document.createElement('summary');summary.className='issue-summary';
 const im=document.createElement('img');im.alt='';im.loading='lazy';im.decoding='async';const cover=catalog[group.n]?.cover||meta[group.n]?.[1];if(cover)CinefexSources.image(im,cover);
 const label=document.createElement('span'),title=document.createElement('strong'),date=document.createElement('small');title.textContent=`Cinefex ${group.n}`;date.textContent=meta[group.n][0];label.append(title,date);
 const count=document.createElement('span');count.className='issue-match-count';count.textContent=`${group.count} ${group.count===1?'result':'results'}`;
 const arrow=document.createElementNS('http://www.w3.org/2000/svg','svg');arrow.setAttribute('viewBox','0 0 20 20');arrow.setAttribute('aria-hidden','true');arrow.innerHTML='<path d="m7 4 6 6-6 6"/>';
 summary.append(im,label,count,arrow);
 const content=document.createElement('div');content.className='issue-matches';
 const status=document.createElement('p');status.className='group-status';status.setAttribute('role','status');status.hidden=true;
 const list=document.createElement('ol'),button=document.createElement('button');button.type='button';button.className='group-more';button.hidden=true;content.append(status,list,button);details.append(summary,content);li.append(details);
 let rendered=0,busy=false;
 async function showMatches(){
  if(busy||s.id!==run)return;busy=true;button.hidden=true;status.hidden=false;status.textContent='Loading results…';
  try{
   const hits=await groupHits(group,s.query);
   if(s.id!==run||!details.isConnected)return;
   for(const hit of hits.slice(rendered,rendered+PAGE))list.append(card(hit,s.query,true));
   rendered=Math.min(rendered+PAGE,hits.length);status.hidden=true;button.textContent='More results';button.hidden=rendered>=hits.length;
  }catch{if(s.id===run&&details.isConnected){status.textContent='These results could not load.';button.textContent='Retry';button.hidden=false}}finally{busy=false}
 }
 details.addEventListener('toggle',()=>{if(details.open&&!rendered)showMatches()});button.onclick=showMatches;
 return li;
}
function note(t){const n=$('searchNote');n.textContent=t;n.hidden=false}
function failed(action){$('resultCount').textContent='Search could not load';note('Some search files could not load. Try again.');retry=action;$('retrySearch').hidden=false}
function card(hit,query,grouped=false){
 const li=document.createElement('li');li.className='hit';
 const a=document.createElement('a');a.href=`issues/${hit.n}/index.html#page=${encodeURIComponent(hit.ref)}`;
 if(!grouped){const im=document.createElement('img');im.alt='';im.loading='lazy';im.decoding='async';const cover=catalog[hit.n]?.cover||meta[hit.n]?.[1];if(cover)CinefexSources.image(im,cover);a.append(im)}
 const body=document.createElement('span');
 const m=document.createElement('span');m.className='hit-meta';m.textContent=grouped?`Page ${hit.ref}`:`CINEFEX ${hit.n}, ${hit.date.toUpperCase()}, PAGE ${hit.ref}`;
 const title=document.createElement('span');title.className='hit-title';title.textContent=hit.label;
 const snip=document.createElement('span');snip.className='hit-snippet';snip.append(...snippet(hit.text,query.mark));
 body.append(m,title,snip);a.append(body);li.append(a);return li;
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
let view='issues';try{if(localStorage.getItem('cinefex-search-view')==='pages')view='pages'}catch{}
if(['issues','pages'].includes(initial.get('view')))view=initial.get('view');$('searchView').value=view;
$('q').value=initial.get('q')||'';for(const k of ['kind','year','order'])if(initial.get(k)&&[...$(k).options].some(o=>o.value===initial.get(k)))$(k).value=initial.get(k);
let timer;$('q').addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>search(),300)});
for(const id of ['kind','year','order'])$(id).addEventListener('change',()=>{clearTimeout(timer);search()});
$('searchView').addEventListener('change',()=>{clearTimeout(timer);try{localStorage.setItem('cinefex-search-view',$('searchView').value)}catch{}search()});
$('searchForm').addEventListener('submit',e=>{e.preventDefault();clearTimeout(timer);search()});
$('more').addEventListener('click',()=>more());
$('retrySearch').addEventListener('click',()=>retry?.());
if($('q').value)search(false);else $('q').focus();
