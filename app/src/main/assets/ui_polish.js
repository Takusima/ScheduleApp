(()=>{'use strict';
const K='scheduleapp.liquidGlass.v1';
const get=()=>{try{return JSON.parse(localStorage.getItem(K)||'{}')}catch(_){return{}}};
const style=document.createElement('style');
style.textContent=`
html,body,#app,.screen,#settingsPage{max-width:100%;overflow-x:hidden!important}
body{overscroll-behavior-x:none}
.screen{overscroll-behavior-x:none;scroll-behavior:smooth}
#settingsPage{width:100%;min-width:0}
#cf-bg{z-index:1!important;filter:var(--cf-bg-filter,none);transform:var(--cf-bg-transform,none)}
#app{position:relative!important;z-index:2!important}
#schedule-effects{z-index:997!important}.winter-atmosphere,#winter-atmosphere{z-index:998!important}
html[data-cf-glass=true] .primary-btn,html[data-cf-glass=true] .secondary-btn,html[data-cf-glass=true] .wide-btn,html[data-cf-glass=true] .outline-btn,html[data-cf-glass=true] .day-btn,html[data-cf-glass=true] .nav-btn,html[data-cf-glass=true] .copt,html[data-cf-glass=true] .rem-opt,html[data-cf-glass=true] .sound-opt,html[data-cf-glass=true] .cf-btn{
position:relative;isolation:isolate;overflow:hidden!important;
background:linear-gradient(135deg,rgba(255,255,255,calc(var(--cf-op,.07) + .045)),rgba(255,255,255,var(--cf-op,.07)))!important;
backdrop-filter:blur(var(--cf-blur,20px)) saturate(var(--cf-sat,160%)) contrast(1.04)!important;
-webkit-backdrop-filter:blur(var(--cf-blur,20px)) saturate(var(--cf-sat,160%)) contrast(1.04)!important;
border:1px solid rgba(255,255,255,var(--cf-br,.16))!important;
box-shadow:inset 0 1px 0 rgba(255,255,255,.38),inset 0 -1px 0 rgba(255,255,255,.08),0 9px 24px rgba(0,0,0,.16)!important;
transition:transform var(--cf-gdur,.5s) cubic-bezier(.25,1,.5,1),background var(--cf-gdur,.5s) ease,border-color var(--cf-gdur,.5s) ease,box-shadow var(--cf-gdur,.5s) ease!important
}
html[data-cf-glass=true] .primary-btn::before,html[data-cf-glass=true] .secondary-btn::before,html[data-cf-glass=true] .wide-btn::before,html[data-cf-glass=true] .outline-btn::before,html[data-cf-glass=true] .day-btn::before,html[data-cf-glass=true] .nav-btn::before,html[data-cf-glass=true] .cf-btn::before{content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:linear-gradient(180deg,rgba(255,255,255,.24),transparent 48%);opacity:.65;z-index:-1}
html[data-cf-glass=true] .primary-btn:active,html[data-cf-glass=true] .secondary-btn:active,html[data-cf-glass=true] .wide-btn:active,html[data-cf-glass=true] .outline-btn:active,html[data-cf-glass=true] .day-btn:active,html[data-cf-glass=true] .nav-btn:active,html[data-cf-glass=true] .cf-btn:active{transform:scale(.975)!important}
html[data-cf-glass=true] .primary-btn{background:linear-gradient(135deg,rgba(166,108,255,.45),rgba(121,69,214,.30))!important}
html[data-cf-glass=true] .nav-btn.active{background:linear-gradient(135deg,rgba(166,108,255,.34),rgba(121,69,214,.22))!important}
html[data-cf-glass=true] .copt.on,html[data-cf-glass=true] .cf-btn.on{background:linear-gradient(135deg,rgba(166,108,255,.38),rgba(121,69,214,.24))!important}
html[data-cf-glass=true] .bottom-nav{background:rgba(18,14,24,.48)!important;backdrop-filter:blur(var(--cf-blur,20px)) saturate(var(--cf-sat,160%))!important;-webkit-backdrop-filter:blur(var(--cf-blur,20px)) saturate(var(--cf-sat,160%))!important;border-color:rgba(255,255,255,.12)!important}
html[data-cf-glass=true] .lesson-favorite{backdrop-filter:blur(var(--cf-blur,20px)) saturate(var(--cf-sat,160%))!important;-webkit-backdrop-filter:blur(var(--cf-blur,20px)) saturate(var(--cf-sat,160%))!important}
html[data-uianim=soft] .screen-page,html[data-uianim=energetic] .screen-page{transition:opacity .36s cubic-bezier(.22,.75,.2,1),transform .36s cubic-bezier(.22,.75,.2,1)}
@media(prefers-reduced-motion:reduce){.screen{scroll-behavior:auto}*,*::before,*::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important}}
`;
document.head.appendChild(style);
function apply(){const g=get();const d=document.documentElement;d.dataset.cfGlass=!!g.enabled;d.style.setProperty('--cf-blur',Math.max(0,Math.min(40,+g.blur||20))+'px');d.style.setProperty('--cf-op',Math.max(.01,Math.min(.25,(+g.opacity||8)/100)));d.style.setProperty('--cf-br',Math.max(.01,Math.min(.35,(+g.border||16)/100)));d.style.setProperty('--cf-sat',Math.max(80,Math.min(220,+g.saturate||160))+'%');d.style.setProperty('--cf-gdur',Math.max(.15,Math.min(.9,(+g.duration||50)/100))+'s')}
apply();
let last='';function observe(){const e=document.documentElement;const v=e.dataset.cfGlass||'false';if(v===last)return;last=v;apply()}new MutationObserver(observe).observe(document.documentElement,{attributes:true,attributeFilter:['data-cf-glass']});
})();