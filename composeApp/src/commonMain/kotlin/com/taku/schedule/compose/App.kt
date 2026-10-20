package com.taku.schedule.compose

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

private val Accent = Color(0xFF9B87F5)
private val Muted = Color(0xFFB8B3C7)
private enum class Tab(val title: String, val label: String) {
    SCHEDULE("Расписание", "Пары"), GRADES("Мои оценки", "Оценки"),
    CALENDAR("Календарь", "Дни"), SETTINGS("Настройки", "Ещё")
}
private data class Subject(val id: Int, val name: String)
private data class Grade(val id: Int, val subjectId: Int, val value: Int, val date: String, val kind: String, val comment: String)
private enum class DebtStatus(val title: String) { OPEN("Не сдано"), REVIEW("На проверке"), DONE("Закрыто") }
private data class Debt(val id: Int, val subjectId: Int, val title: String, val status: DebtStatus)

@Composable
fun ScheduleApp() {
    var dark by remember { mutableStateOf(true) }
    val subjects = remember { mutableStateListOf<Subject>() }
    val grades = remember { mutableStateListOf<Grade>() }
    val debts = remember { mutableStateListOf<Debt>() }
    var tab by remember { mutableStateOf(Tab.SCHEDULE) }
    var nextId by remember { mutableIntStateOf(1) }
    var dialog by remember { mutableStateOf<String?>(null) }
    val colors = if (dark) darkColorScheme(
        primary = Accent, secondary = Color(0xFF75D6A1),
        background = Color(0xFF111018), surface = Color(0xFF1B1925),
        surfaceVariant = Color(0xFF292536), onBackground = Color(0xFFF4F0FF),
        onSurface = Color(0xFFF4F0FF)
    ) else lightColorScheme(primary = Color(0xFF6650B8), background = Color(0xFFF7F5FC), surface = Color.White)

    MaterialTheme(colorScheme = colors) {
        Scaffold(
            containerColor = MaterialTheme.colorScheme.background,
            bottomBar = {
                NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
                    Tab.entries.forEach { item ->
                        NavigationBarItem(
                            selected = tab == item, onClick = { tab = item },
                            icon = { Text(when (item) { Tab.SCHEDULE -> "▦"; Tab.GRADES -> "✓"; Tab.CALENDAR -> "▣"; Tab.SETTINGS -> "•••" }) },
                            label = { Text(item.label) }
                        )
                    }
                }
            }
        ) { padding ->
            Column(
                Modifier.fillMaxSize().padding(padding).padding(horizontal = 18.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Spacer(Modifier.height(6.dp))
                Text(tab.title, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                Text(
                    when (tab) {
                        Tab.SCHEDULE -> "Твой учебный день — без лишнего"
                        Tab.GRADES -> "Успеваемость и то, что нужно закрыть"
                        Tab.CALENDAR -> "Планируй учебные дни"
                        Tab.SETTINGS -> "Настрой приложение под себя"
                    }, color = Muted
                )
                when (tab) {
                    Tab.SCHEDULE -> ScheduleScreen(subjects.size, grades.size, debts.count { it.status != DebtStatus.DONE },
                        { tab = Tab.GRADES }, { dialog = "subject" })
                    Tab.GRADES -> GradesScreen(subjects, grades, debts,
                        { dialog = "grade" }, { dialog = "debt" }, { dialog = "subject" },
                        { id -> grades.removeAll { it.id == id } },
                        { id ->
                            val i = debts.indexOfFirst { it.id == id }
                            if (i >= 0) debts[i] = debts[i].copy(status = when (debts[i].status) {
                                DebtStatus.OPEN -> DebtStatus.REVIEW
                                DebtStatus.REVIEW -> DebtStatus.DONE
                                DebtStatus.DONE -> DebtStatus.OPEN
                            })
                        })
                    Tab.CALENDAR -> SimpleCard("Учебный календарь",
                        "Здесь появится выбор даты и просмотр занятий после подключения реального расписания. Приложение не будет придумывать пары.")
                    Tab.SETTINGS -> Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        SimpleCard("Оформление", "Переключай оформление между тёмной и светлой темой.")
                        OutlinedButton(onClick = { dark = !dark }, modifier = Modifier.fillMaxWidth()) {
                            Text(if (dark) "Включить светлую тему" else "Включить тёмную тему")
                        }
                        Text("Сохранение настроек и журнала между запусками будет подключено следующим этапом.", color = Muted)
                    }
                }
            }
        }
        when (dialog) {
            "subject" -> SubjectDialog({ dialog = null }) { name ->
                if (name.isNotBlank()) subjects.add(Subject(nextId++, name.trim()))
                dialog = null
            }
            "grade" -> GradeDialog(subjects, { dialog = null }, { dialog = "subject" }) { subjectId, value, date, kind, comment ->
                grades.add(Grade(nextId++, subjectId, value, date, kind, comment))
                dialog = null
            }
            "debt" -> DebtDialog(subjects, { dialog = null }, { dialog = "subject" }) { subjectId, title ->
                debts.add(Debt(nextId++, subjectId, title, DebtStatus.OPEN))
                dialog = null
            }
        }
    }
}

private fun formatAverage(value: Double): String = (kotlin.math.round(value * 100.0) / 100.0).toString()

@Composable
private fun ScheduleScreen(subjectCount: Int, gradeCount: Int, debtCount: Int, onGrades: () -> Unit, onSubject: () -> Unit) {
    LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Card(shape = RoundedCornerShape(24.dp), modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("СЕГОДНЯ", color = Accent, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold)
                    Text("Твоё расписание", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                    Text("Подключение существующего расписания КМК — следующий этап. Пока реальные пары не загружены, выдуманных занятий здесь нет.", color = Muted)
                }
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                StatCard("Предметы", subjectCount.toString(), Modifier.weight(1f))
                StatCard("Оценки", gradeCount.toString(), Modifier.weight(1f))
                StatCard("Закрыть", debtCount.toString(), Modifier.weight(1f))
            }
        }
        item {
            Card(shape = RoundedCornerShape(22.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Учёба под контролем", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    Text("Добавляй оценки и отмечай работы, которые осталось сдать.", color = Muted)
                    Button(onClick = onGrades, modifier = Modifier.fillMaxWidth()) { Text("Открыть оценки") }
                    OutlinedButton(onClick = onSubject, modifier = Modifier.fillMaxWidth()) { Text("Добавить предмет") }
                }
            }
        }
    }
}

@Composable
private fun StatCard(label: String, value: String, modifier: Modifier) {
    Card(modifier, shape = RoundedCornerShape(18.dp)) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Text(value, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            Text(label, style = MaterialTheme.typography.labelSmall, color = Muted)
        }
    }
}

@Composable
private fun GradesScreen(
    subjects: List<Subject>, grades: List<Grade>, debts: List<Debt>,
    addGrade: () -> Unit, addDebt: () -> Unit, addSubject: () -> Unit,
    deleteGrade: (Int) -> Unit, cycleDebt: (Int) -> Unit
) {
    val average = if (grades.isEmpty()) null else grades.map { it.value }.average()
    LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Card(shape = RoundedCornerShape(24.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant), modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("СРЕДНИЙ БАЛЛ", color = Accent, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold)
                    Text(average?.let { formatAverage(it) } ?: "—", style = MaterialTheme.typography.displaySmall, fontWeight = FontWeight.Bold)
                    Text(grades.size.toString() + " оценок · " + debts.count { it.status != DebtStatus.DONE } + " активных задолженностей", color = Muted)
                }
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = addGrade, modifier = Modifier.weight(1f)) { Text("+ Оценка") }
                OutlinedButton(onClick = addDebt, modifier = Modifier.weight(1f)) { Text("+ Долг") }
            }
        }
        if (subjects.isEmpty()) {
            item {
                EmptyState("Начни со списка предметов", "Добавь предмет, а затем записывай оценки и задолженности.")
                OutlinedButton(onClick = addSubject, modifier = Modifier.fillMaxWidth()) { Text("Добавить первый предмет") }
            }
        } else {
            item { Text("Предметы", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold) }
            items(subjects, key = { "subject-" + it.id }) { subject ->
                val sg = grades.filter { it.subjectId == subject.id }
                val sd = debts.filter { it.subjectId == subject.id }
                val subjectAverage = if (sg.isEmpty()) null else sg.map { it.value }.average()
                Card(shape = RoundedCornerShape(20.dp), modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(15.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(subject.name, modifier = Modifier.weight(1f), fontWeight = FontWeight.SemiBold)
                            Text(subjectAverage?.let { formatAverage(it) } ?: "—", color = Accent, fontWeight = FontWeight.Bold)
                        }
                        Text(sg.size.toString() + " оценок · " + sd.count { it.status != DebtStatus.DONE } + " незакрытых работ", color = Muted, style = MaterialTheme.typography.bodySmall)
                        sg.forEach { grade ->
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Column(Modifier.weight(1f)) {
                                    Text(grade.value.toString() + " · " + grade.kind)
                                    Text(grade.date + if (grade.comment.isNotBlank()) " · " + grade.comment else "", color = Muted, style = MaterialTheme.typography.bodySmall)
                                }
                                TextButton(onClick = { deleteGrade(grade.id) }) { Text("Удалить") }
                            }
                        }
                        sd.forEach { debt ->
                            if (debt.status != DebtStatus.DONE) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Column(Modifier.weight(1f)) {
                                        Text(debt.title)
                                        Text(debt.status.title, color = Color(0xFFFFC477), style = MaterialTheme.typography.bodySmall)
                                    }
                                    TextButton(onClick = { cycleDebt(debt.id) }) { Text(if (debt.status == DebtStatus.OPEN) "На проверку" else "Закрыть") }
                                }
                            }
                        }
                    }
                }
            }
        }
        if (debts.any { it.status == DebtStatus.DONE }) {
            item { Text("История закрытых работ", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold) }
            items(debts.filter { it.status == DebtStatus.DONE }) { debt ->
                Text("✓ " + (subjects.firstOrNull { it.id == debt.subjectId }?.name ?: "Предмет") + " — " + debt.title, color = Color(0xFF75D6A1))
            }
        }
        item { Text("Оценки вводятся вручную и не являются официальными данными колледжа.", color = Muted, style = MaterialTheme.typography.bodySmall) }
    }
}

@Composable
private fun SimpleCard(title: String, description: String) {
    Card(shape = RoundedCornerShape(22.dp), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Text(description, color = Muted)
        }
    }
}

@Composable
private fun EmptyState(title: String, description: String) {
    Column(Modifier.fillMaxWidth().padding(vertical = 12.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text("＋", style = MaterialTheme.typography.headlineMedium, color = Accent)
        Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        Text(description, color = Muted)
    }
}

@Composable
private fun SubjectDialog(onDismiss: () -> Unit, onSave: (String) -> Unit) {
    var name by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Новый предмет") },
        text = { OutlinedTextField(name, { name = it }, label = { Text("Название предмета") }, singleLine = true) },
        confirmButton = { TextButton(onClick = { onSave(name) }, enabled = name.isNotBlank()) { Text("Добавить") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } }
    )
}

@Composable
private fun GradeDialog(
    subjects: List<Subject>, onDismiss: () -> Unit, onAddSubject: () -> Unit,
    onSave: (Int, Int, String, String, String) -> Unit
) {
    var subjectId by remember { mutableStateOf(subjects.firstOrNull()?.id) }
    var value by remember { mutableIntStateOf(4) }
    var date by remember { mutableStateOf("") }
    var kind by remember { mutableStateOf("Ответ") }
    var comment by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss, title = { Text("Добавить оценку") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
                if (subjects.isEmpty()) {
                    Text("Сначала добавь предмет.")
                    TextButton(onClick = onAddSubject) { Text("Добавить предмет") }
                } else {
                    Text("Предмет")
                    subjects.forEach { subject ->
                        FilterChip(subjectId == subject.id, { subjectId = subject.id }, label = { Text(subject.name) })
                    }
                    Text("Оценка")
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        (2..5).forEach { n -> FilterChip(value == n, { value = n }, label = { Text(n.toString()) }) }
                    }
                    OutlinedTextField(date, { date = it }, label = { Text("Дата (например, 21.10.2026)") }, singleLine = true)
                    Text("Тип работы")
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        listOf("Ответ", "Практика", "Контрольная").forEach { option ->
                            FilterChip(kind == option, { kind = option }, label = { Text(option) })
                        }
                    }
                    OutlinedTextField(comment, { comment = it }, label = { Text("Комментарий (необязательно)") })
                }
            }
        },
        confirmButton = {
            TextButton(onClick = { subjectId?.let { onSave(it, value, date.ifBlank { "Дата не указана" }, kind, comment) } }, enabled = subjectId != null) { Text("Сохранить") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } }
    )
}

@Composable
private fun DebtDialog(
    subjects: List<Subject>, onDismiss: () -> Unit, onAddSubject: () -> Unit,
    onSave: (Int, String) -> Unit
) {
    var subjectId by remember { mutableStateOf(subjects.firstOrNull()?.id) }
    var title by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss, title = { Text("Добавить задолженность") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
                if (subjects.isEmpty()) {
                    Text("Сначала добавь предмет.")
                    TextButton(onClick = onAddSubject) { Text("Добавить предмет") }
                } else {
                    subjects.forEach { subject -> FilterChip(subjectId == subject.id, { subjectId = subject.id }, label = { Text(subject.name) }) }
                    OutlinedTextField(title, { title = it }, label = { Text("Что нужно сдать") })
                }
            }
        },
        confirmButton = {
            TextButton(onClick = { subjectId?.let { onSave(it, title.trim()) } }, enabled = subjectId != null && title.isNotBlank()) { Text("Добавить") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } }
    )
}
