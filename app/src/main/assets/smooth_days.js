(() => {
'use strict';

const STYLE_ID = 'schedule-smooth-days-style';

if (!document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .schedule-list.cf-day {
      animation: scheduleDaySmooth 380ms cubic-bezier(.22,.75,.2,1) both !important;
      will-change: opacity, transform;
    }
    @keyframes scheduleDaySmooth {
      from { opacity:.45; transform:translate3d(0,7px,0) scale(.995); }
      55% { opacity:.92; transform:translate3d(0,1px,0) scale(.999); }
      to { opacity:1; transform:none; }
    }
    html[data-uianim=off] .schedule-list.cf-day,
    html[data-uianim=off] .schedule-list.cf-day * {
      animation:none !important;
    }
  `;
  document.head.appendChild(style);
}
})();
