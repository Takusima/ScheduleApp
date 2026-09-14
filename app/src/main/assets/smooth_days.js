(() => {
'use strict';

const STYLE_ID = 'schedule-smooth-days-style';
let switchingDay = false;

if (!document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* Плавный переход без snapshot/transform — не создаёт вспышек при прокрутке. */
    .schedule-list.cf-day {
      animation: scheduleDayFade 180ms ease-out !important;
      will-change: opacity !important;
    }

    @keyframes scheduleDayFade {
      from { opacity: 0.18; }
      to   { opacity: 1; }
    }

    .select-box {
      position: relative !important;
    }
    .select-box::after {
      top: 0 !important;
      bottom: 0 !important;
      right: 15px !important;
      height: 48px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      transform: none !important;
      line-height: 1 !important;
      margin: 0 !important;
      pointer-events: none !important;
    }

    #customize .hexrow {
      display: grid !important;
      grid-template-columns: minmax(0, 1fr) 90px !important;
      align-items: stretch !important;
      width: 100% !important;
      gap: 7px !important;
    }
    #customize .hexinput,
    #customize #resetc {
      width: 100% !important;
      min-width: 0 !important;
      height: 38px !important;
      box-sizing: border-box !important;
      margin: 0 !important;
    }

    @media(max-width:380px) {
      #customize .hexrow {
        grid-template-columns: minmax(0, 1fr) 86px !important;
      }
      #customize #resetc {
        padding-left: 6px !important;
        padding-right: 6px !important;
        font-size: 10px !important;
      }
    }
  `;
  document.head.appendChild(style);
}

function getScreen() {
  return document.querySelector('#schedulePage')?.closest('.screen') || document.querySelector('.screen');
}

function isSameDay(button) {
  const active = button.closest('.day-list')?.querySelector('.day-btn.active');
  return !!active && (active === button || active.textContent.trim() === button.textContent.trim());
}

function init() {
  document.addEventListener('pointerdown', event => {
    const button = event.target.closest?.('.day-btn');
    if (!button) return;

    if (isSameDay(button)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    const screen = getScreen();
    if (screen) {
      /* Если пользователь был внизу, новый день всегда начинается сверху,
         прямо с блока «Учебная группа / Дата». */
      screen.scrollTop = 0;
      switchingDay = true;
    }
  }, true);

  window.addEventListener('scheduleapp:data-ready', () => {
    if (!switchingDay) return;
    const screen = getScreen();
    if (screen) screen.scrollTop = 0;
    switchingDay = false;
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
})();
