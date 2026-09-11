package com.taku.schedule

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import java.util.Calendar

class NewYearReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent?) {
        val year = Calendar.getInstance().get(Calendar.YEAR)
        val manager = context.getSystemService(NotificationManager::class.java)
            ?: return

        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            ScheduleSync.scheduleNextNewYear(context)
            return
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(
                NotificationChannel(
                    CHANNEL_ID,
                    "Праздники",
                    NotificationManager.IMPORTANCE_DEFAULT
                ).apply {
                    description = "Праздничные уведомления приложения"
                }
            )
        }

        val openApp = PendingIntent.getActivity(
            context,
            2026,
            Intent(context, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        manager.notify(
            year,
            NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle("🎆 С Новым годом!")
                .setContentText("С Новым годом! Пусть ${year} будет отличным!")
                .setStyle(
                    NotificationCompat.BigTextStyle()
                        .bigText("С Новым годом! 🎆 Желаем отличного ${year} года!")
                )
                .setAutoCancel(true)
                .setContentIntent(openApp)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .build()
        )

        ScheduleSync.scheduleNextNewYear(context)
    }

    companion object {
        const val CHANNEL_ID = "new_year"
    }
}
