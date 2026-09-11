package com.taku.schedule

import android.content.Context
import android.net.Uri
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.zip.ZipInputStream

object ScheduleRepository {

    const val PUBLIC_CODE = "vH1B/7LrFtqWqP"
    const val PUBLIC_URL =
        "https://cloud.mail.ru/public/$PUBLIC_CODE"

    private const val CACHE_DIR = "schedule_cache"
    private const val TEMP_DIR = "schedule_cache_tmp"

    fun cacheDir(context: Context): File {
        return File(
            context.filesDir,
            CACHE_DIR
        )
    }

    fun readCachedFiles(context: Context): List<File> {
        return cacheDir(context)
            .listFiles()
            ?.filter {
                it.isFile &&
                        (
                                it.extension.equals("xlsx", true) ||
                                        it.extension.equals("xls", true)
                                )
            }
            ?.sortedBy {
                it.name.lowercase()
            }
            ?: emptyList()
    }

    /**
     * Загружает Excel-файлы из публичной папки Mail Облака.
     *
     * Сначала используется ZIP endpoint.
     * Если он недоступен — пробуем получить прямую
     * ссылку со страницы публичной папки.
     *
     * Старый кэш заменяется только после успешного
     * получения хотя бы одного Excel-файла.
     */
    fun downloadFromCloud(
        context: Context
    ): List<File> {

        var lastError: Exception? = null

        /*
         * Вариант 1.
         * Получаем ZIP публичной ссылки.
         */
        try {

            val zipUrl =
                createZipLink()

            val zipBytes =
                httpGetBytes(zipUrl)

            val files =
                extractExcelToTemp(
                    context,
                    zipBytes
                )

            if (files.isNotEmpty()) {
                return replaceCache(
                    context,
                    files
                )
            }

        } catch (e: Exception) {

            lastError = e
        }

        /*
         * Вариант 2.
         * Пробуем найти прямую ссылку на содержимое
         * публичной папки.
         */
        try {

            val directUrl =
                findDirectPublicUrl()

            val bytes =
                httpGetBytes(directUrl)

            val temp =
                File(
                    context.filesDir,
                    TEMP_DIR
                ).apply {
                    deleteRecursively()
                    mkdirs()
                }

            val extracted =
                extractExcelOrZip(
                    temp,
                    bytes
                )

            if (extracted.isNotEmpty()) {

                return replaceCache(
                    context,
                    extracted
                )
            }

            /*
             * Иногда ссылка возвращает непосредственно
             * XLSX-файл.
             */
            if (looksLikeXlsx(bytes)) {

                val file =
                    File(
                        temp,
                        "schedule.xlsx"
                    )

                file.writeBytes(bytes)

                return replaceCache(
                    context,
                    listOf(file)
                )
            }

            temp.deleteRecursively()

            throw IllegalStateException(
                "Mail Облако не вернул Excel-файл"
            )

        } catch (e: Exception) {

            lastError = e
        }

        throw IllegalStateException(
            "Не удалось скачать расписание из Mail Облака" +
                    (
                            lastError?.message?.let {
                                ": $it"
                            } ?: ""
                            )
        )
    }

    /**
     * Копирует выбранные пользователем Excel-файлы
     * в локальный кэш приложения.
     */
    fun importExcelFiles(
        context: Context,
        uris: List<Uri>
    ): List<File> {

        if (uris.isEmpty()) {

            throw IllegalArgumentException(
                "Excel-файл не выбран"
            )
        }

        val temp =
            File(
                context.filesDir,
                TEMP_DIR
            ).apply {
                deleteRecursively()
                mkdirs()
            }

        try {

            uris.forEachIndexed { index, uri ->

                val originalName =
                    queryDisplayName(
                        context,
                        uri
                    )
                        ?: "schedule_${index + 1}.xlsx"

                val safeName =
                    sanitizeFileName(
                        originalName
                    )

                val targetName =
                    if (
                        safeName.endsWith(
                            ".xlsx",
                            true
                        ) ||
                        safeName.endsWith(
                            ".xls",
                            true
                        )
                    ) {
                        safeName
                    } else {
                        "$safeName.xlsx"
                    }

                val target =
                    uniqueFile(
                        temp,
                        targetName
                    )

                context.contentResolver
                    .openInputStream(uri)
                    .use { input ->

                        if (input == null) {

                            throw IllegalStateException(
                                "Не удалось открыть файл: $originalName"
                            )
                        }

                        FileOutputStream(
                            target
                        ).use { output ->

                            input.copyTo(
                                output
                            )
                        }
                    }
            }

            val files =
                temp.listFiles()
                    ?.filter {
                        it.isFile &&
                                (
                                        it.extension.equals(
                                            "xlsx",
                                            true
                                        ) ||
                                                it.extension.equals(
                                                    "xls",
                                                    true
                                                )
                                        )
                    }
                    ?.sortedBy {
                        it.name.lowercase()
                    }
                    ?: emptyList()

            if (files.isEmpty()) {

                throw IllegalStateException(
                    "Выбранные файлы не являются Excel"
                )
            }

            return replaceCache(
                context,
                files
            )

        } catch (e: Exception) {

            temp.deleteRecursively()

            throw e
        }
    }

    /**
     * Создаёт ZIP-ссылку для публичной папки Mail Облака.
     */
    private fun createZipLink(): String {

        val connection =
            (
                    URL(
                        "https://cloud.mail.ru/api/v3/zip/weblink"
                    ).openConnection()
                            as HttpURLConnection
                    ).apply {

                requestMethod = "POST"

                connectTimeout = 20_000
                readTimeout = 30_000

                doOutput = true

                setRequestProperty(
                    "Content-Type",
                    "application/json; charset=UTF-8"
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
            JSONObject()
                .put(
                    "x-email",
                    "anonym"
                )
                .put(
                    "weblink_list",
                    JSONArray().put(
                        PUBLIC_CODE
                    )
                )
                .put(
                    "name",
                    "schedule"
                )
                .toString()

        connection.outputStream.use {
            it.write(
                body.toByteArray(
                    Charsets.UTF_8
                )
            )
        }

        val responseCode =
            connection.responseCode

        val responseText =
            readConnectionText(
                connection
            )

        if (responseCode !in 200..299) {

            throw IllegalStateException(
                "Mail Cloud HTTP $responseCode"
            )
        }

        val json =
            JSONObject(
                responseText
            )

        val key =
            json.optString(
                "key"
            )

        if (key.isBlank()) {

            throw IllegalStateException(
                "Mail Облако не вернуло ссылку на ZIP"
            )
        }

        return when {

            key.startsWith(
                "http://"
            ) -> key

            key.startsWith(
                "https://"
            ) -> key

            key.startsWith(
                "/"
            ) ->
                "https://cloud.mail.ru$key"

            else ->
                "https://cloud.mail.ru/$key"
        }
    }

    /**
     * Получает публичную страницу Mail Облака
     * и пытается найти URL weblink_get.
     */
    private fun findDirectPublicUrl(): String {

        val connection =
            (
                    URL(
                        PUBLIC_URL
                    ).openConnection()
                            as HttpURLConnection
                    ).apply {

                requestMethod = "GET"

                connectTimeout = 20_000
                readTimeout = 30_000

                setRequestProperty(
                    "User-Agent",
                    "Mozilla/5.0 ScheduleApp/1.0"
                )

                setRequestProperty(
                    "Accept",
                    "text/html,application/xhtml+xml"
                )
            }

        val responseCode =
            connection.responseCode

        if (responseCode !in 200..399) {

            throw IllegalStateException(
                "Mail Cloud HTTP $responseCode"
            )
        }

        val html =
            readConnectionText(
                connection
            )

        val patterns =
            listOf(

                Regex(
                    "\"weblink_get\".*?\"url\"\\s*:\\s*\"([^\"]+)\"",
                    RegexOption.DOT_MATCHES_ALL
                ),

                Regex(
                    "weblink_get.*?url\\\\?\"\\s*:\\s*\\\\?\"([^\"]+)",
                    RegexOption.DOT_MATCHES_ALL
                ),

                Regex(
                    "\"url\"\\s*:\\s*\"(https://[^\"]+)\".*?weblink_get",
                    RegexOption.DOT_MATCHES_ALL
                )
            )

        var baseUrl: String? = null

        for (pattern in patterns) {

            val match =
                pattern.find(
                    html
                )

            if (match != null) {

                baseUrl =
                    match.groupValues[1]
                        .replace(
                            "\\/",
                            "/"
                        )
                        .replace(
                            "\\u002F",
                            "/"
                        )

                break
            }
        }

        if (baseUrl.isNullOrBlank()) {

            throw IllegalStateException(
                "В публичной странице Mail Облака не найден weblink_get"
            )
        }

        val parts =
            PUBLIC_CODE.split(
                "/",
                limit = 2
            )

        if (parts.size != 2) {

            throw IllegalStateException(
                "Неверный код публичной ссылки"
            )
        }

        var result =
            baseUrl!!.trimEnd('/')

        /*
         * Если URL ещё не содержит публичный код,
         * добавляем его.
         */
        if (
            !result.endsWith(
                "/${parts[0]}/${parts[1]}"
            )
        ) {

            result +=
                "/${parts[0]}/${parts[1]}"
        }

        return result
    }

    private fun httpGetBytes(
        urlText: String
    ): ByteArray {

        val connection =
            (
                    URL(
                        urlText
                    ).openConnection()
                            as HttpURLConnection
                    ).apply {

                requestMethod = "GET"

                connectTimeout = 20_000
                readTimeout = 120_000

                instanceFollowRedirects = true

                setRequestProperty(
                    "User-Agent",
                    "Mozilla/5.0 ScheduleApp/1.0"
                )

                setRequestProperty(
                    "Referer",
                    PUBLIC_URL
                )

                setRequestProperty(
                    "Accept",
                    "*/*"
                )
            }

        val responseCode =
            connection.responseCode

        if (responseCode !in 200..399) {

            throw IllegalStateException(
                "Загрузка Mail Облака: HTTP $responseCode"
            )
        }

        return connection.inputStream.use {
            it.readBytes()
        }
    }

    private fun extractExcelToTemp(
        context: Context,
        zipBytes: ByteArray
    ): List<File> {

        val temp =
            File(
                context.filesDir,
                TEMP_DIR
            ).apply {
                deleteRecursively()
                mkdirs()
            }

        return try {

            val files =
                unzipExcel(
                    zipBytes,
                    temp
                )

            if (files.isEmpty()) {

                temp.deleteRecursively()

                throw IllegalStateException(
                    "В ZIP Mail Облака нет Excel-файлов"
                )
            }

            files

        } catch (e: Exception) {

            temp.deleteRecursively()

            throw e
        }
    }

    private fun extractExcelOrZip(
        folder: File,
        bytes: ByteArray
    ): List<File> {

        /*
         * XLSX сам является ZIP-контейнером.
         * Поэтому сначала пробуем распаковать bytes
         * как ZIP с Excel-файлами.
         */
        return try {

            unzipExcel(
                bytes,
                folder
            )

        } catch (_: Exception) {

            if (looksLikeXlsx(bytes)) {

                val file =
                    File(
                        folder,
                        "schedule.xlsx"
                    )

                file.writeBytes(
                    bytes
                )

                listOf(file)

            } else {

                emptyList()
            }
        }
    }

    private fun unzipExcel(
        zipBytes: ByteArray,
        folder: File
    ): List<File> {

        val result =
            mutableListOf<File>()

        ZipInputStream(
            zipBytes.inputStream()
        ).use { zip ->

            while (true) {

                val entry =
                    zip.nextEntry
                        ?: break

                if (!entry.isDirectory) {

                    val lower =
                        entry.name.lowercase()

                    if (
                        lower.endsWith(".xlsx") ||
                        lower.endsWith(".xls")
                    ) {

                        val original =
                            entry.name.substringAfterLast(
                                '/'
                            )

                        val safeName =
                            sanitizeFileName(
                                original
                            )

                        val target =
                            uniqueFile(
                                folder,
                                safeName
                            )

                        FileOutputStream(
                            target
                        ).use {
                            zip.copyTo(it)
                        }

                        result += target
                    }
                }

                zip.closeEntry()
            }
        }

        return result
    }

    /**
     * Безопасно заменяет кэш.
     *
     * Старые файлы удаляются только после того,
     * как новые Excel успешно скопированы.
     */
    private fun replaceCache(
        context: Context,
        files: List<File>
    ): List<File> {

        if (files.isEmpty()) {

            throw IllegalStateException(
                "Нет Excel-файлов для сохранения"
            )
        }

        val target =
            cacheDir(
                context
            )

        val old =
            File(
                context.filesDir,
                "${CACHE_DIR}_old"
            )

        old.deleteRecursively()

        if (target.exists()) {

            if (!target.renameTo(old)) {

                throw IllegalStateException(
                    "Не удалось подготовить старый кэш"
                )
            }
        }

        try {

            target.mkdirs()

            files.forEach { source ->

                val destination =
                    uniqueFile(
                        target,
                        source.name
                    )

                source.copyTo(
                    destination,
                    overwrite = true
                )
            }

            val result =
                readCachedFiles(
                    context
                )

            if (result.isEmpty()) {

                throw IllegalStateException(
                    "Не удалось сохранить Excel"
                )
            }

            old.deleteRecursively()

            File(
                context.filesDir,
                TEMP_DIR
            ).deleteRecursively()

            return result

        } catch (e: Exception) {

            target.deleteRecursively()

            if (old.exists()) {
                old.renameTo(target)
            }

            throw e
        }
    }

    private fun uniqueFile(
        folder: File,
        requestedName: String
    ): File {

        val base =
            requestedName.substringBeforeLast(
                '.',
                requestedName
            )

        val extension =
            requestedName.substringAfterLast(
                '.',
                ""
            )

        var file =
            File(
                folder,
                requestedName
            )

        var counter = 2

        while (file.exists()) {

            val newName =
                if (extension.isBlank()) {

                    "$base ($counter)"

                } else {

                    "$base ($counter).$extension"
                }

            file =
                File(
                    folder,
                    newName
                )

            counter++
        }

        return file
    }

    private fun sanitizeFileName(
        name: String
    ): String {

        val cleaned =
            name
                .substringAfterLast('/')
                .replace(
                    Regex("[\\\\/:*?\"<>|]"),
                    "_"
                )
                .trim()

        return if (cleaned.isBlank()) {
            "schedule.xlsx"
        } else {
            cleaned
        }
    }

    private fun queryDisplayName(
        context: Context,
        uri: Uri
    ): String? {

        val projection =
            arrayOf(
                android.provider.OpenableColumns.DISPLAY_NAME
            )

        return context.contentResolver.query(
            uri,
            projection,
            null,
            null,
            null
        )?.use { cursor ->

            if (!cursor.moveToFirst()) {
                return@use null
            }

            val index =
                cursor.getColumnIndex(
                    android.provider.OpenableColumns.DISPLAY_NAME
                )

            if (index >= 0) {
                cursor.getString(index)
            } else {
                null
            }
        }
    }

    private fun looksLikeXlsx(
        bytes: ByteArray
    ): Boolean {

        /*
         * XLSX — ZIP-контейнер.
         * Сигнатура ZIP начинается с PK.
         */
        return bytes.size >= 4 &&
                bytes[0] == 0x50.toByte() &&
                bytes[1] == 0x4B.toByte()
    }

    private fun readConnectionText(
        connection: HttpURLConnection
    ): String {

        val stream =
            if (connection.responseCode >= 400) {
                connection.errorStream
            } else {
                connection.inputStream
            }

        return stream
            .bufferedReader(
                Charsets.UTF_8
            )
            .use {
                it.readText()
            }
    }
}
