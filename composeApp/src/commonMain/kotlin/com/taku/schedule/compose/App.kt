package com.taku.schedule.compose

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun ScheduleApp() {
    MaterialTheme {
        Box(
            modifier = Modifier.fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
                .padding(16.dp),
            contentAlignment = Alignment.TopCenter
        ) {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text("Расписание для КМК", style = MaterialTheme.typography.headlineSmall)
                Text("Кроссплатформенная версия Android + iPhone")
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    MigrationCard("Android")
                    MigrationCard("iPhone")
                }
                Text("Существующий UI 0.2 сохраняется как эталон во время переноса.")
            }
        }
    }
}

@Composable
private fun RowScope.MigrationCard(text: String) {
    Box(
        modifier = Modifier.weight(1f).height(64.dp)
            .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(18.dp)),
        contentAlignment = Alignment.Center
    ) {
        Text(text)
    }
}
