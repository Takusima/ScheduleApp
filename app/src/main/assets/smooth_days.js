(() => {
'use strict';

const STYLE_ID = 'schedule-smooth-days-style';
let protecting = false;
let savedScroll = 0;

if (!document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* Мягкий переход между днями. Никаких snapshot/transform,
       поэтому при прокрутке верх списка не вспыхивает. */
    .schedule-list.cf-day {
      animation: scheduleDayFade 180ms ease-out !important;
      will-change: opacity !important;
    }

    @keyframes scheduleDayFade {
      from { opacity: 0.18; }
      to   { opacity: 1; }
    }

    /* Стрелка выбора всегда вертикально по центру поля. */
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

    /* HEX и Сброс всегда одинаковой высоты и нормально помещаются. */
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

function restoreScroll(screen) {
  if (!screen) return;
  screen.scrollTop = savedScroll;
}

function protectViewport() {
  const screen = getScreen();
  if (!screen || protecting) return;

  savedScroll = screen.scrollTop;
  if (savedScroll <= 0) return;

  protecting = true;
  restoreScroll(screen);

  /* Сохраняем позицию только на время фактической замены расписания.
     Не используем screenshot/clone: именно они давали вспышку верхней
     части страницы при переключении дня во время прокрутки. */
  const observer = new MutationObserver(() => {
    restoreScroll(screen);
  });
  observer.observe(screen, { childList: true, subtree: true });

  requestAnimationFrame(() => {
    restoreScroll(screen);
    requestAnimationFrame(() => {
      restoreScroll(screen);
      observer.disconnect();
      protecting = false;
    });
  });
}

function init() {
  document.addEventListener('pointerdown', event => {
    const button = event.target.closest?.('.day-btn');
    if (!button) return;

    const active = button.closest('.day-list')?.querySelector('.day-btn.active');
    if (active && (active === button || active.textContent.trim() === button.textContent.trim())) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    protectViewport();
  }, true);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
})();
