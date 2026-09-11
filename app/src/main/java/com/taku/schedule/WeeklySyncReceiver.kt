 package com.taku.schedule

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.zip.ZipInputStream
import kotlin.concurrent.thread

class WeeklySyncReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent?) {
        ScheduleSync.scheduleNextSunday(context)

        val pending = goAsync()

        thread {
            try {
                val zipUrl = createZipLink()
                val zipBytes = httpGet(zipUrl)

                val temp = File(
                    context.filesDir,
                    "schedule_cache_tmp"
                ).apply {
                    deleteRecursively()
                    mkdirs()
                }

                val files = unzipXlsx(zipBytes, temp)

                if (files.isNotEmpty()) {
                    val target = File(
                        context.filesDir,
                        "schedule_cache"
                    )

                    target.deleteRecursively()

                    if (!temp.renameTo(target)) {
                        target.mkdirs()

                        files.forEach { file ->
                            file.copyTo(
                                File(target, file.name),
                                overwrite = true
                            )
                        }

                        temp.deleteRecursively()
                    }
                } else {
                    temp.deleteRecursively()
                }

            } catch (_: Exception) {
                // При ошибке старая офлайн-копия остаётся.
            } finally {
                pending.finish()
            }
        }
    }

    private fun createZipLink(): String {
        val conn = (
            URL(
                "https://cloud.mail.ru/api/v3/zip/weblink"
            ).openConnection() as HttpURLConnection
        ).apply {
            requestMethod = "POST"
            connectTimeout = 20000
            readTimeout = 30000
            doOutput = true

            setRequestProperty(
                "Content-Type",
                "application/json;charset=UTF-8"
            )

            setRequestProperty(
                "Accept",
                "application/json"
            )

            setRequestProperty(
                "User-Agent",
                "ScheduleApp/1.0"
            )
        }

        val body =
            "{\"x-email\":\"anonym\",\"weblink_list\":[\"vH1B/7LrFtqWqP\"],\"name\":\"schedule\"}"

        conn.outputStream.use {
            it.write(body.toByteArray(Charsets.UTF_8))
        }

        val text = (
            if (conn.responseCode >= 400) {
                conn.errorStream
            } else {
                conn.inputStream
            }
        ).bufferedReader(Charsets.UTF_8).use {
            it.readText()
        }

        if (conn.responseCode !in 200..299) {
            error("HTTP ${conn.responseCode}")
        }

        val key = JSONObject(text).optString("key")

        if (key.isBlank()) {
            error("Mail Облако не вернуло ссылку на архив")
        }

        return if (key.startsWith("http")) {
            key
        } else {
            "https://cloud.mail.ru$key"
        }
    }

    private fun httpGet(urlText: String): ByteArray {
        val conn = (
            URL(urlText).openConnection() as HttpURLConnection
        ).apply {
            requestMethod = "GET"
            connectTimeout = 20000
            readTimeout = 60000

            setRequestProperty(
                "User-Agent",
                "ScheduleApp/1.0"
            )

            setRequestProperty(
                "Referer",
                "https://cloud.mail.ru/public/vH1B/7LrFtqWqP"
            )
        }

        if (conn.responseCode !in 200..399) {
            error("HTTP ${conn.responseCode}")
        }

        return conn.inputStream.use {
            it.readBytes()
        }
    }

    private fun unzipXlsx(
        zipBytes: ByteArray,
        folder: File
    ): List<File> {

        val out = mutableListOf<File>()

        ZipInputStream(
            zipBytes.inputStream()
        ).use { zis ->

            while (true) {
                val entry = zis.nextEntry ?: break

                if (
                    !entry.isDirectory &&
                    entry.name.lowercase().endsWith(".xlsx")
                ) {
                    val name = entry.name
                        .substringAfterLast('/')
                        .replace(
                            Regex("[^\\p{L}\\p{N}._ -]"),
                            "_"
                        )

                    val file = File(
                        folder,
                        name
                    )

                    FileOutputStream(file).use {
                        zis.copyTo(it)
                    }

                    out += file
                }

                zis.closeEntry()
            }
        }

        return out
    }
}
