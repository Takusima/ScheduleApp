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

    private const val ZIP_API_URL =
        "https://cloud.mail.ru/api/v3/zip/weblink"

    private const val CACHE_DIR =
        "schedule_cache"

    private const val TEMP_DIR =
        "schedule_cache_tmp"

    private const val OLD_CACHE_DIR =
        "schedule_cache_old"

    private const val USER_AGENT =
        "ScheduleApp/1.0"

    /**
     * Папка локального кэша расписания.
     */
    fun cacheDir(
        context: Context
    ): File {
        return File(
            context.filesDir,
            CACHE_DIR
        )
    }

    /**
     * Возвращает сохранённые Excel-файлы.
     *
     * Только XLS и XLSX.
     * PPTX и другие файлы игнорируются.
     */
    fun readCachedFiles(
        context: Context
    ): List<File> {

        return cacheDir(context)
            .listFiles()
            ?.filter { file ->
                file.isFile &&
                        isExcelFile(file.name)
            }
            ?.sortedBy {
                it.name.lowercase()
            }
            ?: emptyList()
    }

    /**
     * Основная синхронизация с Mail Облаком.
     *
     * Mail.ru:
     *
     * public code
     *      ↓
     * /api/v3/zip/weblink
     *      ↓
     * временная ZIP-ссылка
     *      ↓
     * ZIP
     *      ↓
     * только XLS/XLSX
     *      ↓
     * локальный кэш
     *
     * Старый кэш не удаляется до тех пор,
     * пока новые файлы полностью не будут подготовлены.
     */
    fun downloadFromCloud(
        context: Context
    ): List<File> {

        val temp =
            File(
                context.filesDir,
                TEMP_DIR
            )

        temp.deleteRecursively()
        temp.mkdirs()

        return try {

            /*
             * 1. Получаем новую временную ZIP-ссылку.
             */
            val zipUrl =
                createZipLink()

            /*
             * 2. Скачиваем архив.
             */
            val zipBytes =
                httpGetBytes(
                    zipUrl
                )

            if (zipBytes.isEmpty()) {
                throw IllegalStateException(
                    "Mail Облако вернуло пустой архив"
                )
            }

            /*
             * 3. Извлекаем только Excel.
             */
            val extracted =
                unzipExcel(
                    zipBytes,
                    temp
                )

            if (extracted.isEmpty()) {
                throw IllegalStateException(
                    "В архиве Mail Облака не найдено Excel-файлов"
                )
            }

            /*
             * 4. Проверяем каждый файл.
             */
            extracted.forEach { file ->

                if (
                    !file.exists() ||
                    !file.isFile ||
                    file.length() <= 0
                ) {
                    throw IllegalStateException(
                        "Повреждённый Excel-файл: ${file.name}"
                    )
                }
            }

            /*
             * 5. Только теперь заменяем кэш.
             */
            replaceCache(
                context,
                extracted
            )

        } catch (e: Exception) {

            /*
             * Старый кэш не трогаем.
             */
            temp.deleteRecursively()

            throw IllegalStateException(
                "Не удалось обновить расписание из Mail Облака" +
                        (
                                e.message?.let {
                                    ": $it"
                                } ?: ""
                                ),
                e
            )
        }
    }

    /**
     * Импорт Excel-файлов через системный выбор файлов.
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
            )

        temp.deleteRecursively()
        temp.mkdirs()

        return try {

            uris.forEachIndexed { index, uri ->

                val originalName =
                    queryDisplayName(
                        context,
                        uri
                    )
                        ?: "schedule_${index + 1}.xlsx"

                if (!isExcelFile(originalName)) {
                    throw IllegalArgumentException(
                        "Выбран не Excel-файл: $originalName"
                    )
                }

                val safeName =
                    sanitizeFileName(
                        originalName
                    )

                val target =
                    uniqueFile(
                        temp,
                        safeName
                    )

                val input =
                    context.contentResolver
                        .openInputStream(uri)

                if (input == null) {
                    throw IllegalStateException(
                        "Не удалось открыть файл: $originalName"
                    )
                }

                input.use { source ->

                    FileOutputStream(
                        target
                    ).use { output ->

                        source.copyTo(
                            output
                        )
                    }
                }

                if (target.length() <= 0) {
                    throw IllegalStateException(
                        "Файл пустой: $originalName"
                    )
                }
            }

            val files =
                temp.listFiles()
                    ?.filter { file ->
                        file.isFile &&
                                isExcelFile(file.name) &&
                                file.length() > 0
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

            replaceCache(
                context,
                files
            )

        } catch (e: Exception) {

            temp.deleteRecursively()

            throw e
        }
    }

    /**
     * Получает временную ZIP-ссылку Mail Облака.
     *
     * Проверенный запрос:
     *
     * POST
     * https://cloud.mail.ru/api/v3/zip/weblink
     */
    private fun createZipLink(): String {

        val connection =
            (
                    URL(
                        ZIP_API_URL
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
                    USER_AGENT
                )
            }

        try {

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

            connection.outputStream.use { output ->

                output.write(
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
                    "Mail Облако: HTTP $responseCode"
                )
            }

            if (responseText.isBlank()) {

                throw IllegalStateException(
                    "Mail Облако вернуло пустой ответ"
                )
            }

            val json =
                JSONObject(
                    responseText
                )

            val key =
                json.optString(
                    "key"
                ).trim()

            if (key.isBlank()) {

                throw IllegalStateException(
                    "Mail Облако не вернуло ZIP-ссылку"
                )
            }

            return normalizeUrl(
                key
            )

        } finally {

            connection.disconnect()
        }
    }

    /**
     * Нормализует URL, полученный от Mail Облака.
     */
    private fun normalizeUrl(
        key: String
    ): String {

        val value =
            key
                .replace(
                    "\\/",
                    "/"
                )
                .replace(
                    "\\u002F",
                    "/"
                )
                .trim()

        return when {

            value.startsWith(
                "https://"
            ) -> value

            value.startsWith(
                "http://"
            ) -> value

            value.startsWith(
                "/"
            ) ->
                "https://cloud.mail.ru$value"

            else ->
                "https://cloud.mail.ru/$value"
        }
    }

    /**
     * Скачивает байты по URL.
     */
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
                    USER_AGENT
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

        try {

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

        } finally {

            connection.disconnect()
        }
    }

    /**
     * Распаковывает ZIP и сохраняет только:
     *
     * .xlsx
     * .xls
     *
     * PPTX полностью игнорируется.
     */
    private fun unzipExcel(
        zipBytes: ByteArray,
        folder: File
    ): List<File> {

        val result =
            mutableListOf<File>()

        folder.mkdirs()

        ZipInputStream(
            zipBytes.inputStream()
        ).use { zip ->

            while (true) {

                val entry =
                    zip.nextEntry
                        ?: break

                try {

                    if (!entry.isDirectory) {

                        val entryName =
                            entry.name

                        val lower =
                            entryName.lowercase()

                        if (
                            lower.endsWith(
                                ".xlsx"
                            ) ||
                            lower.endsWith(
                                ".xls"
                            )
                        ) {

                            val originalName =
                                entryName
                                    .substringAfterLast(
                                        '/'
                                    )

                            if (
                                originalName.isBlank()
                            ) {
                                continue
                            }

                            val safeName =
                                sanitizeFileName(
                                    originalName
                                )

                            val target =
                                uniqueFile(
                                    folder,
                                    safeName
                                )

                            FileOutputStream(
                                target
                            ).use { output ->

                                zip.copyTo(
                                    output
                                )
                            }

                            if (
                                target.exists() &&
                                target.length() > 0
                            ) {
                                result += target
                            } else {
                                target.delete()
                            }
                        }
                    }

                } finally {

                    zip.closeEntry()
                }
            }
        }

        return result
    }

    /**
     * Безопасно заменяет старый кэш новым.
     *
     * Важный момент:
     *
     * если новая загрузка сломалась,
     * старый кэш восстанавливается.
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
                OLD_CACHE_DIR
            )

        /*
         * На всякий случай удаляем
         * старую временную копию.
         */
        old.deleteRecursively()

        /*
         * Переименовываем текущий кэш.
         *
         * Если кэша ещё нет — это нормально.
         */
        if (target.exists()) {

            if (
                !target.renameTo(old)
            ) {

                throw IllegalStateException(
                    "Не удалось подготовить старый кэш"
                )
            }
        }

        try {

            target.mkdirs()

            files.forEach { source ->

                if (
                    !source.exists() ||
                    !source.isFile ||
                    source.length() <= 0
                ) {

                    throw IllegalStateException(
                        "Некорректный Excel-файл: ${source.name}"
                    )
                }

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
                    "Не удалось сохранить Excel-файлы"
                )
            }

            /*
             * Проверяем, что все новые файлы
             * действительно находятся в кэше.
             */
            result.forEach { file ->

                if (
                    !file.exists() ||
                    file.length() <= 0
                ) {

                    throw IllegalStateException(
                        "Ошибка проверки кэша: ${file.name}"
                    )
                }
            }

            /*
             * Новый кэш успешно создан.
             * Старый теперь больше не нужен.
             */
            old.deleteRecursively()

            File(
                context.filesDir,
                TEMP_DIR
            ).deleteRecursively()

            return result

        } catch (e: Exception) {

            /*
             * Удаляем частично созданный новый кэш.
             */
            target.deleteRecursively()

            /*
             * Возвращаем старый кэш.
             */
            if (old.exists()) {

                if (
                    !old.renameTo(target)
                ) {

                    throw IllegalStateException(
                        "Ошибка восстановления старого кэша",
                        e
                    )
                }
            }

            throw e
        }
    }

    /**
     * Проверяет расширение Excel.
     */
    private fun isExcelFile(
        name: String
    ): Boolean {

        val lower =
            name
                .trim()
                .lowercase()

        return lower.endsWith(
            ".xlsx"
        ) ||
                lower.endsWith(
                    ".xls"
                )
    }

    /**
     * Создаёт уникальное имя файла.
     *
     * Например:
     *
     * schedule.xlsx
     * schedule (2).xlsx
     * schedule (3).xlsx
     */
    private fun uniqueFile(
        folder: File,
        requestedName: String
    ): File {

        val safeRequestedName =
            if (
                requestedName.isBlank()
            ) {
                "schedule.xlsx"
            } else {
                requestedName
            }

        val dot =
            safeRequestedName
                .lastIndexOf('.')

        val base =
            if (
                dot > 0
            ) {
                safeRequestedName
                    .substring(
                        0,
                        dot
                    )
            } else {
                safeRequestedName
            }

        val extension =
            if (
                dot > 0 &&
                dot < safeRequestedName.length - 1
            ) {
                safeRequestedName
                    .substring(
                        dot + 1
                    )
            } else {
                ""
            }

        var file =
            File(
                folder,
                safeRequestedName
            )

        var counter =
            2

        while (file.exists()) {

            val newName =
                if (
                    extension.isBlank()
                ) {
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

    /**
     * Очищает имя файла от запрещённых символов.
     */
    private fun sanitizeFileName(
        name: String
    ): String {

        val cleaned =
            name
                .substringAfterLast('/')
                .replace(
                    Regex(
                        "[\\\\/:*?\"<>|]"
                    ),
                    "_"
                )
                .trim()

        return if (
            cleaned.isBlank()
        ) {
            "schedule.xlsx"
        } else {
            cleaned
        }
    }

    /**
     * Получает оригинальное имя файла
     * из Android Storage Access Framework.
     */
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

            if (
                !cursor.moveToFirst()
            ) {
                return@use null
            }

            val index =
                cursor.getColumnIndex(
                    android.provider.OpenableColumns.DISPLAY_NAME
                )

            if (
                index >= 0
            ) {
                cursor.getString(
                    index
                )
            } else {
                null
            }
        }
    }

    /**
     * Читает текстовый ответ HTTP.
     */
    private fun readConnectionText(
        connection: HttpURLConnection
    ): String {

        val stream =
            if (
                connection.responseCode >= 400
            ) {
                connection.errorStream
            } else {
                connection.inputStream
            }

        if (stream == null) {
            return ""
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
