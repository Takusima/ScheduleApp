(()=>{'use strict';
const STYLE_ID='schedule-notification-test-style';
function install(){
  if(!document.getElementById(STYLE_ID)){
    const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
      #schedule-notification-test{padding:16px;margin-bottom:11px;border-radius:19px;background:#151119;border:1px solid rgba(255,255,255,.055)}
      #schedule-notification-test h3{margin:0 0 6px;font-size:15px}
      #schedule-notification-test p{margin:0 0 12px;color:#817987;font-size:12px;line-height:1.45}
      #schedule-notification-test .nt-row{display:flex;gap:8px;align-items:center}
      #schedule-notification-test .nt-btn{flex:1;min-height:42px;border-radius:12px;border:1px solid var(--accentBorder);background:var(--accentSoft);color:var(--accent);font:inherit;font-size:12px;font-weight:800}
      #schedule-notification-test .nt-btn:active{transform:scale(.98)}
      #schedule-notification-test .nt-status{margin-top:9px;font-size:10px;color:#817987;line-height:1.35}
    `;document.head.appendChild(s)
  }
}
function show(){
  install();const p=document.getElementById('settingsPage');if(!p||document.getElementById('schedule-notification-test'))return;
  const b=document.createElement('div');b.id='schedule-notification-test';
  b.innerHTML=`<h3>🔔 Проверка уведомлений</h3><p>Нажми кнопку — приложение сразу отправит тестовое уведомление со звуком и вибрацией.</p><div class="nt-row"><button class="nt-btn" id="nt-test" type="button">🔔📳 Проверить звук и вибрацию</button></div><div class="nt-status" id="nt-status">Тест не запускался</div>`;
  p.prepend(b);
  const btn=b.querySelector('#nt-test'),status=b.querySelector('#nt-status');
  btn.onclick=()=>{
    status.textContent='⏳ Отправляем тестовое уведомление…';
    if(window.Android&&typeof Android.testLessonNotification==='function'){
      try{Android.testLessonNotification();status.textContent='✓ Тест отправлен. Если звука/вибрации нет — проверь настройки канала ниже.'}catch(_){status.textContent='Не удалось запустить тест.'}
    }else status.textContent='Android-интерфейс недоступен.';
  };
}
function init(){show();setTimeout(show,500);setTimeout(show,1500)}
window.addEventListener('scheduleapp:data-ready',show);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
