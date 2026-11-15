'use strict';
const $=id=>document.getElementById(id);
const normalize=s=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase().replace(/[’‘]/g,"'").replace(/[^a-z0-9]+/g,' ').trim();
const sortTitle=title=>normalize(title.replace(/^The\s+/i,'').replace(/(\d),(?=\d)/g,'$1'));
const collator=new Intl.Collator(undefined,{numeric:true,sensitivity:'base'});
const letterOf=title=>{const first=sortTitle(title)[0]||'';return /^[a-z]$/.test(first)?first.toUpperCase():'#'};
const jumpTargets=new Map(),jumpBar=$('letterJumps');
for(const letter of ['#',...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']){
 const button=document.createElement('button');button.type='button';button.textContent=letter;button.dataset.letter=letter;
 button.setAttribute('aria-label',letter==='#'?'Jump to numbers and symbols':`Jump to ${letter}`);
 button.onclick=()=>{const card=jumpTargets.get(letter);if(card){card.scrollIntoView({block:'start'});card.focus({preventScroll:true})}};
 jumpBar.append(button);
}
function measureJumps(){$('titleGrid').style.setProperty('--jump-offset',jumpBar.offsetHeight+12+'px')}
new ResizeObserver(measureJumps).observe(jumpBar);
const yearOf=x=>(x.date.match(/\d{4}/)||[''])[0];
// Extra indexing (index-extra.js, optional): title corrections, related-title franchises, advertisers and companies.
const extra=window.CINEFEX_INDEX||{};
const unpack=(set,kind)=>(set?.rows||[]).map(([issue,page,n,image,note],i)=>({id:`${kind==='ads'?'ad':'co'}:${issue}:${page}:${i}`,kind,title:set.names[n][0],headline:set.names[n][1],issue,page,date:extra.dates?.[issue]||'',href:`issues/${issue}/index.html#page=${encodeURIComponent(page)}`,image:image?extra.ia+image:'',note}));
const entries=(window.TITLES||[]).map(x=>{const fix=extra.byId?.[x.id]||{},title=fix.title||extra.rename?.[x.title]||x.title;return{...x,...fix,title}}).concat(unpack(extra.ads,'ads'),unpack(extra.companies,'companies'));
const franchisesOf=new Map();for(const [name,ids] of Object.entries(extra.franchises||{}))for(const id of ids){if(!franchisesOf.has(id))franchisesOf.set(id,[]);franchisesOf.get(id).push(name)}
const filterWords=new Map(entries.map(x=>[x,CinefexFilter.words([x.title,x.headline,x.issue,x.date,...((x.kind==='companies'||x.kind==='ads')?extra.aliases?.[x.title]||[]:[])].join(' '))]));
const KINDS={films:'Films',tv:'TV',features:'Features',ads:'Ads',companies:'Companies'};
const present=new Set(entries.map(x=>x.kind));for(const tab of document.querySelectorAll('[data-kind]'))tab.hidden=!present.has(tab.dataset.kind);
const grouped=k=>k==='ads'||k==='companies';

for(const year of [...new Set(entries.map(yearOf))].filter(Boolean).sort().reverse()){const option=document.createElement('option');option.value=option.textContent=year;$('year').append(option)}
const initial=new URLSearchParams(location.search);let kind=Object.keys(KINDS).includes(initial.get('type'))&&present.has(initial.get('type'))?initial.get('type'):'films';let franchise=extra.franchises?.[initial.get('franchise')]?initial.get('franchise'):'';
$('filter').value=initial.get('filter')??initial.get('q')??'';if([...$('year').options].some(o=>o.value===initial.get('year')))$('year').value=initial.get('year');if(['az','newest','oldest','count'].includes(initial.get('sort')))$('order').value=initial.get('sort');
function fillCategories(){const wrap=$('categoryWrap');if(!wrap)return;wrap.hidden=!grouped(kind)||!!franchise;const select=$('category'),keep=select.value||initial.get('category')||'';select.length=1;for(const c of [...new Set(entries.filter(x=>x.kind===kind).map(x=>x.headline).filter(Boolean))].sort()){const o=document.createElement('option');o.value=o.textContent=c;select.append(o)}select.value=[...select.options].some(o=>o.value===keep)?keep:''}
function render(update=false){
 const raw=$('filter').value.trim(),query=CinefexFilter.words(raw),year=$('year').value,sort=$('order').value,category=$('category')?.value||'';
 const ids=franchise?new Set(extra.franchises[franchise]):null;
 document.querySelectorAll('[data-kind]').forEach(a=>{if(!franchise&&a.dataset.kind===kind)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
 $('indexTitle').textContent=franchise||KINDS[kind];$('filterLabel').textContent=franchise?'Filter titles':({films:'Filter films',tv:'Filter TV',features:'Filter features',companies:'Filter companies',ads:'Filter advertisers'})[kind];$('filter').placeholder=grouped(kind)&&!franchise?'Name or issue':'Title or issue';renderBanner();
 const rows=entries.filter(x=>(ids?ids.has(x.id):x.kind===kind)&&(!year||yearOf(x)===year)&&(!category||ids||x.headline===category)&&(!query.length||(/^\d{1,3}$/.test(raw)?x.issue===Number(raw):CinefexFilter.matches(filterWords.get(x),query))));
 const groups=new Map();for(const row of rows){const key=normalize(row.title);if(!groups.has(key))groups.set(key,{title:row.title,rows:[]});groups.get(key).rows.push(row)}
 const first=g=>Math.min(...g.rows.map(x=>x.issue)),last=g=>Math.max(...g.rows.map(x=>x.issue));
 const titles=[...groups.values()].sort((a,b)=>sort==='az'?collator.compare(sortTitle(a.title),sortTitle(b.title)):sort==='newest'?last(b)-last(a):sort==='count'?b.rows.length-a.rows.length||collator.compare(sortTitle(a.title),sortTitle(b.title)):first(a)-first(b));
 const noun=grouped(kind)&&!franchise?(kind==='ads'?['advertiser','advertisers','ad','ads']:['company','companies','article','articles']):['title','titles','feature','features'];
 $('resultCount').textContent=`${titles.length} ${titles.length===1?noun[0]:noun[1]}, ${rows.length} ${rows.length===1?noun[2]:noun[3]}`;$('empty').hidden=rows.length>0;CinefexBrowse.clear();jumpTargets.clear();
 for(const group of titles){
  group.rows.sort((a,b)=>b.issue-a.issue||String(a.page).localeCompare(String(b.page),undefined,{numeric:true}));
  const primary=group.rows.find(x=>x.image)||group.rows[0],multiple=group.rows.length>1,isAd=primary.kind==='ads';
  const card=document.createElement('article');card.className='title-card'+(isAd?' ad-card':'');card.tabIndex=-1;
  const letter=letterOf(group.title);if(!jumpTargets.has(letter))jumpTargets.set(letter,card);
  const heading=document.createElement('h2'),name=document.createElement(multiple?'button':'a');name.className='title-name';name.textContent=group.title;
  if(multiple){name.type='button';name.setAttribute('aria-haspopup','dialog');name.onclick=()=>choose(group)}else name.href=primary.href;
  heading.append(name);card.append(heading);
  const art=document.createElement(multiple?'button':'a');art.className='card-art';
  if(multiple){art.type='button';art.setAttribute('aria-haspopup','dialog');art.onclick=()=>choose(group)}else art.href=primary.href;
  art.setAttribute('aria-label',multiple?`Choose from ${group.rows.length} ${isAd?'ads':'articles'} for ${group.title}`:`Read ${group.title}, Cinefex ${primary.issue}`);
  if(primary.image){const im=document.createElement('img');CinefexBrowse.image(im,primary.image);im.alt='';im.className='feature-image';art.append(im)}else{art.classList.add('text-art');art.textContent=isAd?'See the ad':'Read article'}card.append(art);
  const meta=document.createElement('div');meta.className='card-meta';
  const label=document.createElement(multiple?'button':'a');label.className='article-link';
  const span=first(group)===last(group)?'':`, ${yearOf(group.rows.at(-1))}–${yearOf(group.rows[0])}`;
  if(multiple){label.type='button';label.textContent=`${group.rows.length} ${isAd?'ads':primary.kind==='companies'?'articles':'articles'}${grouped(primary.kind)?span:''}`;label.onclick=()=>choose(group)}else{label.href=primary.href;label.textContent=`Cinefex ${primary.issue}, ${primary.date}`}
  meta.append(label);
  if(grouped(primary.kind)&&primary.headline){const c=document.createElement('span');c.className='card-category';c.textContent=primary.headline;meta.append(c)}
  const related=[...new Set(group.rows.flatMap(r=>franchisesOf.get(r.id)||[]))].filter(f=>f!==franchise);
  if(related.length){const links=document.createElement('div');links.className='franchise-links';links.append('Related: ');related.forEach((f,i)=>{const a=document.createElement('a');a.href='titles.html?franchise='+encodeURIComponent(f);a.textContent=f;a.onclick=e=>{e.preventDefault();franchise=f;fillCategories();render(true);scrollTo({top:0})};links.append(...(i?[', ',a]:[a]))});meta.append(links)}
  card.append(meta);$('titleGrid').append(card);
 }
 jumpBar.hidden=sort!=='az'||!titles.length;
 for(const button of jumpBar.children)button.disabled=!jumpTargets.has(button.dataset.letter);
 measureJumps();
 if(update){const params=new URLSearchParams();if(franchise)params.set('franchise',franchise);else params.set('type',kind);if($('filter').value)params.set('filter',$('filter').value);if(year)params.set('year',year);if(category&&!franchise)params.set('category',category);if(sort!=='az')params.set('sort',sort);history.replaceState(null,'',location.pathname+(params.size?'?'+params:''))}
}
function renderBanner(){let b=$('franchiseBanner');if(!franchise){b?.remove();return}if(!b){b=document.createElement('p');b.id='franchiseBanner';$('titleGrid').before(b)}b.replaceChildren();const n=extra.franchises[franchise].length;b.append(`Everything related to ${franchise}, ${n} ${n===1?'entry':'entries'} `);const clear=document.createElement('button');clear.type='button';clear.textContent='Show all titles';clear.onclick=()=>{franchise='';fillCategories();render(true)};b.append(clear)}
const chooser=document.createElement('dialog');chooser.id='articleChooser';chooser.setAttribute('aria-labelledby','chooserTitle');
const chooserHead=document.createElement('div');chooserHead.className='chooser-head';const chooserTitle=document.createElement('h2');chooserTitle.id='chooserTitle';const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','Close article list');close.onclick=()=>chooser.close();chooserHead.append(chooserTitle,close);const choices=document.createElement('ul');chooser.append(chooserHead,choices);document.body.append(chooser);
chooser.addEventListener('click',e=>{if(e.target===chooser){const r=chooser.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)chooser.close()}});
function choose(group){chooserTitle.textContent=group.title;choices.replaceChildren();for(const row of group.rows){const li=document.createElement('li'),a=document.createElement('a'),issue=document.createElement('span'),detail=document.createElement('span');a.href=row.href;issue.className='feature-issue';issue.textContent=`Cinefex ${row.issue}, ${row.date}`;detail.className='feature-detail';detail.textContent=(row.kind==='ads'?(row.note||'Advertisement'):row.kind==='companies'?(row.note||'Article'):(row.headline||'Article'))+`, Page ${row.page}`;a.append(issue,detail);li.append(a);choices.append(li)}chooser.showModal()}
for(const tab of document.querySelectorAll('[data-kind]'))tab.addEventListener('click',e=>{e.preventDefault();kind=tab.dataset.kind;franchise='';fillCategories();render(true)});
for(const id of ['filter','year','order','category'])$(id)?.addEventListener(id==='filter'?'input':'change',()=>render(true));fillCategories();render();
