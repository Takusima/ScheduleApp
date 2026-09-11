package com.taku.schedule

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import kotlin.concurrent.thread

class WeeklySyncReceiver : BroadcastReceiver() {

    override fun onReceive(
        context: Context,
        intent: Intent?
    ) {

        /*
         * Сразу планируем следующее воскресенье,
         * чтобы обновление повторялось каждую неделю.
         */
        ScheduleSync.scheduleNextSunday(
            context
        )

        val pendingResult =
            goAsync()

        thread {

            try {

                /*
                 * Загружаем новые Excel-файлы.
                 *
                 * ScheduleRepository:
                 * - обращается к Mail Облаку;
                 * - получает Excel;
                 * - проверяет результат;
                 * - только после успешной загрузки
                 *   заменяет старый кэш.
                 *
                 * Если загрузка не удалась,
                 * старый кэш остаётся нетронутым.
                 */
                ScheduleRepository.downloadFromCloud(
                    context.applicationContext
                )

            } catch (_: Exception) {

                /*
                 * При ошибке ничего не удаляем.
                 * При следующем запуске приложения
                 * используется последняя успешная копия.
                 */

            } finally {

                pendingResult.finish()
            }
        }
    }
}
