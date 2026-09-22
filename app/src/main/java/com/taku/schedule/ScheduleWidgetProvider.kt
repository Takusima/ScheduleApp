package com.taku.schedule

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.widget.RemoteViews
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import kotlin.math.roundToInt

class ScheduleWidgetProvider : AppWidgetProvider() {

    companion object {
        private const val PREFS = "schedule_widget"
        private const val KEY_JSON = "json"
        private const val KEY_ACCENT = "accent"
        private const val ACTION_TICK = "com.taku.schedule.WIDGET_TICK"
        private const val REQUEST_TICK = 702

        fun refresh(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val component = ComponentName(context, ScheduleWidgetProvider::class.java)
            val ids = manager.getAppWidgetIds(component)
            if (ids.isNotEmpty()) {
                ScheduleWidgetProvider().updateAll(context, manager, ids)
                scheduleTick(context)
            } else {
                cancelTick(context)
            }
        }

        fun saveAndRefresh(context: Context, json: String, accent: String?) {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY_JSON, json)
                .apply {
                    if (!accent.isNullOrBlank()) putString(KEY_ACCENT, accent)
                }
                .apply()
            refresh(context)
        }

        private fun tickIntent(context: Context): PendingIntent {
            val intent = Intent(context, ScheduleWidgetProvider::class.java).apply {
                action = ACTION_TICK
            }
            return PendingIntent.getBroadcast(
                context,
                REQUEST_TICK,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or immutableFlag()
            )
        }

        private fun scheduleTick(context: Context) {
            val alarm = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val pending = tickIntent(context)
            val trigger = System.currentTimeMillis() + 60_000L
            alarm.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pending)
        }

        private fun cancelTick(context: Context) {
            val alarm = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            alarm.cancel(tickIntent(context))
        }

        private fun immutableFlag(): Int =
            if (android.os.Build.VERSION.SDK_INT >= 23) PendingIntent.FLAG_IMMUTABLE else 0

        private fun parseColor(text: String?, fallback: Int): Int = try {
            Color.parseColor(text ?: "#A66CFF")
        } catch (_: Exception) {
            fallback
        }
    }

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        updateAll(context, appWidgetManager, appWidgetIds)
        scheduleTick(context)
    }

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        val manager = AppWidgetManager.getInstance(context)
        val ids = manager.getAppWidgetIds(ComponentName(context, ScheduleWidgetProvider::class.java))
        updateAll(context, manager, ids)
        scheduleTick(context)
    }

    override fun onDisabled(context: Context) {
        cancelTick(context)
        super.onDisabled(context)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (
            intent.action == ACTION_TICK ||
            intent.action == Intent.ACTION_TIME_CHANGED ||
            intent.action == Intent.ACTION_TIMEZONE_CHANGED ||
            intent.action == Intent.ACTION_DATE_CHANGED
        ) {
            refresh(context)
        }
    }

    private fun updateAll(context: Context, manager: AppWidgetManager, ids: IntArray) {
        ids.forEach { id ->
            manager.updateAppWidget(id, buildViews(context))
        }
    }

    private fun buildViews(context: Context): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_schedule)
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val accent = Companion.parseColor(
            prefs.getString(KEY_ACCENT, "#A66CFF"),
            Color.rgb(166, 108, 255)
        )
        val json = prefs.getString(KEY_JSON, "[]") ?: "[]"
        val data = WidgetDataParser.parse(json)

        views.setTextColor(R.id.widget_group, accent)
        views.setTextColor(R.id.widget_title, Color.WHITE)
        views.setTextColor(R.id.widget_meta, Color.rgb(170, 163, 176))
        views.setTextColor(R.id.widget_progress_text, accent)
        views.setTextColor(R.id.widget_next, Color.rgb(205, 198, 209))
        views.setTextViewText(R.id.widget_group, data.groupLabel)
        views.setTextViewText(R.id.widget_title, data.title)
        views.setTextViewText(R.id.widget_meta, data.meta)
        views.setTextViewText(R.id.widget_progress_text, data.progressText)
        views.setTextViewText(R.id.widget_next, data.nextText)
        views.setProgressBar(R.id.widget_progress, 100, data.progress, false)

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pending = PendingIntent.getActivity(
            context,
            701,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or immutableFlag()
        )
        views.setOnClickPendingIntent(R.id.widget_root, pending)
        return views
    }
}

private data class WidgetLesson(
    val date: String,
    val time: String,
    val lesson: String,
    val room: String,
    val group: String
)

private data class WidgetState(
    val groupLabel: String,
    val title: String,
    val meta: String,
    val progressText: String,
    val progress: Int,
    val nextText: String
)

private object WidgetDataParser {
    fun parse(json: String): WidgetState {
        val lessons = try {
            val array = org.json.JSONArray(json)
            buildList {
                for (i in 0 until array.length()) {
                    val item = array.optJSONObject(i) ?: continue
                    add(
                        WidgetLesson(
                            item.optString("date"),
                            item.optString("time"),
                            item.optString("lesson"),
                            item.optString("room"),
                            item.optString("group")
                        )
                    )
                }
            }
        } catch (_: Exception) {
            emptyList()
        }

        val group = lessons.firstOrNull { it.group.isNotBlank() }?.group ?: "10 м/с"
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Calendar.getInstance().time)
        val todayLessons = lessons
            .filter { it.date == today }
            .sortedBy { toMinutes(it.time) }

        if (todayLessons.isEmpty()) {
            return WidgetState(
                "КМК • $group",
                "Сегодня пар нет",
                "Расписание свободно",
                "—",
                0,
                "Открой приложение для календаря"
            )
        }

        val nowMinutes = Calendar.getInstance().let {
            it.get(Calendar.HOUR_OF_DAY) * 60 + it.get(Calendar.MINUTE)
        }
        val slots = BellSchedule.forDate(
            Calendar.getInstance().get(Calendar.YEAR),
            Calendar.getInstance().get(Calendar.MONTH) + 1,
            Calendar.getInstance().get(Calendar.DAY_OF_MONTH)
        )
        val next = todayLessons.firstOrNull { toMinutes(it.time) > nowMinutes }

        for (index in todayLessons.indices) {
            val lesson = todayLessons[index]
            val start = toMinutes(lesson.time)
            if (start == 9999) continue
            val slot = slots.firstOrNull { it.startMinutes == start } ?: slots.getOrNull(index)
            val end = slot?.endMinutes ?: (start + 45)

            if (nowMinutes in start until end) {
                val duration = (end - start).coerceAtLeast(1)
                val elapsed = (nowMinutes - start).coerceAtLeast(0)
                val progress = (elapsed.toFloat() / duration * 100f).roundToInt().coerceIn(0, 100)
                return WidgetState(
                    "КМК • ${lesson.group.ifBlank { group }}",
                    lesson.lesson,
                    buildMeta(lesson, slot),
                    "Идёт • $progress%",
                    progress,
                    if (next != null) "Следующая ${next.time} • ${next.lesson}" else "Следующей пары сегодня нет"
                )
            }

            val nextLesson = todayLessons.getOrNull(index + 1)
            if (nextLesson != null && nowMinutes >= end) {
                val nextStart = toMinutes(nextLesson.time)
                if (nowMinutes < nextStart) {
                    val totalBreak = (nextStart - end).coerceAtLeast(1)
                    val elapsedBreak = (nowMinutes - end).coerceAtLeast(0)
                    val progress = (elapsedBreak.toFloat() / totalBreak * 100f).roundToInt().coerceIn(0, 100)
                    return WidgetState(
                        "КМК • ${lesson.group.ifBlank { group }}",
                        "Перемена",
                        "Следующая • ${nextLesson.time} • ${nextLesson.lesson}",
                        "Перемена • $elapsedBreak из $totalBreak мин",
                        progress,
                        "До следующей • ${formatCountdown(nowMinutes, nextStart)}"
                    )
                }
            }
        }

        return if (next != null) {
            val nextSlot = slots.firstOrNull { it.startMinutes == toMinutes(next.time) }
            WidgetState(
                "КМК • ${next.group.ifBlank { group }}",
                "Следующая пара",
                buildMeta(next, nextSlot),
                "До начала • ${formatCountdown(nowMinutes, toMinutes(next.time))}",
                0,
                buildMeta(next, nextSlot)
            )
        } else {
            WidgetState(
                "КМК • $group",
                "На сегодня всё 🎉",
                "Все пары закончились",
                "100%",
                100,
                "Открой приложение для завтра"
            )
        }
    }

    fun nextRefreshDelayMillis(json: String): Long {
        val lessons = parseLessons(json)
        val now = Calendar.getInstance()
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(now.time)
        val todayLessons = lessons.filter { it.date == today }.sortedBy { toMinutes(it.time) }
        val nowMinutes = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE)
        val slots = BellSchedule.forDate(
            now.get(Calendar.YEAR),
            now.get(Calendar.MONTH) + 1,
            now.get(Calendar.DAY_OF_MONTH)
        )

        todayLessons.forEachIndexed { index, lesson ->
            val start = toMinutes(lesson.time)
            if (start == 9999) return@forEachIndexed
            val slot = slots.firstOrNull { it.startMinutes == start } ?: slots.getOrNull(index)
            val end = slot?.endMinutes ?: (start + 45)
            if (nowMinutes in start until end) return alignedMinuteDelayMillis()

            val nextStart = todayLessons.getOrNull(index + 1)?.let { toMinutes(it.time) }
            if (nextStart != null && nowMinutes >= end && nowMinutes < nextStart) {
                return alignedMinuteDelayMillis()
            }
        }

        val nextStart = todayLessons.map { toMinutes(it.time) }
            .firstOrNull { it > nowMinutes }
        if (nextStart != null) {
            val delay = millisUntilMinute(now, nextStart)
            return delay.coerceAtLeast(15_000L)
        }

        return 30L * 60L * 1000L
    }

    private fun parseLessons(json: String): List<WidgetLesson> = try {
        val array = org.json.JSONArray(json)
        buildList {
            for (i in 0 until array.length()) {
                val item = array.optJSONObject(i) ?: continue
                val lesson = item.optString("lesson")
                val time = item.optString("time")
                val date = item.optString("date")
                if (lesson.isBlank() || time.isBlank() || date.isBlank()) continue
                add(
                    WidgetLesson(
                        date,
                        time,
                        lesson,
                        item.optString("room"),
                        item.optString("group")
                    )
                )
            }
        }
    } catch (_: Exception) {
        emptyList()
    }

    private fun buildMeta(lesson: WidgetLesson, slot: BellSlot?): String =
        buildString {
            append(slot?.rangeText() ?: lesson.time)
            if (lesson.room.isNotBlank()) append(" • каб. ").append(lesson.room)
        }

    private fun toMinutes(value: String): Int {
        val match = Regex("^(\\d{1,2})[:.](\\d{2})").find(value.trim()) ?: return 9999
        return match.groupValues[1].toInt() * 60 + match.groupValues[2].toInt()
    }

    private fun formatCountdown(now: Int, target: Int): String {
        val delta = (target - now).coerceAtLeast(0)
        return if (delta >= 60) {
            String.format(Locale.US, "%d ч %d мин", delta / 60, delta % 60)
        } else {
            String.format(Locale.US, "%d мин", delta)
        }
    }

    private fun millisUntilMinute(now: Calendar, targetMinute: Int): Long {
        val target = (now.clone() as Calendar).apply {
            set(Calendar.HOUR_OF_DAY, targetMinute / 60)
            set(Calendar.MINUTE, targetMinute % 60)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        return target.timeInMillis - now.timeInMillis
    }

    private fun alignedMinuteDelayMillis(): Long {
        val now = System.currentTimeMillis()
        val next = ((now / 60_000L) + 1L) * 60_000L
        return (next - now).coerceAtLeast(15_000L)
    }

}
