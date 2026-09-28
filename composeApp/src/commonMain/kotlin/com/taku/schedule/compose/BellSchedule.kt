package com.taku.schedule.compose

data class BellPair(
    val pair: Int,
    val firstStart: String,
    val firstEnd: String,
    val secondStart: String,
    val secondEnd: String,
)

object BellSchedule {
    fun weekdays(): List<BellPair> = listOf(
        BellPair(1, "09:00", "09:45", "09:55", "10:40"),
        BellPair(2, "10:50", "11:35", "11:45", "12:30"),
        BellPair(3, "13:10", "13:55", "14:05", "14:50"),
        BellPair(4, "15:00", "15:45", "15:55", "16:40"),
        BellPair(5, "16:50", "17:35", "17:45", "18:30"),
    )

    fun saturday(): List<BellPair> = listOf(
        BellPair(1, "09:00", "09:45", "09:55", "10:40"),
        BellPair(2, "10:50", "11:35", "11:45", "12:30"),
        BellPair(3, "12:40", "13:25", "13:35", "14:20"),
    )
}
