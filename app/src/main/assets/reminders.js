(()=>{
'use strict';
const KEY='scheduleapp.reminders.v1';
const PROFILE='scheduleapp.profile.v1';
const defaults={enabled:false,minutes:10};
let settings={...defaults};
let profile={nickname:'Р',name:'Симаченко Станислав',group:'10'};
try{settings={...defaults,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch(e){}
try{profile={...profile,...JSON.parse(localStorage.getItem(PROFILE)||'{}')}}catch(e){}

const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
const save=()=>localStorage.setItem(KEY,JSON.stringify(settings));
const saveProfile=()=>localStorage.setItem(PROFILE,JSON.stringify(profile));

const style=document.createElement('style');
style.textContent=`
#schedule-reminders,#schedule-profile{padding:16px;margin-bottom:11px;border-radius:19px;background:#151119;border:1px solid rgba(255,255,255,.055)}
#schedule-reminders h3,#schedule-profile h3{margin:0 0 6px;font-size:15px}
#schedule-reminders p,#schedule-profile p{margin:0 0 13px;color:#817987;font-size:12px;line-height:1.45}
.rem-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.rem-title{font-size:13px;font-weight:700}.switch{position:relative;width:52px;height:30px;border-radius:20px;background:#3a3440;border:1px solid rgba(255,255,255,.08);flex:0 0 auto}.switch i{position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:#b9b2bd;transition:.2s}.switch.on{background:var(--accentSoft);border-color:var(--accentBorder)}.switch.on i{left:25px;background:var(--accent)}
.rem-options{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:12px}.rem-opt{height:39px;border-radius:11px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.07);color:inherit;font-size:11px}.rem-opt.on{color:var(--accent);background:var(--accentSoft);border-color:var(--accentBorder)}
.rem-status{margin-top:9px;font-size:11px;color:#817987;line-height:1.4}.profile-grid{display:grid;gap:8px}.profile-input{width:100%;height:42px;border-radius:12px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.05);color:inherit;padding:0 12px;outline:none;font-size:12px}.profile-save{width:100%;height:42px;margin-top:9px;border-radius:12px;background:linear-gradient(135deg,var(--accent),var(--accent2));font-weight:700}.profile-preview{margin-top:10px;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.04);font-size:11px;color:#9b929f;line-height:1.5}
html[data-theme=light] #schedule-reminders,html[data-theme=light] #schedule-profile,.theme-light #schedule-reminders,.theme-light #schedule-profile{background:#fff;border-color:rgba(0,0,0,.08)}html[data-theme=light] .switch,.theme-light .switch{background:#e1dfe5}html[data-theme=light] .profile-input,.theme-light .profile-input{background:#eeeef2;color:#242128;border-color:rgba(0,0,0,.08)}
@media(max-width:360px){.rem-options{grid-template-columns:repeat(2,1fr)}}`;
document.head.appendChild(style);

function payload(){
  if(typeof state==='undefined'||!state.data||!state.selectedGroup)return[];
  const out=[];
  Object.keys(state.data).forEach(date=>{
    const list=state.data[date]&&state.data[date][state.selectedGroup];
    if(!Array.isArray(list))return;
    list.forEach(x=>out.push({date,time:x.time,lesson:x.lesson,room:x.room||'',group:state.selectedGroup}));
  });
  return out;
}
function send(){
  if(!window.Android||typeof Android.setLessonReminders!=='function')return;
  try{Android.setLessonReminders(!!settings.enabled,Number(settings.minutes)||10,profile.group||'',JSON.stringify(payload()))}catch(e){console.error(e)}
}
function renderReminders(){
  const pg=document.getElementById('settingsPage');if(!pg||document.getElementById('schedule-reminders'))return;
  const box=document.createElement('div');box.id='schedule-reminders';
  box.innerHTML=`<h3>⏰ Напоминания о парах</h3><p>Приложение заранее предупредит о следующей паре звуком и уведомлением, даже если оно закрыто.</p><div class="rem-head"><span class="rem-title">Уведомлять о парах</span><button class="switch ${settings.enabled?'on':''}" id="remSwitch" aria-label="Напоминания"><i></i></button></div><div class="rem-options" id="remOptions">${[5,10,15,30].map(v=>`<button class="rem-opt ${settings.minutes===v?'on':''}" data-min="${v}">За ${v} мин.</button>`).join('')}</div><div class="rem-status" id="remStatus">${settings.enabled?'Включено • за '+settings.minutes+' мин.':'Выключено'}</div>`;
  pg.insertBefore(box,pg.firstChild);
  const sw=box.querySelector('#remSwitch');
  sw.onclick=()=>{settings.enabled=!settings.enabled;save();sw.classList.toggle('on',settings.enabled);box.querySelectorAll('.rem-opt').forEach(b=>b.disabled=!settings.enabled);box.querySelector('#remStatus').textContent=settings.enabled?'Включено • за '+settings.minutes+' мин.':'Выключено';send()};
  box.querySelectorAll('.rem-opt').forEach(b=>b.onclick=()=>{settings.minutes=Number(b.dataset.min);save();box.querySelectorAll('.rem-opt').forEach(x=>x.classList.toggle('on',Number(x.dataset.min)===settings.minutes));box.querySelector('#remStatus').textContent=settings.enabled?'Включено • за '+settings.minutes+' мин.':'Выключено';send()});
  box.querySelectorAll('.rem-opt').forEach(b=>b.disabled=!settings.enabled);
}
function renderProfile(){
  const pg=document.getElementById('settingsPage');if(!pg||document.getElementById('schedule-profile'))return;
  const box=document.createElement('div');box.id='schedule-profile';
  box.innerHTML=`<h3>👤 Мой профиль</h3><p>Эти данные сохраняются только на устройстве и используются для персонализации приложения.</p><div class="profile-grid"><input class="profile-input" id="profileNick" placeholder="Ник" value="${esc(profile.nickname)}"><input class="profile-input" id="profileName" placeholder="Имя и фамилия" value="${esc(profile.name)}"><input class="profile-input" id="profileGroup" placeholder="Группа" value="${esc(profile.group)}"></div><button class="profile-save" id="profileSave">Сохранить профиль</button><div class="profile-preview" id="profilePreview"></div>`;
  const appearance=document.getElementById('customize');
  if(appearance&&appearance.parentElement===pg)pg.insertBefore(box,appearance);else pg.insertBefore(box,pg.firstChild);
  const updatePreview=()=>{box.querySelector('#profilePreview').textContent=`${profile.nickname||'Без ника'} • ${profile.name||'Имя не указано'} • группа ${profile.group||'не указана'}`};
  box.querySelector('#profileSave').onclick=()=>{profile.nickname=box.querySelector('#profileNick').value.trim();profile.name=box.querySelector('#profileName').value.trim();profile.group=box.querySelector('#profileGroup').value.trim();saveProfile();updatePreview();send()};
  updatePreview();
}
function boot(){renderReminders();renderProfile();setTimeout(send,700);let lastGroup='';setInterval(()=>{if(typeof state!=='undefined'&&state.selectedGroup!==lastGroup){lastGroup=state.selectedGroup;send()}},1500)}

const oldNative=window.onNativeFiles;
window.onNativeFiles=function(json,status){if(typeof oldNative==='function')oldNative(json,status);setTimeout(send,900)};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,200));else setTimeout(boot,200);
})();
