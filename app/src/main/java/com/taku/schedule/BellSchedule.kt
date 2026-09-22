package com.taku.schedule

data class BellSlot(
    val number: Int,
    val startMinutes: Int,
    val endMinutes: Int
) {
    val startText: String
        get() = format(startMinutes)

    val endText: String
        get() = format(endMinutes)

    fun rangeText(): String = "$startText–$endText"

    companion object {
        private fun format(value: Int): String {
            val h = value / 60
            val m = value % 60
            return "%02d:%02d".format(h, m)
        }
    }
}

object BellSchedule {
    private val weekday = listOf(
        9 * 60 to 9 * 60 + 45,
        9 * 60 + 55 to 10 * 60 + 40,
        10 * 60 + 50 to 11 * 60 + 35,
        11 * 60 + 45 to 12 * 60 + 30,
        13 * 60 + 10 to 13 * 60 + 55,
        14 * 60 + 5 to 14 * 60 + 50,
        15 * 60 to 15 * 60 + 45,
        15 * 60 + 55 to 16 * 60 + 40,
        16 * 60 + 50 to 17 * 60 + 35,
        17 * 60 + 45 to 18 * 60 + 30
    )

    private val saturday = listOf(
        9 * 60 to 9 * 60 + 45,
        9 * 60 + 55 to 10 * 60 + 40,
        10 * 60 + 50 to 11 * 60 + 35,
        11 * 60 + 45 to 12 * 60 + 30,
        12 * 60 + 40 to 13 * 60 + 25,
        13 * 60 + 35 to 14 * 60 + 20
    )

    private val preholiday = listOf(
        9 * 60 to 10 * 60,
        10 * 60 + 10 to 11 * 60 + 10,
        11 * 60 + 20 to 12 * 60 + 20,
        12 * 60 + 30 to 13 * 60 + 30
    )

    fun forDate(year: Int, month: Int, day: Int): List<BellSlot> {
        val calendar = java.util.Calendar.getInstance().apply {
            set(java.util.Calendar.YEAR, year)
            set(java.util.Calendar.MONTH, month - 1)
            set(java.util.Calendar.DAY_OF_MONTH, day)
        }
        val raw = when {
            calendar.get(java.util.Calendar.DAY_OF_WEEK) == java.util.Calendar.SATURDAY -> saturday
            isPreholiday(year, month, day) -> preholiday
            else -> weekday
        }
        return raw.mapIndexed { index, pair ->
            BellSlot(index + 1, pair.first, pair.second)
        }
    }

    fun forDateKey(key: String): List<BellSlot>? {
        val match = Regex("^(\\d{4})-(\\d{2})-(\\d{2})$").find(key) ?: return null
        return try {
            forDate(
                match.groupValues[1].toInt(),
                match.groupValues[2].toInt(),
                match.groupValues[3].toInt()
            )
        } catch (_: Exception) {
            null
        }
    }

    fun modeTitle(year: Int, month: Int, day: Int): String {
        val calendar = java.util.Calendar.getInstance().apply {
            set(java.util.Calendar.YEAR, year)
            set(java.util.Calendar.MONTH, month - 1)
            set(java.util.Calendar.DAY_OF_MONTH, day)
        }
        return when {
            isPreholiday(year, month, day) -> "Предпраздничный день"
            calendar.get(java.util.Calendar.DAY_OF_WEEK) == java.util.Calendar.SATURDAY -> "Суббота"
            else -> "Будни"
        }
    }

    fun modeTitleForKey(key: String): String =
        forDateKey(key)?.let {
            val m = key.split("-").map(String::toInt)
            modeTitle(m[0], m[1], m[2])
        } ?: "Будни"

    private fun isPreholiday(year: Int, month: Int, day: Int): Boolean {
        return false
    }
}
