package com.taku.schedule

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import org.json.JSONArray
import kotlin.math.abs

object LessonReminderScheduler {
    private const val PREFS = "lesson_reminders"
    private const val KEY_ENABLED = "enabled"
    private const val KEY_LEAD = "lead_minutes"
    private const val KEY_GROUP = "group"
    private const val KEY_SOUND = "sound"
    private const val KEY_JSON = "lessons_json"
    private const val KEY_IDS = "alarm_ids"
    private const val CHANNEL_ID = "lesson_start"
    const val PERMISSION_REQUEST = 4807

    fun configure(
        context: Context,
        enabled: Boolean,
        leadMinutes: Int,
        group: String,
        sound: String,
        lessonsJson: String
    ) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        prefs.edit()
            .putBoolean(KEY_ENABLED, enabled)
            .putInt(KEY_LEAD, leadMinutes.coerceIn(0, 60))
            .putString(KEY_GROUP, group)
            .putString(KEY_SOUND, sound.ifBlank { "default" })
            .putString(KEY_JSON, lessonsJson)
            .apply()

        if (enabled) reschedule(context) else cancelAll(context)
    }

    fun setEnabled(context: Context, enabled: Boolean, leadMinutes: Int) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        prefs.edit()
            .putBoolean(KEY_ENABLED, enabled)
            .putInt(KEY_LEAD, leadMinutes.coerceIn(0, 60))
            .apply()
        if (enabled) reschedule(context) else cancelAll(context)
    }

    fun isEnabled(context: Context): Boolean =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getBoolean(KEY_ENABLED, false)

    fun requestPermissionIfNeeded(activity: android.app.Activity): Boolean {
        if (Build.VERSION.SDK_INT < 33) return true
        if (activity.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
            return true
        }
        activity.requestPermissions(
            arrayOf(android.Manifest.permission.POST_NOTIFICATIONS),
            PERMISSION_REQUEST
        )
        return false
    }

    fun reschedule(context: Context) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (!prefs.getBoolean(KEY_ENABLED, false)) {
            cancelAll(context)
            return
        }

        if (Build.VERSION.SDK_INT >= 33 &&
            context.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return

        createChannel(context)
        cancelStored(context)

        val json = prefs.getString(KEY_JSON, "[]") ?: "[]"
        val lead = prefs.getInt(KEY_LEAD, 0).coerceIn(0, 60)
        val group = prefs.getString(KEY_GROUP, "").orEmpty()
        val array = try { JSONArray(json) } catch (_: Exception) { JSONArray() }

        val ids = ArrayList<Int>()
        val now = System.currentTimeMillis()
        val maxTime = now + 45L * 24L * 60L * 60L * 1000L

        for (i in 0 until array.length()) {
            val item = array.optJSONObject(i) ?: continue
            val date = item.optString("date")
            val time = item.optString("time")
            val lesson = item.optString("lesson")
            if (date.isBlank() || time.isBlank() || lesson.isBlank()) continue

            val start = parseDateTime(date, time) ?: continue
            val trigger = start - lead * 60_000L
            if (trigger <= now + 3_000L || trigger > maxTime) continue

            val actualGroup = item.optString("group").ifBlank { group }
            val room = item.optString("room")
            val id = stableId("$date|$time|$lesson|$actualGroup")
            val intent = Intent(context, LessonReminderReceiver::class.java).apply {
                putExtra("lesson", lesson)
                putExtra("time", time)
                putExtra("room", room)
                putExtra("group", actualGroup)
                putExtra("lead", lead)
            }
            val pending = PendingIntent.getBroadcast(
                context,
                id,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or immutableFlag()
            )
            val alarm = context.getSystemService(AlarmManager::class.java) ?: continue
            alarm.setAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP,
                trigger,
                pending
            )
            ids += id
        }

        prefs.edit().putString(KEY_IDS, ids.joinToString(",")).apply()
    }

    fun cancelAll(context: Context) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        cancelStored(context)
        prefs.edit().putString(KEY_IDS, "").apply()
    }

    private fun cancelStored(context: Context) {
        val alarm = context.getSystemService(AlarmManager::class.java) ?: return
        val ids = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_IDS, "")
            .orEmpty()
            .split(',')
            .mapNotNull { it.toIntOrNull() }

        ids.forEach { id ->
            val pending = PendingIntent.getBroadcast(
                context,
                id,
                Intent(context, LessonReminderReceiver::class.java),
                PendingIntent.FLAG_NO_CREATE or immutableFlag()
            )
            if (pending != null) alarm.cancel(pending)
        }
    }

    private fun createChannel(context: Context) {
        if (Build.VERSION.SDK_INT < 26) return
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Начало пар",
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = "Напоминания о начале занятий"
        }
        manager.createNotificationChannel(channel)
    }

    private fun parseDateTime(date: String, time: String): Long? = try {
        val d = Regex("^(\\d{4})-(\\d{2})-(\\d{2})$").find(date) ?: return null
        val t = Regex("^(\\d{1,2})[:.](\\d{2})").find(time) ?: return null
        val calendar = java.util.Calendar.getInstance().apply {
            set(java.util.Calendar.YEAR, d.groupValues[1].toInt())
            set(java.util.Calendar.MONTH, d.groupValues[2].toInt() - 1)
            set(java.util.Calendar.DAY_OF_MONTH, d.groupValues[3].toInt())
            set(java.util.Calendar.HOUR_OF_DAY, t.groupValues[1].toInt())
            set(java.util.Calendar.MINUTE, t.groupValues[2].toInt())
            set(java.util.Calendar.SECOND, 0)
            set(java.util.Calendar.MILLISECOND, 0)
        }
        calendar.timeInMillis
    } catch (_: Exception) {
        null
    }

    private fun stableId(value: String): Int {
        val raw = value.hashCode()
        return abs(if (raw == Int.MIN_VALUE) 1 else raw).coerceAtLeast(1)
    }

    private fun immutableFlag(): Int =
        if (Build.VERSION.SDK_INT >= 23) PendingIntent.FLAG_IMMUTABLE else 0
}

class LessonReminderReceiver : android.content.BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val lesson = intent?.getStringExtra("lesson").orEmpty().ifBlank { "Пара" }
        val time = intent?.getStringExtra("time").orEmpty()
        val room = intent?.getStringExtra("room").orEmpty()
        val group = intent?.getStringExtra("group").orEmpty()
        val lead = intent?.getIntExtra("lead", 0) ?: 0

        if (Build.VERSION.SDK_INT >= 33 &&
            context.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return

        val title = if (lead > 0) "Скоро пара" else "Начинается пара"
        val details = buildString {
            append(lesson)
            if (time.isNotBlank()) append(" • ").append(time)
            if (room.isNotBlank()) append(" • каб. ").append(room.removePrefix("Кабинет: "))
            if (group.isNotBlank()) append(" • ").append(group)
        }

        val launch = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val contentIntent = PendingIntent.getActivity(
            context,
            491,
            launch,
            PendingIntent.FLAG_UPDATE_CURRENT or immutableFlag()
        )

        val notification = NotificationCompat.Builder(context, "lesson_start")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(details)
            .setStyle(NotificationCompat.BigTextStyle().bigText(details))
            .setContentIntent(contentIntent)
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .build()

        NotificationManagerCompat.from(context)
            .notify(stableNotificationId("$time|$lesson|$group"), notification)
    }

    private fun stableNotificationId(value: String): Int {
        val raw = value.hashCode()
        return abs(if (raw == Int.MIN_VALUE) 1 else raw).coerceAtLeast(1)
    }

    private fun immutableFlag(): Int =
        if (Build.VERSION.SDK_INT >= 23) PendingIntent.FLAG_IMMUTABLE else 0
}
