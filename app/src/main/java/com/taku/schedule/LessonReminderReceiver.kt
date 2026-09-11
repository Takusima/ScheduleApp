package com.taku.schedule

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

class LessonReminderReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent?) {
        val lesson = intent?.getStringExtra("lesson") ?: return
        val time = intent.getStringExtra("time") ?: ""
        val room = intent.getStringExtra("room") ?: ""
        val minutes = intent.getIntExtra("minutes", 10)
        val mode = intent.getStringExtra("sound") ?: "alarm"

        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return

        val channelId = "lesson_reminders_$mode"
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(channelId, "Напоминания о парах", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Уведомления перед началом пары"
                when (mode) {
                    "silent" -> setSound(null, null)
                    "vibrate" -> {
                        setSound(null, null)
                        enableVibration(true)
                        vibrationPattern = longArrayOf(0, 350, 180, 350)
                    }
                    "both" -> {
                        setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM), AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
                        enableVibration(true)
                        vibrationPattern = longArrayOf(0, 350, 180, 350)
                    }
                    else -> setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM), AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
                }
            }
            manager.createNotificationChannel(channel)
        }

        val pending = PendingIntent.getActivity(
            context,
            9011,
            Intent(context, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or if (Build.VERSION.SDK_INT >= 23) PendingIntent.FLAG_IMMUTABLE else 0
        )

        val text = buildString {
            append("Через ").append(minutes).append(" мин. начнётся: ").append(lesson)
            if (time.isNotBlank()) append(" • ").append(time)
            if (room.isNotBlank()) append(" • каб. ").append(room)
        }

        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle("⏰ Скоро пара")
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setContentIntent(pending)
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()

        NotificationManagerCompat.from(context).notify(intent.getIntExtra("notificationId", 9012), notification)
    }
}
