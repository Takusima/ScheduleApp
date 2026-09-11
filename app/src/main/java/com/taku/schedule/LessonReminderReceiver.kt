package com.taku.schedule

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import android.Manifest
import android.content.pm.PackageManager

class LessonReminderReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent?) {
        val lesson = intent?.getStringExtra("lesson") ?: return
        val time = intent.getStringExtra("time") ?: ""
        val room = intent.getStringExtra("room") ?: ""
        val minutes = intent.getIntExtra("minutes", 10)

        if (
            Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            return
        }

        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channelId = "lesson_reminders"

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            val audio = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
            val channel = NotificationChannel(
                channelId,
                "Напоминания о парах",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Звуковые уведомления перед началом пары"
                setSound(sound, audio)
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 350, 180, 350)
            }
            manager.createNotificationChannel(channel)
        }

        val openApp = Intent(context, MainActivity::class.java)
        val pending = android.app.PendingIntent.getActivity(
            context,
            9011,
            openApp,
            android.app.PendingIntent.FLAG_UPDATE_CURRENT or
                if (Build.VERSION.SDK_INT >= 23) android.app.PendingIntent.FLAG_IMMUTABLE else 0
        )

        val text = buildString {
            append("Через ")
            append(minutes)
            append(" мин. начнётся: ")
            append(lesson)
            if (time.isNotBlank()) {
                append(" • ")
                append(time)
            }
            if (room.isNotBlank()) {
                append(" • каб. ")
                append(room)
            }
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
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .build()

        NotificationManagerCompat.from(context).notify(
            intent?.getIntExtra("notificationId", 9012) ?: 9012,
            notification
        )
    }
}
