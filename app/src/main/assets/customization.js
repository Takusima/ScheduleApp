(()=>{
'use strict';

const KEY='scheduleapp.theme.v2';
const DEFAULTS={
  theme:'dark',
  accent:'#a66cff',
  density:'normal',
  font:'normal',
  radius:'round',
  bg:'gradient',
  uiAnim:'soft',
  effect:'none'
};

let state={...DEFAULTS};
try{state={...DEFAULTS,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch(e){}

const clamp=n=>Math.max(0,Math.min(255,Number(n)||0));
const hexToRgb=h=>{
  h=String(h||'').replace('#','');
  if(h.length===3)h=h.split('').map(x=>x+x).join('');
  return [parseInt(h.slice(0,2),16)||0,parseInt(h.slice(2,4),16)||0,parseInt(h.slice(4,6),16)||0];
};
const rgbToHex=(r,g,b)=>'#'+[r,g,b].map(x=>clamp(x).toString(16).padStart(2,'0')).join('').toUpperCase();
const rgba=(h,a)=>{const [r,g,b]=hexToRgb(h);return `rgba(${r},${g},${b},${a})`};
const shade=(h,n)=>{const [r,g,b]=hexToRgb(h);return `rgb(${clamp(r+n)},${clamp(g+n)},${clamp(b+n)})`};

function save(){
  localStorage.setItem(KEY,JSON.stringify(state));
  apply();
  draw();
  if(state.effect==='snow')startSnow();else stopSnow();
}

function apply(){
  const root=document.documentElement;
  root.style.setProperty('--accent',state.accent);
  root.style.setProperty('--accent2',shade(state.accent,-45));
  root.style.setProperty('--accentSoft',rgba(state.accent,.16));
  root.style.setProperty('--accentBorder',rgba(state.accent,.48));
  root.dataset.theme=state.theme;
  root.dataset.density=state.density;
  root.dataset.font=state.font;
  root.dataset.radius=state.radius;
  root.dataset.bg=state.bg;
  root.dataset.uianim=state.uiAnim;

  const light=state.theme==='light'||(state.theme==='system'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches);
  document.body.classList.toggle('theme-light',light);
}

const style=document.createElement('style');
style.textContent=`
:root{--accent:#a66cff;--accent2:#7945d6;--accentSoft:rgba(166,108,255,.16);--accentBorder:rgba(166,108,255,.48)}
.primary-btn,.wide-btn,.day-btn.active,.calendar-day.selected{background:linear-gradient(135deg,var(--accent),var(--accent2))!important}
.lesson-time{color:var(--accent)!important}.nav-btn.active{color:var(--accent)!important;background:var(--accentSoft)!important}
.calendar-day.today{border-color:var(--accentBorder)!important}.calendar-day.has-data::after{background:var(--accent)!important}.day-btn.active{border-color:var(--accentBorder)!important}
html[data-density=compact] .lesson{padding:9px 11px!important;margin-bottom:6px!important}html[data-density=compact] .screen{padding-top:16px!important}
html[data-density=spacious] .lesson{padding:17px 15px!important;margin-bottom:12px!important}html[data-density=spacious] .screen{padding-top:28px!important}
html[data-font=small] .lesson-name{font-size:12px!important}html[data-font=small] .top-title h1{font-size:26px!important}
html[data-font=large] .lesson-name{font-size:16px!important}html[data-font=large] .top-title h1{font-size:32px!important}
html[data-radius=square] .main-card,html[data-radius=square] .calendar-card,html[data-radius=square] .settings-card,html[data-radius=square] .lesson,html[data-radius=square] .day-btn,html[data-radius=square] .modal-box,html[data-radius=square] .bottom-nav{border-radius:7px!important}
html[data-radius=soft] .main-card,html[data-radius=soft] .calendar-card,html[data-radius=soft] .settings-card,html[data-radius=soft] .lesson,html[data-radius=soft] .day-btn,html[data-radius=soft] .modal-box,html[data-radius=soft] .bottom-nav{border-radius:15px!important}
html[data-bg=solid] #app,html[data-bg=none] #app{background:#0b0910!important}
html[data-uianim=off] *,html[data-uianim=off] *::before,html[data-uianim=off] *::after{transition:none!important;animation:none!important}
html[data-uianim=soft] .main-card,html[data-uianim=soft] .lesson,html[data-uianim=soft] .settings-card{transition:transform .2s ease,box-shadow .2s ease!important}
html[data-uianim=soft] .main-card:active,html[data-uianim=soft] .lesson:active,html[data-uianim=soft] .settings-card:active{transform:scale(.99)}
html[data-uianim=energetic] .main-card,html[data-uianim=energetic] .lesson,html[data-uianim=energetic] .settings-card{transition:transform .16s ease,box-shadow .16s ease!important}
html[data-uianim=energetic] .main-card:active,html[data-uianim=energetic] .lesson:active,html[data-uianim=energetic] .settings-card:active{transform:scale(.975)}
html[data-theme=light] body,.theme-light{background:#f2f1f5!important;color:#17151b!important}
html[data-theme=light] #app,.theme-light #app{background:#f2f1f5!important}
html[data-theme=light] .main-card,.theme-light .main-card{background:linear-gradient(145deg,#fff,#f1edf7)!important;color:#17151b!important}
html[data-theme=light] .select-box select,.theme-light .select-box select{background:#fff!important;color:#17151b!important}
html[data-theme=light] .lesson,html[data-theme=light] .day-btn,html[data-theme=light] .settings-card,html[data-theme=light] .calendar-card,html[data-theme=light] .empty,html[data-theme=light] .modal-box,.theme-light .lesson,.theme-light .day-btn,.theme-light .settings-card,.theme-light .calendar-card,.theme-light .empty,.theme-light .modal-box{background:#fff!important;color:#201d24!important;border-color:rgba(0,0,0,.08)!important}
html[data-theme=light] .lesson-room,html[data-theme=light] .settings-card p,html[data-theme=light] .info-line span:first-child,.theme-light .lesson-room,.theme-light .settings-card p,.theme-light .info-line span:first-child{color:#77717c!important}
html[data-theme=light] .bottom-nav,.theme-light .bottom-nav{background:rgba(255,255,255,.95)!important;border-color:rgba(0,0,0,.08)!important}

#customize{padding:16px;margin-bottom:11px;border-radius:20px;background:linear-gradient(145deg,#17121c,#120e16);border:1px solid rgba(255,255,255,.07);box-shadow:0 12px 30px rgba(0,0,0,.14)}
#customize h3{margin:0 0 5px;font-size:16px}#customize>p{margin:0 0 14px;color:#817987;font-size:12px;line-height:1.45}
.cgroup{margin-top:14px}.clabel{font-size:12px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between}.clabel b{font-size:11px;color:var(--accent)}
.copts{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.copt{min-height:39px;padding:5px;border-radius:12px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.055);color:inherit;font-size:11px}.copt.on{color:var(--accent);border-color:var(--accentBorder);background:var(--accentSoft);box-shadow:0 0 0 1px rgba(255,255,255,.02) inset}
.copt:active,.preset:active,.rgbbtn:active,.snow-test:active{transform:scale(.97)}
.color-preview{height:55px;border-radius:15px;border:1px solid rgba(255,255,255,.09);background:var(--accent);box-shadow:0 8px 24px var(--accentSoft);margin-bottom:8px;position:relative;overflow:hidden}.color-preview span{position:absolute;left:12px;bottom:9px;font-size:11px;font-weight:700;text-shadow:0 1px 4px rgba(0,0,0,.45)}
.rgbgrid{display:grid;gap:8px}.rgbrow{display:grid;grid-template-columns:28px 1fr 44px;align-items:center;gap:8px;font-size:11px}.rgbdot{width:9px;height:9px;border-radius:50%;margin:auto}.rgbdot.r{background:#ff4f68}.rgbdot.g{background:#50db83}.rgbdot.b{background:#5a8cff}.rgbval{height:30px;border-radius:9px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.055);color:inherit;text-align:center;font-size:11px;width:44px}
.rgbslider{width:100%;accent-color:var(--accent)}
.hexrow{display:grid;grid-template-columns:1fr 90px;gap:7px;margin-top:8px}.hexinput{height:38px;border-radius:11px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.055);color:inherit;padding:0 11px;font-size:12px;text-transform:uppercase;outline:none}.rgbbtn{height:38px;border-radius:11px;border:1px solid var(--accentBorder);background:var(--accentSoft);color:var(--accent);font-size:11px}
.presets{display:grid;grid-template-columns:repeat(6,1fr);gap:7px}.preset{height:34px;border-radius:10px;border:1px solid rgba(255,255,255,.1);padding:0;position:relative;overflow:hidden}.preset span{display:block;width:100%;height:100%}.preset.selected{outline:2px solid var(--accent);outline-offset:1px}
.anim-note{font-size:11px;color:#817987;line-height:1.4;margin-top:7px}.effect-icon{font-size:18px;margin-right:4px}
.snow-test{width:100%;min-height:48px;border-radius:15px;border:1px solid rgba(255,255,255,.1);background:linear-gradient(135deg,rgba(255,255,255,.08),var(--accentSoft));color:inherit;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:9px;box-shadow:0 8px 25px rgba(0,0,0,.12)}
.snow-test .flake{font-size:24px;filter:drop-shadow(0 0 8px rgba(255,255,255,.5))}.snow-test small{display:block;font-size:9px;color:#817987;font-weight:400;margin-top:2px}
#schedule-snow{position:fixed;inset:0;width:100%;height:100%;z-index:1;pointer-events:none;display:none}.snow-on #schedule-snow{display:block}.snow-on #app>*{position:relative;z-index:2}
html[data-theme=light] #customize,.theme-light #customize{background:linear-gradient(145deg,#fff,#f4f1f8);border-color:rgba(0,0,0,.08)}
html[data-theme=light] .copt,html[data-theme=light] .rgbval,html[data-theme=light] .hexinput,.theme-light .copt,.theme-light .rgbval,.theme-light .hexinput{background:#eeeef2;color:#242128;border-color:rgba(0,0,0,.08)}
@media(max-width:360px){.copts{grid-template-columns:repeat(2,1fr)}.presets{grid-template-columns:repeat(4,1fr)}}
`;
document.head.appendChild(style);

function createColorUI(p){
  const [r,g,b]=hexToRgb(state.accent);
  const d=document.createElement('div');d.className='cgroup';
  d.innerHTML=`
    <div class="clabel"><span>Акцентный цвет</span><b id="ca">${state.accent.toUpperCase()}</b></div>
    <div class="color-preview" id="colorPreview"><span id="previewText">Акцент приложения</span></div>
    <div class="rgbgrid">
      <div class="rgbrow"><i class="rgbdot r"></i><input class="rgbslider" id="cr" type="range" min="0" max="255" value="${r}"><input class="rgbval" id="crv" type="number" min="0" max="255" value="${r}"></div>
      <div class="rgbrow"><i class="rgbdot g"></i><input class="rgbslider" id="cg" type="range" min="0" max="255" value="${g}"><input class="rgbval" id="cgv" type="number" min="0" max="255" value="${g}"></div>
      <div class="rgbrow"><i class="rgbdot b"></i><input class="rgbslider" id="cb" type="range" min="0" max="255" value="${b}"><input class="rgbval" id="cbv" type="number" min="0" max="255" value="${b}"></div>
    </div>
    <div class="hexrow"><input class="hexinput" id="hexv" value="${state.accent.toUpperCase()}" maxlength="7" spellcheck="false"><button class="rgbbtn" id="resetc">Сбросить</button></div>
    <div class="clabel" style="margin-top:12px"><span>Пресеты</span><span>тапни на цвет</span></div>
    <div class="presets" id="presets"></div>`;
  p.appendChild(d);

  const presets=['#A66CFF','#7C5CFF','#00C2FF','#00D084','#FFD166','#FF7A59','#FF4F81','#F43F5E','#9B59B6','#8B5CF6','#22C55E','#F8FAFC'];
  const names=['Фиолетовый','Индиго','Неон','Мята','Жёлтый','Оранжевый','Розовый','Красный','Лиловый','Аметист','Зелёный','Белый'];
  const box=d.querySelector('#presets');
  presets.forEach((c,i)=>{const b=document.createElement('button');b.className='preset';b.title=names[i];b.innerHTML=`<span style="background:${c}"></span>`;b.dataset.color=c;box.appendChild(b)});

  const sync=(r,g,b)=>{
    r=clamp(r);g=clamp(g);b=clamp(b);const h=rgbToHex(r,g,b);state.accent=h;
    d.querySelector('#cr').value=r;d.querySelector('#cg').value=g;d.querySelector('#cb').value=b;
    d.querySelector('#crv').value=r;d.querySelector('#cgv').value=g;d.querySelector('#cbv').value=b;
    d.querySelector('#hexv').value=h;d.querySelector('#ca').textContent=h;
    d.querySelector('#colorPreview').style.background=`linear-gradient(135deg,${h},${shade(h,-45)})`;
    d.querySelector('#presets').querySelectorAll('.preset').forEach(x=>x.classList.toggle('selected',x.dataset.color===h));
  };
  const commit=()=>{save()};
  ['r','g','b'].forEach(k=>{
    d.querySelector('#c'+k).oninput=()=>{sync(d.querySelector('#cr').value,d.querySelector('#cg').value,d.querySelector('#cb').value)};
    d.querySelector('#c'+k+'v').oninput=()=>{sync(d.querySelector('#crv').value,d.querySelector('#cgv').value,d.querySelector('#cbv').value)};
    d.querySelector('#c'+k).onchange=commit;d.querySelector('#c'+k+'v').onchange=commit;
  });
  d.querySelector('#hexv').onchange=()=>{let h=d.querySelector('#hexv').value.trim();if(!/^#[0-9a-f]{6}$/i.test(h))h='#A66CFF';sync(...hexToRgb(h));commit()};
  d.querySelector('#resetc').onclick=()=>{sync(...hexToRgb(DEFAULTS.accent));commit()};
  box.querySelectorAll('.preset').forEach(b=>b.onclick=()=>{sync(...hexToRgb(b.dataset.color));commit()});
  sync(r,g,b);
}

function createEffectsUI(p){
  const d=document.createElement('div');d.className='cgroup';
  d.innerHTML=`<div class="clabel"><span>Анимация интерфейса</span></div><div class="copts" id="uiAnim"><button class="copt" data-v="off">Выключено</button><button class="copt" data-v="soft">Мягкая</button><button class="copt" data-v="energetic">Энергичная</button></div><div class="anim-note">Меняет только движение элементов интерфейса — без фоновых эффектов.</div>`;
  p.appendChild(d);
  d.querySelectorAll('.copt').forEach(b=>b.onclick=()=>{state.uiAnim=b.dataset.v;save()});

  const e=document.createElement('div');e.className='cgroup';
  e.innerHTML=`<div class="clabel"><span>Эффект фона</span></div><div class="copts" id="effects"><button class="copt" data-v="none"><span class="effect-icon">○</span>Нет</button><button class="copt" data-v="snow"><span class="effect-icon">❄</span>Снег</button><button class="copt" data-v="stars"><span class="effect-icon">✦</span>Звёзды</button></div><div class="anim-note">Фоновые эффекты работают поверх фона и не мешают нажимать кнопки.</div>`;
  p.appendChild(e);
  e.querySelectorAll('.copt').forEach(b=>b.onclick=()=>{state.effect=b.dataset.v;save()});
}

function draw(){
  const p=document.getElementById('customize');if(!p)return;
  p.querySelectorAll('.copt[data-k]').forEach(b=>b.classList.toggle('on',state[b.dataset.k]===b.dataset.v));
  p.querySelectorAll('#uiAnim .copt').forEach(b=>b.classList.toggle('on',state.uiAnim===b.dataset.v));
  p.querySelectorAll('#effects .copt').forEach(b=>b.classList.toggle('on',state.effect===b.dataset.v));
  const h=state.accent.toUpperCase();const [r,g,b]=hexToRgb(h);
  const set=(id,v)=>{const x=p.querySelector(id);if(x)x.value=v};
  set('#cr',r);set('#cg',g);set('#cb',b);set('#crv',r);set('#cgv',g);set('#cbv',b);set('#hexv',h);set('#ca',h);
  const prev=p.querySelector('#colorPreview');if(prev)prev.style.background=`linear-gradient(135deg,${h},${shade(h,-45)})`;
  p.querySelectorAll('.preset').forEach(x=>x.classList.toggle('selected',x.dataset.color===h));
}

function add(){
  const pg=document.getElementById('settingsPage');
  if(!pg||document.getElementById('customize'))return;
  const p=document.createElement('div');p.id='customize';
  p.innerHTML='<h3>🎨 Персонализация</h3><p>Настрой приложение под себя. Всё сохраняется автоматически.</p>';

  const sets={
    theme:[['dark','Тёмная'],['light','Светлая'],['system','Системная']],
    density:[['compact','Компактно'],['normal','Обычно'],['spacious','Просторно']],
    font:[['small','Мелкий'],['normal','Обычный'],['large','Крупный']],
    radius:[['square','Квадрат'],['soft','Мягкий'],['round','Круглый']],
    bg:[['gradient','Градиент'],['solid','Однотонный'],['none','Без свечения']]
  };
  const labels={theme:'Тема',density:'Размер интерфейса',font:'Размер текста',radius:'Скругление',bg:'Стиль фона'};
  Object.entries(sets).forEach(([k,a])=>{
    const d=document.createElement('div');d.className='cgroup';
    d.innerHTML=`<div class="clabel">${labels[k]}</div><div class="copts">${a.map(([v,t])=>`<button class="copt" data-k="${k}" data-v="${v}">${t}</button>`).join('')}</div>`;
    p.appendChild(d);
  });

  createColorUI(p);
  createEffectsUI(p);

  const snow=document.createElement('div');snow.className='cgroup';
  snow.innerHTML='<div class="clabel"><span>Тест</span></div><button class="snow-test" id="snowTest"><span class="flake">❄️</span><span>Тест снегопада<small>включить / выключить снег на фоне</small></span></button>';
  p.appendChild(snow);

  pg.appendChild(p);

  p.querySelectorAll('.copt[data-k]').forEach(b=>b.onclick=()=>{state[b.dataset.k]=b.dataset.v;save()});
  p.querySelector('#snowTest').onclick=()=>{state.effect=state.effect==='snow'?'none':'snow';save()};
  draw();
}

let snowCanvas=null,snowCtx=null,snowflakes=[],snowFrame=0;
function makeSnow(){
  snowCanvas=document.getElementById('schedule-snow');
  if(!snowCanvas){snowCanvas=document.createElement('canvas');snowCanvas.id='schedule-snow';document.body.appendChild(snowCanvas)}
  snowCtx=snowCanvas.getContext('2d');resizeSnow();
  const count=Math.min(65,Math.max(28,Math.round(innerWidth/7)));
  snowflakes=Array.from({length:count},()=>({x:Math.random()*innerWidth,y:Math.random()*innerHeight,r:Math.random()*2.7+.8,v:Math.random()*1.2+.5,w:Math.random()*1.3+.4,a:Math.random()*.55+.25,p:Math.random()*Math.PI*2}));
}
function resizeSnow(){if(!snowCanvas)return;const d=Math.min(window.devicePixelRatio||1,2);snowCanvas.width=innerWidth*d;snowCanvas.height=innerHeight*d;snowCanvas.style.width=innerWidth+'px';snowCanvas.style.height=innerHeight+'px';if(snowCtx)snowCtx.setTransform(d,0,0,d,0,0)}
function snowLoop(t){
  if(state.effect!=='snow'){snowFrame=0;return}
  if(!snowCanvas||!snowCtx)makeSnow();
  snowCtx.clearRect(0,0,innerWidth,innerHeight);
  for(const f of snowflakes){f.y+=f.v;f.p+=.01;f.x+=Math.sin(f.p)*.35;if(f.y>innerHeight+8){f.y=-8;f.x=Math.random()*innerWidth}if(f.x>innerWidth+8)f.x=-8;if(f.x<-8)f.x=innerWidth+8;snowCtx.globalAlpha=f.a;snowCtx.fillStyle='#fff';snowCtx.beginPath();snowCtx.arc(f.x,f.y,f.r,0,Math.PI*2);snowCtx.fill()}
  snowCtx.globalAlpha=1;snowFrame=requestAnimationFrame(snowLoop);
}
function startSnow(){document.body.classList.add('snow-on');makeSnow();if(!snowFrame)snowFrame=requestAnimationFrame(snowLoop)}
function stopSnow(){document.body.classList.remove('snow-on');if(snowFrame)cancelAnimationFrame(snowFrame);snowFrame=0;if(snowCtx&&snowCanvas)snowCtx.clearRect(0,0,innerWidth,innerHeight)}
window.addEventListener('resize',resizeSnow);

apply();
if(window.matchMedia){window.matchMedia('(prefers-color-scheme: light)').addEventListener?.('change',apply)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{add();if(state.effect==='snow')startSnow()});else{add();if(state.effect==='snow')startSnow()}
new MutationObserver(()=>add()).observe(document.documentElement,{childList:true,subtree:true});
})();
