package com.taku.schedule

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import java.util.Calendar

object ScheduleSync {
    private const val REQUEST_CODE = 7142

    fun scheduleNextSunday(context: Context) {
        val alarmManager = context.getSystemService(AlarmManager::class.java) ?: return
        val intent = Intent(context, WeeklySyncReceiver::class.java)
        val pending = PendingIntent.getBroadcast(
            context,
            REQUEST_CODE,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val now = Calendar.getInstance()
        val next = now.clone() as Calendar
        next.set(Calendar.DAY_OF_WEEK, Calendar.SUNDAY)
        next.set(Calendar.HOUR_OF_DAY, 3)
        next.set(Calendar.MINUTE, 0)
        next.set(Calendar.SECOND, 0)
        next.set(Calendar.MILLISECOND, 0)

        if (!next.after(now)) next.add(Calendar.DAY_OF_YEAR, 7)

        alarmManager.setAndAllowWhileIdle(
            AlarmManager.RTC_WAKEUP,
            next.timeInMillis,
            pending
        )
    }
}
