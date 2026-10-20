# ScheduleApp — Release Notes / История версий

## Unreleased — KMP student dashboard prototype

### RU
- Добавлен начальный Compose Multiplatform интерфейс с разделами расписания, оценок, календаря и настроек.
- Добавлены ручной ввод предметов и оценок, расчёт среднего балла, список задолженностей и изменение статусов работ.
- Добавлено переключение светлой и тёмной темы.
- Прототип ещё не подключён к постоянному хранилищу и существующему расписанию; он не является готовым релизом.
- Стабильная Android-версия 0.2 и её WebView-функциональность сохранены.

## 0.2 — Current stable release

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

## 0.1 — Original stable release

Base: commit #171, SHA `b3c3d7687cac80e7081b78667a6a80d83fdee605`.

## Release policy

Do not publish the KMP prototype as a stable APK until storage, schedule integration, Android/iOS builds, and update-signing compatibility have been verified.
