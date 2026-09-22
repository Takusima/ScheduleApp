# ScheduleApp — Release Notes / История версий

## 0.2 — Current release / Текущий релиз

### RU
- Исправлено расписание звонков.
- Будни: 5 пар.
- Суббота: 3 пары.
- Каждая пара состоит из двух занятий по 45 минут.
- Между двумя занятиями внутри пары — ровно 10 минут.
- Времена звонков используются как заданные значения и не вычисляются автоматически.
- Исправлены ошибки, из-за которых структура звонков могла отображаться как отдельные пары или с неверными интервалами.
- Сохранены возможности и оформление стабильной версии 0.1.

### EN
- Fixed the bell schedule.
- Weekdays: 5 pairs.
- Saturday: 3 pairs.
- Each pair consists of two 45-minute lessons.
- There is exactly a 10-minute break between the two lessons inside a pair.
- Bell times are treated as explicit schedule values and are not calculated automatically.
- Fixed issues that could display bell intervals as separate pairs or with incorrect break intervals.
- Preserves the functionality and visual style of stable version 0.1.

## 0.1 — Original stable release / Исходный стабильный релиз

Base: commit #171, SHA `b3c3d7687cac80e7081b78667a6a80d83fdee605`.

### RU — Known issues documented
- В этой версии расписание звонков ещё не соответствовало окончательному расписанию учебного заведения.
- Некоторые последующие экспериментальные версии могли ломать JavaScript в `index.html`, из-за чего переставали работать настройки, расписание и другие функции.
- Были экспериментальные изменения навигации и прокрутки, которые впоследствии были исправлены.
- В отдельных версиях парсер Excel мог неверно определять группы или листы.
- Синхронизация Mail Облака могла не находить Excel-файлы, когда они находились во вложенной папке ZIP-архива.

### EN — Known issues documented
- This version did not yet contain the final bell schedule used by the educational institution.
- Some later experimental versions could break JavaScript in `index.html`, causing settings, schedule loading, and other functions to stop working.
- Experimental navigation and scrolling changes were introduced and later fixed.
- In some versions, the Excel parser could incorrectly detect groups or sheets.
- Mail Cloud synchronization could fail to find Excel files when they were stored inside a nested ZIP folder.

## Release policy / Правило релизов

Only these two release versions are kept:
- `release-0.1` — original stable base from commit #171.
- `release-0.2` — current stable development line.

Other experimental GitHub Releases are removed by the release workflow after the next successful build.
