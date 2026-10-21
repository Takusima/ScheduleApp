/* ScheduleApp UI fixes / motion layer */
(()=>{
'use strict';
const run=()=>{
  const nav=document.querySelector('.bottom-nav');
  if(nav){
    const all=[...nav.querySelectorAll('.nav-btn')];
    const active=all.findIndex(x=>x.classList.contains('active'));
    if(active>=0)nav.style.setProperty('--nav-index',String(active));
    if(!nav.dataset.motionFixed){
      nav.dataset.motionFixed='1';
      const st=document.createElement('style');
      st.textContent=`
      .bottom-nav{position:fixed!important;overflow:hidden!important}
      .bottom-nav::before{content:none!important;display:none!important}
      .nav-btn{position:relative!important;z-index:1!important;background:transparent!important;transition:color .28s ease,background .28s ease,transform .28s cubic-bezier(.22,.75,.2,1)!important}
      .nav-btn.active{background:var(--accentSoft)!important;color:var(--accent)!important;box-shadow:none!important}
      .nav-btn .icon{transition:transform .28s cubic-bezier(.22,.75,.2,1),color .28s ease}.nav-btn.active .icon{transform:translateY(-1px) scale(1.04)}
      .screen-page.active{animation:schedulePageIn .24s ease-out}@keyframes schedulePageIn{from{opacity:.45;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
      .lesson{display:block!important;padding:42px 13px 13px!important}.lesson-time{position:absolute!important;top:12px!important;left:13px!important;right:48px!important;padding:0!important}.lesson>div:nth-child(2){width:100%;min-width:0}.lesson-name{min-width:0;width:100%;display:block;margin:0;padding:0 28px!important;text-align:center!important;overflow-wrap:anywhere;word-break:break-word}.lesson-room{text-align:center!important;padding:0 28px!important}.lesson-favorite{position:absolute!important;top:10px!important;right:10px!important;z-index:5!important;width:28px!important;height:28px!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:0!important;margin:0!important}
      html[data-density=compact] .lesson{padding:42px 13px 9px!important}html[data-density=spacious] .lesson{padding:42px 13px 17px!important}
      `;
      document.head.appendChild(st);
    }
  }
  document.querySelectorAll('#customize button,#customize input').forEach(el=>{if(el.tagName==='BUTTON')el.type='button'});
  document.querySelectorAll('.preset,.rgbbtn,#customize .copt').forEach(el=>{
    if(!el.dataset.fixWrapped){
      el.dataset.fixWrapped='1';
      const handler=el.onclick;
      if(typeof handler==='function')el.onclick=e=>{try{return handler.call(el,e)}catch(err){console.error('Customization button error',err);return false}};
    }
  });
};
const sync=()=>{const nav=document.querySelector('.bottom-nav');if(!nav)return;const all=[...nav.querySelectorAll('.nav-btn')],i=all.findIndex(x=>x.classList.contains('active'));if(i>=0)nav.style.setProperty('--nav-index',String(i));};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{run();sync()});else{run();sync()}
let observerQueued=false;
const scheduleObserver=()=>{
  if(observerQueued)return;
  observerQueued=true;
  requestAnimationFrame(()=>{
    observerQueued=false;
    run();
    sync();
  });
};
new MutationObserver(scheduleObserver).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
})();
