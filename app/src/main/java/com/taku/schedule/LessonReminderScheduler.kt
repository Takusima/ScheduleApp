package com.taku.schedule

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import org.json.JSONArray
import java.text.SimpleDateFormat
import java.util.Locale

object LessonReminderScheduler {

    private const val PREFS = "lesson_reminders"
    private const val KEY_ENABLED = "enabled"
    private const val KEY_MINUTES = "minutes"
    private const val KEY_GROUP = "group"
    private const val KEY_SOUND = "sound"
    private const val KEY_LESSONS = "lessons"
    private const val KEY_IDS = "ids"
    private const val CHANNEL_REQUEST_BASE = 38000

    fun saveAndSchedule(
        context: Context,
        enabled: Boolean,
        minutes: Int,
        group: String,
        sound: String,
        lessonsJson: String
    ) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        prefs.edit()
            .putBoolean(KEY_ENABLED, enabled)
            .putInt(KEY_MINUTES, minutes.coerceIn(1, 120))
            .putString(KEY_GROUP, group)
            .putString(KEY_SOUND, sound)
            .putString(KEY_LESSONS, lessonsJson)
            .apply()
        schedule(context)
    }

    fun restore(context: Context) = schedule(context)

    fun schedule(context: Context) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        cancelExisting(context, prefs.getString(KEY_IDS, "") ?: "")

        if (!prefs.getBoolean(KEY_ENABLED, false)) {
            prefs.edit().putString(KEY_IDS, "").apply()
            return
        }

        val minutes = prefs.getInt(KEY_MINUTES, 10).coerceIn(1, 120)
        val sound = prefs.getString(KEY_SOUND, "alarm") ?: "alarm"
        val lessons = try { JSONArray(prefs.getString(KEY_LESSONS, "[]") ?: "[]") } catch (_: Exception) { JSONArray() }
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val now = System.currentTimeMillis()
        val formatter = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US)
        val ids = ArrayList<Int>()

        for (i in 0 until lessons.length()) {
            val item = lessons.optJSONObject(i) ?: continue
            val date = item.optString("date")
            val time = item.optString("time")
            val lesson = item.optString("lesson")
            val room = item.optString("room")
            if (date.isBlank() || time.isBlank() || lesson.isBlank()) continue
            val lessonAt = try { formatter.parse("$date $time")?.time ?: continue } catch (_: Exception) { continue }
            val triggerAt = lessonAt - minutes * 60_000L
            if (triggerAt <= now + 3_000L) continue

            val id = stableId("$date|$time|$lesson|$room")
            val intent = Intent(context, LessonReminderReceiver::class.java).apply {
                putExtra("lesson", lesson)
                putExtra("time", time)
                putExtra("room", room)
                putExtra("minutes", minutes)
                putExtra("sound", sound)
                putExtra("notificationId", id)
            }
            val pending = PendingIntent.getBroadcast(
                context,
                CHANNEL_REQUEST_BASE + id,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or immutableFlag()
            )
            try {
                alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pending)
                ids.add(id)
            } catch (_: SecurityException) { }
        }
        prefs.edit().putString(KEY_IDS, ids.joinToString(",")).apply()
    }

    private fun cancelExisting(context: Context, idsText: String) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        idsText.split(',').mapNotNull { it.trim().toIntOrNull() }.forEach { id ->
            val pending = PendingIntent.getBroadcast(
                context,
                CHANNEL_REQUEST_BASE + id,
                Intent(context, LessonReminderReceiver::class.java),
                PendingIntent.FLAG_NO_CREATE or immutableFlag()
            ) ?: return@forEach
            alarmManager.cancel(pending)
            pending.cancel()
        }
    }

    private fun stableId(value: String): Int = ((value.hashCode() and 0x7fffffff) % 900000) + 10000
    private fun immutableFlag(): Int = if (Build.VERSION.SDK_INT >= 23) PendingIntent.FLAG_IMMUTABLE else 0
}
