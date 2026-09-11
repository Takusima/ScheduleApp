package com.taku.schedule

import android.content.Context
import android.net.Uri
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.zip.GZIPInputStream
import java.util.zip.ZipInputStream

object ScheduleRepository {

    const val PUBLIC_CODE = "vH1B/7LrFtqWqP"

    const val PUBLIC_URL =
        "https://cloud.mail.ru/public/$PUBLIC_CODE"

    private const val ZIP_API_URL =
        "https://cloud.mail.ru/api/v3/zip/weblink"

    private const val CACHE_DIR = "schedule_cache"
    private const val TEMP_DIR = "schedule_cache_tmp"
    private const val OLD_CACHE_DIR = "schedule_cache_old"
    private const val USER_AGENT = "ScheduleApp/1.0"
    private const val MAX_REDIRECTS = 6

    fun cacheDir(context: Context): File =
        File(context.filesDir, CACHE_DIR)

    fun readCachedFiles(context: Context): List<File> {
        return cacheDir(context)
            .listFiles()
            ?.filter { file -> file.isFile && isExcelFile(file.name) }
            ?.sortedBy { it.name.lowercase() }
            ?: emptyList()
    }

    fun downloadFromCloud(context: Context): List<File> {
        val temp = File(context.filesDir, TEMP_DIR)
        temp.deleteRecursively()
        temp.mkdirs()

        return try {
            val zipUrl = createZipLink()
            val zipBytes = httpGetBytes(zipUrl)

            if (zipBytes.isEmpty()) {
                throw IllegalStateException("Mail Облако вернуло пустой ответ")
            }

            val extracted = unzipExcel(zipBytes, temp)

            if (extracted.isEmpty()) {
                throw IllegalStateException(
                    "ZIP получен, но внутри не найдено Excel-файлов"
                )
            }

            extracted.forEach { file ->
                if (!file.exists() || !file.isFile || file.length() <= 0) {
                    throw IllegalStateException(
                        "Повреждённый Excel-файл: ${file.name}"
                    )
                }
            }

            replaceCache(context, extracted)
        } catch (e: Exception) {
            temp.deleteRecursively()
            throw IllegalStateException(
                "Не удалось обновить расписание из Mail Облака" +
                    (e.message?.let { ": $it" } ?: ""),
                e
            )
        }
    }

    fun importExcelFiles(context: Context, uris: List<Uri>): List<File> {
        if (uris.isEmpty()) {
            throw IllegalArgumentException("Excel-файл не выбран")
        }

        val temp = File(context.filesDir, TEMP_DIR)
        temp.deleteRecursively()
        temp.mkdirs()

        return try {
            uris.forEachIndexed { index, uri ->
                val originalName =
                    queryDisplayName(context, uri)
                        ?: "schedule_${index + 1}.xlsx"

                if (!isExcelFile(originalName)) {
                    throw IllegalArgumentException(
                        "Выбран не Excel-файл: $originalName"
                    )
                }

                val target = uniqueFile(temp, sanitizeFileName(originalName))
                val input = context.contentResolver.openInputStream(uri)
                    ?: throw IllegalStateException(
                        "Не удалось открыть файл: $originalName"
                    )

                input.use { source ->
                    FileOutputStream(target).use { output ->
                        source.copyTo(output)
                    }
                }

                if (target.length() <= 0) {
                    throw IllegalStateException("Файл пустой: $originalName")
                }
            }

            val files = temp.listFiles()
                ?.filter { file ->
                    file.isFile && isExcelFile(file.name) && file.length() > 0
                }
                ?.sortedBy { it.name.lowercase() }
                ?: emptyList()

            if (files.isEmpty()) {
                throw IllegalStateException("Выбранные файлы не являются Excel")
            }

            replaceCache(context, files)
        } catch (e: Exception) {
            temp.deleteRecursively()
            throw e
        }
    }

    private fun createZipLink(): String {
        val connection = openConnection(ZIP_API_URL, method = "POST")

        try {
            val body = JSONObject()
                .put("x-email", "anonym")
                .put("weblink_list", JSONArray().put(PUBLIC_CODE))
                .put("name", "schedule")
                .toString()

            connection.outputStream.use { output ->
                output.write(body.toByteArray(Charsets.UTF_8))
            }

            val responseCode = connection.responseCode
            val responseText = readConnectionText(connection)

            if (responseCode !in 200..299) {
                throw IllegalStateException(
                    "Mail API: HTTP $responseCode" + responseInfo(connection)
                )
            }

            if (responseText.isBlank()) {
                throw IllegalStateException(
                    "Mail API вернул пустой ответ" + responseInfo(connection)
                )
            }

            val json = try {
                JSONObject(responseText)
            } catch (e: Exception) {
                throw IllegalStateException(
                    "Mail API вернул не JSON" +
                        responseInfo(connection) +
                        ": " + shorten(responseText),
                    e
                )
            }

            val key = json.optString("key").trim()
            if (key.isBlank()) {
                throw IllegalStateException(
                    "Mail API не вернул ZIP-ссылку: ${shorten(responseText)}"
                )
            }

            return normalizeUrl(key)
        } finally {
            connection.disconnect()
        }
    }

    private fun normalizeUrl(key: String): String {
        val value = key
            .replace("\\/", "/")
            .replace("\\u002F", "/")
            .trim()

        return when {
            value.startsWith("https://") -> value
            value.startsWith("http://") -> value
            value.startsWith("/") -> "https://cloud.mail.ru$value"
            else -> "https://cloud.mail.ru/$value"
        }
    }

    private fun httpGetBytes(urlText: String): ByteArray {
        var currentUrl = urlText
        var redirects = 0

        while (true) {
            val connection = openConnection(currentUrl, method = "GET")

            try {
                val responseCode = connection.responseCode

                if (responseCode in 300..399) {
                    val location = connection.getHeaderField("Location")
                        ?: throw IllegalStateException(
                            "Mail ZIP: HTTP $responseCode без Location" +
                                responseInfo(connection)
                        )

                    redirects++
                    if (redirects > MAX_REDIRECTS) {
                        throw IllegalStateException(
                            "Слишком много редиректов при загрузке Mail ZIP"
                        )
                    }

                    currentUrl = URL(URL(currentUrl), location).toString()
                    continue
                }

                if (responseCode !in 200..299) {
                    val text = readConnectionText(connection)
                    throw IllegalStateException(
                        "Загрузка Mail ZIP: HTTP $responseCode" +
                            responseInfo(connection) +
                            if (text.isBlank()) "" else ": ${shorten(text)}"
                    )
                }

                val contentType = connection.contentType.orEmpty()
                val contentEncoding = connection.contentEncoding.orEmpty()
                val finalUrl = connection.url?.toString() ?: currentUrl

                val raw = connection.inputStream.use { it.readBytes() }
                if (raw.isEmpty()) {
                    throw IllegalStateException(
                        "Mail ZIP: получен пустой ответ" +
                            responseInfo(connection)
                    )
                }

                val bytes = decodeHttpBody(raw, contentEncoding)
                val zipBytes = normalizeZipBytes(bytes)

                if (zipBytes == null) {
                    throw IllegalStateException(
                        "Mail ZIP: ответ не является ZIP" +
                            " (HTTP $responseCode" +
                            ", Content-Type=$contentType" +
                            ", Content-Encoding=$contentEncoding" +
                            ", URL=$finalUrl" +
                            ", размер=${bytes.size} байт" +
                            ", первые байты=${hexPrefix(bytes)})"
                    )
                }

                return zipBytes
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
                setRequestProperty("Referer", PUBLIC_URL)
            } else {
                doOutput = true
                setRequestProperty(
                    "Content-Type",
                    "application/json; charset=UTF-8"
                )
                setRequestProperty("Accept", "application/json")
            }
        }
    }

    private fun decodeHttpBody(bytes: ByteArray, contentEncoding: String): ByteArray {
        if (!contentEncoding.equals("gzip", ignoreCase = true)) return bytes

        return try {
            GZIPInputStream(ByteArrayInputStream(bytes)).use { it.readBytes() }
        } catch (e: Exception) {
            throw IllegalStateException(
                "Mail ZIP: сервер указал gzip, но распаковать ответ не удалось",
                e
            )
        }
    }

    private fun normalizeZipBytes(bytes: ByteArray): ByteArray? {
        if (isZipSignature(bytes)) return bytes

        val limit = minOf(bytes.size - 3, 1024 * 1024)
        for (index in 1..limit) {
            if (bytes[index] == 'P'.code.toByte() &&
                bytes[index + 1] == 'K'.code.toByte() &&
                bytes[index + 2] == 3.toByte() &&
                bytes[index + 3] == 4.toByte()
            ) {
                return bytes.copyOfRange(index, bytes.size)
            }
        }

        return null
    }

    private fun isZipSignature(bytes: ByteArray): Boolean {
        if (bytes.size < 4) return false

        return bytes[0] == 'P'.code.toByte() &&
            bytes[1] == 'K'.code.toByte() &&
            (
                (bytes[2] == 3.toByte() && bytes[3] == 4.toByte()) ||
                    (bytes[2] == 5.toByte() && bytes[3] == 6.toByte()) ||
                    (bytes[2] == 7.toByte() && bytes[3] == 8.toByte())
                )
    }

    private fun unzipExcel(zipBytes: ByteArray, folder: File): List<File> {
        val result = mutableListOf<File>()
        folder.mkdirs()
        var detectedEntries = 0
        var excelEntries = 0

        try {
            ZipInputStream(zipBytes.inputStream()).use { zip ->
                var index = 0

                while (true) {
                    val entry = zip.nextEntry ?: break
                    index++

                    try {
                        if (entry.isDirectory) continue

                        detectedEntries++
                        val entryName = entry.name.orEmpty()
                        val safeName = sanitizeFileName(entryName)

                        // Не полагаемся только на имя внутри ZIP. Mail.ru может
                        // отдавать имена с нестандартной кодировкой, поэтому
                        // сначала сохраняем каждый файл во временный кандидат,
                        // а затем определяем настоящий Excel по содержимому.
                        val candidateName =
                            if (safeName.isBlank() || safeName == "schedule.xlsx") {
                                "__mail_candidate_$index.bin"
                            } else {
                                "__mail_candidate_$index"
                            }

                        val candidate = File(folder, candidateName)
                        FileOutputStream(candidate).use { output ->
                            zip.copyTo(output)
                        }

                        if (!candidate.exists() || candidate.length() <= 0) {
                            candidate.delete()
                            continue
                        }

                        val excelType = detectExcelType(candidate)
                        if (excelType == null) {
                            candidate.delete()
                            continue
                        }

                        excelEntries++

                        val extension = if (excelType == "xls") "xls" else "xlsx"
                        val originalBase =
                            safeName.substringBeforeLast('.', safeName)
                                .ifBlank { "schedule_${excelEntries}" }
                        val outputName = "$originalBase.$extension"
                        val target = uniqueFile(folder, sanitizeFileName(outputName))

                        if (!candidate.renameTo(target)) {
                            candidate.copyTo(target, overwrite = true)
                            candidate.delete()
                        }

                        if (target.exists() && target.length() > 0) {
                            result += target
                        } else {
                            target.delete()
                        }
                    } finally {
                        zip.closeEntry()
                    }
                }
            }
        } catch (e: Exception) {
            throw IllegalStateException(
                "Mail ZIP повреждён или не поддерживается: " +
                    (e.message ?: e.javaClass.simpleName),
                e
            )
        }

        if (result.isEmpty() && detectedEntries > 0) {
            throw IllegalStateException(
                "В ZIP найдено файлов: $detectedEntries, " +
                    "но среди них не распознан Excel"
            )
        }

        return result
    }

    private fun detectExcelType(file: File): String? {
        val prefix = ByteArray(8)
        val count = file.inputStream().use { input ->
            var read = 0
            while (read < prefix.size) {
                val n = input.read(prefix, read, prefix.size - read)
                if (n <= 0) break
                read += n
            }
            read
        }

        if (count >= 8 &&
            prefix[0] == 0xD0.toByte() &&
            prefix[1] == 0xCF.toByte() &&
            prefix[2] == 0x11.toByte() &&
            prefix[3] == 0xE0.toByte() &&
            prefix[4] == 0xA1.toByte() &&
            prefix[5] == 0xB1.toByte() &&
            prefix[6] == 0x1A.toByte() &&
            prefix[7] == 0xE1.toByte()
        ) {
            return "xls"
        }

        if (count < 4 ||
            prefix[0] != 'P'.code.toByte() ||
            prefix[1] != 'K'.code.toByte()
        ) {
            return null
        }

        return try {
            var hasSpreadsheetContentType = false

            ZipInputStream(file.inputStream()).use { innerZip ->
                while (true) {
                    val innerEntry = innerZip.nextEntry ?: break
                    try {
                        val name = innerEntry.name.orEmpty()
                        if (name.equals("[Content_Types].xml", ignoreCase = true)) {
                            val text = innerZip.readBytes()
                                .toString(Charsets.UTF_8)
                                .lowercase()
                            if (text.contains("spreadsheetml.sheet") ||
                                text.contains("application/vnd.ms-excel")) {
                                hasSpreadsheetContentType = true
                                break
                            }
                        }
                    } finally {
                        innerZip.closeEntry()
                    }
                }
            }

            if (hasSpreadsheetContentType) "xlsx" else null
        } catch (_: Exception) {
            null
        }
    }

    private fun replaceCache(context: Context, files: List<File>): List<File> {
        if (files.isEmpty()) {
            throw IllegalStateException("Нет Excel-файлов для сохранения")
        }

        val target = cacheDir(context)
        val old = File(context.filesDir, OLD_CACHE_DIR)
        old.deleteRecursively()

        if (target.exists()) {
            if (!target.renameTo(old)) {
                throw IllegalStateException("Не удалось подготовить старый кэш")
            }
        }

        try {
            target.mkdirs()

            files.forEach { source ->
                if (!source.exists() || !source.isFile || source.length() <= 0) {
                    throw IllegalStateException(
                        "Некорректный Excel-файл: ${source.name}"
                    )
                }

                source.copyTo(uniqueFile(target, source.name), overwrite = true)
            }

            val result = readCachedFiles(context)
            if (result.isEmpty()) {
                throw IllegalStateException("Не удалось сохранить Excel-файлы")
            }

            result.forEach { file ->
                if (!file.exists() || file.length() <= 0) {
                    throw IllegalStateException(
                        "Ошибка проверки кэша: ${file.name}"
                    )
                }
            }

            old.deleteRecursively()
            File(context.filesDir, TEMP_DIR).deleteRecursively()
            return result
        } catch (e: Exception) {
            target.deleteRecursively()

            if (old.exists()) {
                if (!old.renameTo(target)) {
                    throw IllegalStateException(
                        "Ошибка восстановления старого кэша",
                        e
                    )
                }
            }

            throw e
        }
    }

    private fun isExcelFile(name: String): Boolean {
        val lower = name.trim().lowercase()
        return lower.endsWith(".xlsx") || lower.endsWith(".xls")
    }

    private fun uniqueFile(folder: File, requestedName: String): File {
        val safeRequestedName =
            if (requestedName.isBlank()) "schedule.xlsx" else requestedName

        val dot = safeRequestedName.lastIndexOf('.')
        val base = if (dot > 0) safeRequestedName.substring(0, dot) else safeRequestedName
        val extension =
            if (dot > 0 && dot < safeRequestedName.length - 1) {
                safeRequestedName.substring(dot + 1)
            } else {
                ""
            }

        var file = File(folder, safeRequestedName)
        var counter = 2

        while (file.exists()) {
            val newName = if (extension.isBlank()) {
                "$base ($counter)"
            } else {
                "$base ($counter).$extension"
            }

            file = File(folder, newName)
            counter++
        }

        return file
    }

    private fun sanitizeFileName(name: String): String {
        val cleaned = name
            .substringAfterLast('/')
            .substringAfterLast('\\')
            .replace(Regex("[\\\\/:*?\"<>|]"), "_")
            .trim()

        return if (cleaned.isBlank()) "schedule.xlsx" else cleaned
    }

    private fun queryDisplayName(context: Context, uri: Uri): String? {
        val projection = arrayOf(android.provider.OpenableColumns.DISPLAY_NAME)

        return context.contentResolver.query(
            uri,
            projection,
            null,
            null,
            null
        )?.use { cursor ->
            if (!cursor.moveToFirst()) return@use null

            val index = cursor.getColumnIndex(
                android.provider.OpenableColumns.DISPLAY_NAME
            )

            if (index >= 0) cursor.getString(index) else null
        }
    }

    private fun readConnectionText(connection: HttpURLConnection): String {
        val stream = if (connection.responseCode >= 400) {
            connection.errorStream
        } else {
            connection.inputStream
        }

        if (stream == null) return ""
        return stream.bufferedReader(Charsets.UTF_8).use { it.readText() }
    }

    private fun responseInfo(connection: HttpURLConnection): String {
        return " (Content-Type=${connection.contentType.orEmpty()}" +
            ", Content-Encoding=${connection.contentEncoding.orEmpty()}" +
            ", URL=${connection.url?.toString().orEmpty()})"
    }

    private fun hexPrefix(bytes: ByteArray, max: Int = 16): String {
        return bytes.take(max).joinToString(" ") { byte ->
            "%02X".format(byte.toInt() and 0xFF)
        }
    }

    private fun shorten(text: String, max: Int = 300): String {
        return text
            .replace("\n", " ")
            .replace("\r", " ")
            .trim()
            .let { if (it.length <= max) it else it.take(max) + "..." }
    }
}
