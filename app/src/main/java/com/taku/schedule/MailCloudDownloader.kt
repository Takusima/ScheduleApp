package com.taku.schedule

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.zip.GZIPInputStream
import java.util.zip.ZipFile

object MailCloudDownloader {

    private const val ZIP_API_URL = "https://cloud.mail.ru/api/v3/zip/weblink"
    private const val TEMP_DIR = "schedule_cloud_tmp"
    private const val OLD_CACHE_DIR = "schedule_cloud_old"
    private const val USER_AGENT = "ScheduleApp/1.0"
    private const val MAX_REDIRECTS = 8

    fun download(context: Context): List<File> {
        val temp = File(context.filesDir, TEMP_DIR)
        val old = File(context.filesDir, OLD_CACHE_DIR)
        val cache = ScheduleRepository.cacheDir(context)

        temp.deleteRecursively()
        old.deleteRecursively()
        temp.mkdirs()

        return try {
            val zipUrl = createZipLink()
            val zipBytes = httpGetBytes(zipUrl)

            val zipFile = File(temp, "mail_schedule.zip")
            FileOutputStream(zipFile).use { it.write(zipBytes) }

            val extractedDir = File(temp, "excel")
            extractedDir.mkdirs()

            val extracted = extractExcel(zipFile, extractedDir)
            if (extracted.isEmpty()) {
                throw IllegalStateException("В ZIP Mail.ru не найдено Excel-файлов")
            }

            val selected = ScheduleFileSelector.select(extracted)
            if (selected.isEmpty()) {
                throw IllegalStateException("Не удалось выбрать расписание по дате")
            }

            selected.forEach { file ->
                if (!file.exists() || !file.isFile || file.length() <= 0) {
                    throw IllegalStateException("Повреждённый Excel-файл: ${file.name}")
                }
            }

            replaceCache(context, selected, cache, old)
        } catch (e: Exception) {
            temp.deleteRecursively()
            old.deleteRecursively()
            throw IllegalStateException(
                "Не удалось обновить расписание из Mail Облака" +
                    (e.message?.let { ": $it" } ?: ""),
                e
            )
        }
    }

    private fun createZipLink(): String {
        val connection = openConnection(ZIP_API_URL, "POST")
        try {
            val body = JSONObject()
                .put("x-email", "anonym")
                .put("weblink_list", JSONArray().put(ScheduleRepository.PUBLIC_CODE))
                .put("name", "schedule")
                .toString()

            connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }

            val code = connection.responseCode
            val text = readConnectionText(connection)

            if (code !in 200..299) {
                throw IllegalStateException("Mail API: HTTP $code")
            }

            val json = JSONObject(text)
            val key = json.optString("key").trim()
            if (key.isBlank()) {
                throw IllegalStateException("Mail API не вернул ZIP-ссылку")
            }

            return normalizeUrl(key)
        } finally {
            connection.disconnect()
        }
    }

    private fun httpGetBytes(urlText: String): ByteArray {
        var currentUrl = urlText
        var redirects = 0

        while (true) {
            val connection = openConnection(currentUrl, "GET")
            try {
                val code = connection.responseCode

                if (code in 300..399) {
                    val location = connection.getHeaderField("Location")
                        ?: throw IllegalStateException("Mail ZIP: HTTP $code без Location")
                    redirects++
                    if (redirects > MAX_REDIRECTS) {
                        throw IllegalStateException("Слишком много редиректов Mail.ru")
                    }
                    currentUrl = URL(URL(currentUrl), location).toString()
                    continue
                }

                if (code !in 200..299) {
                    throw IllegalStateException("Загрузка Mail ZIP: HTTP $code")
                }

                val raw = connection.inputStream.use { it.readBytes() }
                if (raw.isEmpty()) {
                    throw IllegalStateException("Mail ZIP: пустой ответ")
                }

                return decodeHttpBody(raw, connection.contentEncoding.orEmpty())
            } finally {
                connection.disconnect()
            }
        }
    }

    private fun openConnection(urlText: String, method: String): HttpURLConnection {
        return (URL(urlText).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 20_000
            readTimeout = 120_000
            instanceFollowRedirects = false
            setRequestProperty("User-Agent", USER_AGENT)
            setRequestProperty("Accept", "*/*")
            setRequestProperty("Accept-Encoding", "identity")

            if (method == "GET") {
                setRequestProperty("Referer", ScheduleRepository.PUBLIC_URL)
            } else {
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=UTF-8")
                setRequestProperty("Accept", "application/json")
            }
        }
    }

    private fun decodeHttpBody(bytes: ByteArray, encoding: String): ByteArray {
        if (!encoding.equals("gzip", ignoreCase = true)) return bytes
        return GZIPInputStream(ByteArrayInputStream(bytes)).use { it.readBytes() }
    }

    private fun extractExcel(zipFile: File, folder: File): List<File> {
        val result = mutableListOf<File>()

        ZipFile(zipFile).use { zip ->
            val entries = zip.entries()
            var index = 0
            val allNames = mutableListOf<String>()

            while (entries.hasMoreElements()) {
                val entry = entries.nextElement()
                if (entry.isDirectory) continue

                index++
                val name = entry.name.orEmpty()
                allNames += name

                if (!isExcelName(name)) continue

                val baseName = sanitizeFileName(name.substringAfterLast('/'))
                if (baseName.isBlank()) continue

                val target = uniqueFile(folder, baseName)
                zip.getInputStream(entry).use { input ->
                    FileOutputStream(target).use { output ->
                        input.copyTo(output)
                    }
                }

                if (target.length() > 0) {
                    result += target
                } else {
                    target.delete()
                }
            }

            if (result.isEmpty() && allNames.isNotEmpty()) {
                val preview = allNames.take(20).joinToString(" | ")
                throw IllegalStateException(
                    "Mail.ru ZIP содержит файлы, но Excel не найден. Внутри: $preview"
                )
            }
        }

        return result
    }

    private fun isExcelName(name: String): Boolean {
        val lower = name.trim().lowercase()
        return lower.endsWith(".xlsx") || lower.endsWith(".xls")
    }

    private fun replaceCache(
        context: Context,
        selected: List<File>,
        cache: File,
        old: File
    ): List<File> {
        old.deleteRecursively()

        if (cache.exists()) {
            if (!cache.renameTo(old)) {
                throw IllegalStateException("Не удалось подготовить старый кэш")
            }
        }

        try {
            cache.mkdirs()

            selected.forEach { source ->
                source.copyTo(
                    File(cache, sanitizeFileName(source.name)),
                    overwrite = true
                )
            }

            val result = ScheduleRepository.readCachedFiles(context)
            if (result.isEmpty()) {
                throw IllegalStateException("Не удалось сохранить расписание")
            }

            old.deleteRecursively()
            File(context.filesDir, TEMP_DIR).deleteRecursively()
            return result
        } catch (e: Exception) {
            cache.deleteRecursively()
            if (old.exists() && !old.renameTo(cache)) {
                throw IllegalStateException("Не удалось восстановить старый кэш", e)
            }
            throw e
        }
    }

    private fun normalizeUrl(value: String): String {
        val clean = value
            .replace("\\/", "/")
            .replace("\\u002F", "/")
            .trim()

        return when {
            clean.startsWith("https://") -> clean
            clean.startsWith("http://") -> clean
            clean.startsWith("/") -> "https://cloud.mail.ru$clean"
            else -> "https://cloud.mail.ru/$clean"
        }
    }

    private fun sanitizeFileName(name: String): String {
        val clean = name
            .substringAfterLast('/')
            .substringAfterLast('\\')
            .replace(Regex("[\\\\/:*?\"<>|]"), "_")
            .trim()
        return if (clean.isBlank()) "schedule.xlsx" else clean
    }

    private fun uniqueFile(folder: File, name: String): File {
        val dot = name.lastIndexOf('.')
        val base = if (dot > 0) name.substring(0, dot) else name
        val ext = if (dot > 0) name.substring(dot + 1) else ""

        var file = File(folder, name)
        var counter = 2
        while (file.exists()) {
            val next = if (ext.isBlank()) "$base ($counter)" else "$base ($counter).$ext"
            file = File(folder, next)
            counter++
        }
        return file
    }

    private fun readConnectionText(connection: HttpURLConnection): String {
        val stream = if (connection.responseCode >= 400) {
            connection.errorStream
        } else {
            connection.inputStream
        } ?: return ""

        return stream.bufferedReader(Charsets.UTF_8).use { it.readText() }
    }
}
