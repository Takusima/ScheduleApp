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
      .lesson{padding-right:58px!important}.lesson-name{min-width:0;padding-right:4px!important;overflow-wrap:anywhere;word-break:break-word}
      html[data-density=compact] .lesson{padding:9px 58px 9px 11px!important}html[data-density=spacious] .lesson{padding:17px 58px 17px 15px!important}
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
new MutationObserver(()=>{run();sync()}).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
})();
