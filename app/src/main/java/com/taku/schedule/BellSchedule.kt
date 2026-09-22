package com.taku.schedule

import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter

data class BellSlot(
    val number: Int,
    val start: LocalTime,
    val end: LocalTime
)

object BellSchedule {
    private val formatter = DateTimeFormatter.ofPattern("HH:mm")

    private val weekday = listOf(
        "09:00-09:45",
        "09:55-10:40",
        "10:50-11:35",
        "11:45-12:30",
        "13:10-13:55",
        "14:05-14:50",
        "15:00-15:45",
        "15:55-16:40",
        "16:50-17:35",
        "17:45-18:30"
    )

    private val saturday = listOf(
        "09:00-09:45",
        "09:55-10:40",
        "10:50-11:35",
        "11:45-12:30",
        "12:40-13:25",
        "13:35-14:20"
    )

    private val preholiday = listOf(
        "09:00-10:00",
        "10:10-11:10",
        "11:20-12:20",
        "12:30-13:30"
    )

    fun forDate(date: LocalDate): List<BellSlot> {
        val raw = when {
            date.dayOfWeek.value == 6 -> saturday
            isPreholiday(date) -> preholiday
            else -> weekday
        }

        return raw.mapIndexed { index, value ->
            val parts = value.split('-')
            BellSlot(
                number = index + 1,
                start = LocalTime.parse(parts[0], formatter),
                end = LocalTime.parse(parts[1], formatter)
            )
        }
    }

    fun forDateKey(key: String): List<BellSlot>? = try {
        forDate(LocalDate.parse(key))
    } catch (_: Exception) {
        null
    }

    fun slotForStart(date: LocalDate, minuteOfDay: Int): BellSlot? =
        forDate(date).firstOrNull {
            it.start.hour * 60 + it.start.minute == minuteOfDay
        }

    fun slotForIndex(date: LocalDate, index: Int): BellSlot? =
        forDate(date).getOrNull(index)

    fun modeTitle(date: LocalDate): String = when {
        isPreholiday(date) -> "Предпраздничный день"
        date.dayOfWeek.value == 6 -> "Суббота"
        else -> "Будни"
    }

    private fun isPreholiday(date: LocalDate): Boolean {
        return false
    }
}
