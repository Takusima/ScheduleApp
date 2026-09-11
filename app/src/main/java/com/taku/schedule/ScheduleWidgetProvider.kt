package com.taku.schedule

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

        fun refresh(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val component = ComponentName(context, ScheduleWidgetProvider::class.java)
            val ids = manager.getAppWidgetIds(component)
            if (ids.isNotEmpty()) updateAll(context, manager, ids)
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

        private fun updateAll(context: Context, manager: AppWidgetManager, ids: IntArray) {
            ids.forEach { id ->
                manager.updateAppWidget(id, buildViews(context))
            }
        }

        private fun buildViews(context: Context): RemoteViews {
            val views = RemoteViews(context.packageName, R.layout.widget_schedule)
            val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val accent = parseColor(prefs.getString(KEY_ACCENT, "#A66CFF"), Color.rgb(166, 108, 255))
            val json = prefs.getString(KEY_JSON, "[]") ?: "[]"
            val data = WidgetDataParser.parse(json)

            views.setTextColor(R.id.widget_group, accent)
            views.setTextColor(R.id.widget_title, Color.WHITE)
            views.setTextColor(R.id.widget_meta, Color.rgb(170, 163, 176))
            views.setTextColor(R.id.widget_progress_text, accent)
            views.setTextColor(R.id.widget_next, Color.rgb(205, 198, 209))
            views.setInt(R.id.widget_progress, "setProgressTint", accent)

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
    }

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        refresh(context)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == Intent.ACTION_TIME_CHANGED ||
            intent.action == Intent.ACTION_TIMEZONE_CHANGED ||
            intent.action == Intent.ACTION_DATE_CHANGED
        ) {
            refresh(context)
        }
    }

    private fun updateAll(context: Context, manager: AppWidgetManager, ids: IntArray) {
        ids.forEach { manager.updateAppWidget(it, buildViews(context)) }
    }
}

private data class WidgetLesson(
    val date: String,
    val time: String,
    val lesson: String,
    val room: String
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
                            item.optString("room")
                        )
                    )
                }
            }
        } catch (_: Exception) {
            emptyList()
        }

        val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Calendar.getInstance().time)
        val todayLessons = lessons
            .filter { it.date == today }
            .sortedBy { toMinutes(it.time) }

        if (todayLessons.isEmpty()) {
            return WidgetState(
                "КМК • 10 м/с",
                "Сегодня пар нет",
                "Расписание свободно",
                "—",
                0,
                "Открой приложение для календаря"
            )
        }

        val nowMinutes = Calendar.getInstance().let { it.get(Calendar.HOUR_OF_DAY) * 60 + it.get(Calendar.MINUTE) }
        val currentIndex = todayLessons.indexOfFirst { it.time.let(::toMinutes) > nowMinutes } - 1
        val current = currentIndex.takeIf { it >= 0 }?.let { todayLessons[it] }
        val next = todayLessons.firstOrNull { toMinutes(it.time) > nowMinutes }

        return if (current != null && nowMinutes < toMinutes(current.time) + 90) {
            val elapsed = (nowMinutes - toMinutes(current.time)).coerceAtLeast(0)
            val progress = (elapsed / 90f * 100).roundToInt().coerceIn(0, 100)
            WidgetState(
                "КМК • 10 м/с",
                current.lesson,
                buildMeta(current),
                "Идёт • $progress%",
                progress,
                if (next != null) "Следующая ${next.time} • ${next.lesson}" else "Следующей пары сегодня нет"
            )
        } else if (next != null) {
            WidgetState(
                "КМК • 10 м/с",
                "Следующая пара",
                "${next.time} • ${next.lesson}",
                "До начала • ${formatCountdown(nowMinutes, toMinutes(next.time))}",
                0,
                buildMeta(next)
            )
        } else {
            WidgetState(
                "КМК • 10 м/с",
                "На сегодня всё 🎉",
                "Все пары закончились",
                "100%",
                100,
                "Открой приложение для завтра"
            )
        }
    }

    private fun buildMeta(lesson: WidgetLesson): String =
        if (lesson.room.isBlank()) lesson.time else "${lesson.time} • каб. ${lesson.room}"

    private fun toMinutes(value: String): Int {
        val match = Regex("^(\\d{1,2})[:.](\\d{2})").find(value.trim()) ?: return 9999
        return match.groupValues[1].toInt() * 60 + match.groupValues[2].toInt()
    }

    private fun formatCountdown(now: Int, target: Int): String {
        var delta = target - now
        if (delta < 0) delta += 24 * 60
        return when {
            delta >= 60 -> "${delta / 60} ч ${delta % 60} мин"
            else -> "$delta мин"
        }
    }
}
