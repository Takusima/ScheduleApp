package com.taku.schedule

import java.io.File
import java.util.Calendar
import java.util.regex.Pattern

object ScheduleFileSelector {

    private val RANGE_PATTERN = Pattern.compile(
        "(?<!\\d)(\\d{1,2})[.]\\s*(\\d{1,2})(?:[.]\\s*(\\d{2,4}))?\\s*[-–—]\\s*(\\d{1,2})[.]\\s*(\\d{1,2})(?:[.]\\s*(\\d{2,4}))?"
    )

    fun select(files: List<File>): List<File> {
        if (files.isEmpty()) return emptyList()
        if (files.size == 1) return files

        val today = Calendar.getInstance()
        val candidates = files.mapNotNull { file ->
            val range = parseRange(file.name, today)
            if (range == null) null else ScheduleCandidate(file, range.first, range.second)
        }

        if (candidates.isEmpty()) {
            return listOf(files.maxByOrNull { it.lastModified() } ?: files.first())
        }

        val active = candidates
            .filter { it.start <= todayDay(today) && todayDay(today) <= it.end }
            .sortedWith(compareByDescending<ScheduleCandidate> { it.start }.thenByDescending { it.file.name.lowercase() })

        if (active.isNotEmpty()) {
            return listOf(active.first().file)
        }

        val future = candidates
            .filter { it.start > todayDay(today) }
            .sortedWith(compareBy<ScheduleCandidate> { it.start }.thenBy { it.file.name.lowercase() })

        if (future.isNotEmpty()) {
            return listOf(future.first().file)
        }

        val past = candidates
            .sortedWith(compareByDescending<ScheduleCandidate> { it.end }.thenByDescending { it.file.name.lowercase() })

        return listOf(past.first().file)
    }

    private fun parseRange(
        name: String,
        today: Calendar
    ): Pair<Int, Int>? {
        val matcher = RANGE_PATTERN.matcher(name)
        if (!matcher.find()) return null

        val startDay = matcher.group(1)?.toIntOrNull() ?: return null
        val startMonth = matcher.group(2)?.toIntOrNull() ?: return null
        val startYearRaw = matcher.group(3)?.toIntOrNull()

        val endDay = matcher.group(4)?.toIntOrNull() ?: return null
        val endMonth = matcher.group(5)?.toIntOrNull() ?: return null
        val endYearRaw = matcher.group(6)?.toIntOrNull()

        val currentYear = today.get(Calendar.YEAR)
        val startYear = normalizeYear(startYearRaw ?: currentYear, currentYear)
        val endYear = normalizeYear(endYearRaw ?: startYear, currentYear)

        val start = dayNumber(startYear, startMonth, startDay)
        var end = dayNumber(endYear, endMonth, endDay)

        if (end < start) {
            end = dayNumber(startYear + 1, endMonth, endDay)
        }

        return start to end
    }

    private fun normalizeYear(value: Int, currentYear: Int): Int {
        return if (value < 100) 2000 + value else value
    }

    private fun dayNumber(year: Int, month: Int, day: Int): Int {
        return year * 10000 + month * 100 + day
    }

    private fun todayDay(calendar: Calendar): Int {
        return calendar.get(Calendar.YEAR) * 10000 +
            (calendar.get(Calendar.MONTH) + 1) * 100 +
            calendar.get(Calendar.DAY_OF_MONTH)
    }

    private data class ScheduleCandidate(
        val file: File,
        val start: Int,
        val end: Int
    )
}
