package com.taku.schedule.compose

data class Lesson(
    val date: String,
    val pair: Int,
    val start: String,
    val end: String,
    val subject: String,
    val teacher: String = "",
    val room: String = "",
)

data class ScheduleGroup(
    val id: String,
    val name: String,
)

data class Personalization(
    val theme: AppTheme = AppTheme.DARK,
    val backgroundOpacity: Float = 1f,
    val customBackground: String? = null,
)

enum class AppTheme { LIGHT, DARK, OLED, COLOR }
