(() => {
'use strict';

const STYLE_ID = 'schedule-smooth-days-style';
let restoring = false;
let restoreUntil = 0;
let savedScroll = 0;

if (!document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* Переключение дня не должно перерисовывать весь экран.
       Особенно важно при прокрутке: никакого snapshot и никакого
       fade самого списка, иначе WebView на мгновение показывает верх. */
    .schedule-list.cf-day {
      animation: none !important;
      transform: none !important;
      opacity: 1 !important;
      will-change: auto !important;
    }

    /* Стрелка является частью самого поля и всегда центрируется
       независимо от высоты/шрифта/темы. */
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

    /* Кнопка сброса остаётся ровно в одной строке с HEX-полем. */
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
      #customize .hexrow { grid-template-columns:minmax(0,1fr) 86px !important; }
      #customize #resetc { padding-left:6px !important; padding-right:6px !important; font-size:10px !important; }
    }
  `;
  document.head.appendChild(style);
}

function getScreen() {
  return document.querySelector('#schedulePage')?.closest('.screen') || document.querySelector('.screen');
}

function restore() {
  const screen = getScreen();
  if (!screen) return;
  screen.scrollTop = savedScroll;
}

function protectViewport() {
  const screen = getScreen();
  if (!screen) return;

  savedScroll = screen.scrollTop;
  if (savedScroll <= 0) return;

  restoring = true;
  restoreUntil = performance.now() + 180;
  restore();

  /* MutationObserver выполняется до отрисовки следующего кадра. Поэтому
     если основная логика приложения заменит schedule-list и WebView
     попытается вернуть scrollTop наверх, мы возвращаем исходную позицию
     ещё до того, как пользователь увидит этот кадр. */
  const observer = new MutationObserver(() => {
    if (!restoring) return;
    restore();
  });
  observer.observe(screen, { childList: true, subtree: true });

  requestAnimationFrame(() => {
    restore();
    requestAnimationFrame(() => {
      restore();
      restoring = false;
      observer.disconnect();
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

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
})();
