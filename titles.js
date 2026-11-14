'use strict';
const $=id=>document.getElementById(id), entries=window.TITLES;
const normalize=s=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase().replace(/[’‘]/g,"'").replace(/[^a-z0-9]+/g,' ').trim();
const yearOf=x=>(x.date.match(/\d{4}/)||[''])[0];
for(const year of [...new Set(entries.map(yearOf))].filter(Boolean).sort().reverse()){const option=document.createElement('option');option.value=option.textContent=year;$('year').append(option)}
const initial=new URLSearchParams(location.search);let kind=['films','tv','features'].includes(initial.get('type'))?initial.get('type'):'films';$('search').value=initial.get('q')||'';if([...$('year').options].some(o=>o.value===initial.get('year')))$('year').value=initial.get('year');if(['az','newest','oldest'].includes(initial.get('sort')))$('order').value=initial.get('sort');
function render(update=false){
 const query=normalize($('search').value),year=$('year').value,sort=$('order').value;
 document.querySelectorAll('[data-kind]').forEach(a=>{if(a.dataset.kind===kind)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});$('indexTitle').textContent=({films:'Films',tv:'TV',features:'Features'})[kind];
 const rows=entries.filter(x=>x.kind===kind&&(!year||yearOf(x)===year)&&(!query||(/^\d{1,3}$/.test(query)?x.issue===Number(query):query.split(' ').every(word=>normalize([x.title,x.headline,x.issue,x.date].join(' ')).includes(word)))));
 const groups=new Map();for(const row of rows){const key=normalize(row.title);if(!groups.has(key))groups.set(key,{title:row.title,rows:[]});groups.get(key).rows.push(row)}
 const titles=[...groups.values()].sort((a,b)=>sort==='az'?a.title.replace(/^The /i,'').localeCompare(b.title.replace(/^The /i,'')):sort==='newest'?Math.max(...b.rows.map(x=>x.issue))-Math.max(...a.rows.map(x=>x.issue)):Math.min(...a.rows.map(x=>x.issue))-Math.min(...b.rows.map(x=>x.issue)));
 $('resultCount').textContent=`${titles.length} titles, ${rows.length} ${rows.length===1?'feature':'features'}`;$('empty').hidden=rows.length>0;$('titleGrid').replaceChildren();
 for(const group of titles){
  group.rows.sort((a,b)=>b.issue-a.issue||a.page-b.page);
  const primary=group.rows.find(x=>x.image)||group.rows[0],multiple=group.rows.length>1;
  const card=document.createElement('article');card.className='title-card';
  const heading=document.createElement('h2');heading.textContent=group.title;card.append(heading);
  const art=document.createElement(multiple?'button':'a');art.className='card-art';
  if(multiple){art.type='button';art.setAttribute('aria-haspopup','dialog');art.onclick=()=>choose(group)}else art.href=primary.href;
  art.setAttribute('aria-label',multiple?`Choose from ${group.rows.length} articles about ${group.title}`:`Read ${group.title}, Cinefex ${primary.issue}`);
  if(primary.image){const im=document.createElement('img');CinefexSources.image(im,primary.image);im.alt='';im.loading='lazy';im.decoding='async';im.className='feature-image';art.append(im)}else{art.classList.add('text-art');art.textContent='Read article'}card.append(art);
  const meta=document.createElement('div');meta.className='card-meta';
  const label=document.createElement(multiple?'button':'a');label.className='article-link';
  if(multiple){label.type='button';label.textContent=`${group.rows.length} articles`;label.onclick=()=>choose(group)}else{label.href=primary.href;label.textContent=`Cinefex ${primary.issue}, ${primary.date}`}
  meta.append(label);card.append(meta);$('titleGrid').append(card);
 }
 if(update){const params=new URLSearchParams();params.set('type',kind);if($('search').value)params.set('q',$('search').value);if(year)params.set('year',year);if(sort!=='az')params.set('sort',sort);history.replaceState(null,'',location.pathname+(params.size?'?'+params:''))}
}
const chooser=document.createElement('dialog');chooser.id='articleChooser';chooser.setAttribute('aria-labelledby','chooserTitle');
const chooserHead=document.createElement('div');chooserHead.className='chooser-head';const chooserTitle=document.createElement('h2');chooserTitle.id='chooserTitle';const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','Close article list');close.onclick=()=>chooser.close();chooserHead.append(chooserTitle,close);const choices=document.createElement('ul');chooser.append(chooserHead,choices);document.body.append(chooser);
chooser.addEventListener('click',e=>{if(e.target===chooser){const r=chooser.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)chooser.close()}});
function choose(group){chooserTitle.textContent=group.title;choices.replaceChildren();for(const row of group.rows){const li=document.createElement('li'),a=document.createElement('a'),issue=document.createElement('span'),detail=document.createElement('span');a.href=row.href;issue.className='feature-issue';issue.textContent=`Cinefex ${row.issue}, ${row.date}`;detail.className='feature-detail';detail.textContent=(row.headline||'Article')+`, Page ${row.page}`;a.append(issue,detail);li.append(a);choices.append(li)}chooser.showModal()}
for(const tab of document.querySelectorAll('[data-kind]'))tab.addEventListener('click',e=>{e.preventDefault();kind=tab.dataset.kind;render(true)});
for(const id of ['search','year','order'])$(id).addEventListener(id==='search'?'input':'change',()=>render(true));render();
