(()=>{'use strict';const base=new URL('.',document.currentScript.src),shell=new URL('session.html',base);function route(url){const u=new URL(url,location.href);if(u.origin!==base.origin||!u.pathname.startsWith(base.pathname))return null;const p=u.pathname.slice(base.pathname.length);return /^(index\.html|titles\.html|issues\/\d+\/index\.html)$/.test(p)?p+u.search+u.hash:null}
if(parent===window){if(typeof showDirectoryPicker==='function')return;const path=route(location.href);if(path)location.replace(shell.href+'#'+encodeURIComponent(path));return}
if(window.name!=='cinefex-session')return;
document.addEventListener('click',e=>{const a=e.target.closest?.('a[href]');if(!a||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||a.hasAttribute('download')||a.target&&a.target!=='_self')return;const path=route(a.href);if(!path)return;const u=new URL(a.href);if(u.pathname===location.pathname&&u.hash)return;e.preventDefault();parent.postMessage({cinefexNavigate:path},'*')});
for(const method of ['replaceState','pushState']){const original=history[method].bind(history);history[method]=(...args)=>{const result=original(...args);parent.postMessage({cinefexRoute:route(location.href)},'*');return result}}
addEventListener('hashchange',()=>parent.postMessage({cinefexRoute:route(location.href)},'*'));
addEventListener('DOMContentLoaded',()=>parent.postMessage({cinefexTitle:document.title},'*'));
})();
