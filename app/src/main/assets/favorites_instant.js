(()=>{'use strict';
const FK='scheduleapp.favorites.v1';
const read=()=>{try{return JSON.parse(localStorage.getItem(FK)||'[]')}catch(_){return[]}};
function add(c){if(!c||c.querySelector('.lesson-favorite'))return;const name=c.querySelector('.lesson-name')?.textContent?.trim();if(!name)return;const b=document.createElement('button');b.className='lesson-favorite';b.type='button';b.dataset.subject=name;b.textContent=read().includes(name)?'★':'☆';b.classList.toggle('on',read().includes(name));b.setAttribute('aria-pressed',String(read().includes(name)));c.appendChild(b)}
function scan(root=document){root.querySelectorAll?.('.lesson').forEach(add);if(root.matches?.('.lesson'))add(root)}
function start(){scan();const target=document.querySelector('#schedulePage .schedule-list')||document.body;new MutationObserver(m=>{for(const x of m)for(const n of x.addedNodes)if(n.nodeType===1)scan(n)}).observe(target,{childList:true,subtree:true});window.addEventListener('scheduleapp:data-ready',()=>requestAnimationFrame(()=>scan()));}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();