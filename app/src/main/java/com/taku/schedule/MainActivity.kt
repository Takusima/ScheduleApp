package com.taku.schedule

import android.annotation.SuppressLint
import android.content.Intent
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.Calendar
import java.util.zip.ZipInputStream
import kotlin.concurrent.thread

class MainActivity : AppCompatActivity() {

    private lateinit var web: WebView
    private val publicCode = "vH1B/7LrFtqWqP"

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        ScheduleSync.scheduleNextSunday(this)

        web = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = true
            settings.allowContentAccess = true
            webChromeClient = WebChromeClient()
            webViewClient = WebViewClient()
            addJavascriptInterface(Bridge(), "Android")
            loadUrl("file:///android_asset/index.html")
        }

        setContentView(web)
    }

    inner class Bridge {

        @JavascriptInterface
        fun sync() {
            thread {
                try {
                    if (!isOnline()) {
                        sendCached("Нет интернета. Использую сохранённое расписание.")
                        return@thread
                    }

                    val files = downloadScheduleToCache()
                    sendFiles(files, "Расписание обновлено")

                } catch (e: Exception) {
                    val cached = readCachedFiles()
                    if (cached.isNotEmpty()) {
                        sendFiles(cached, "Нет связи. Использую сохранённую копию.")
                    } else {
                        sendError(e.message ?: "Ошибка обновления")
                    }
                }
            }
        }

        @JavascriptInterface
        fun loadCached() {
            thread {
                try {
                    val files = readCachedFiles()
                    if (files.isEmpty()) {
                        sendError("Сохранённого расписания пока нет. Нажмите «Обновить» при наличии интернета.")
                    } else {
                        sendFiles(files, "Офлайн-копия расписания")
                    }
                } catch (e: Exception) {
                    sendError(e.message ?: "Не удалось открыть сохранённое расписание")
                }
            }
        }

        @JavascriptInterface
        fun openSource() {
            runOnUiThread {
                startActivity(
                    Intent(
                        Intent.ACTION_VIEW,
                        Uri.parse("https://cloud.mail.ru/public/$publicCode")
                    )
                )
            }
        }
    }

    private fun sendCached(message: String) {
        val files = readCachedFiles()
        if (files.isEmpty()) {
            sendError(message)
        } else {
            sendFiles(files, message)
        }
    }

    private fun sendFiles(files: List<File>, status: String) {
        val result = JSONArray()

        files.forEach { file ->
            val item = JSONObject()
            item.put("name", file.name)
            item.put(
                "data",
                android.util.Base64.encodeToString(
                    file.readBytes(),
                    android.util.Base64.NO_WRAP
                )
            )
            result.put(item)
        }

        runOnUiThread {
            web.evaluateJavascript(
                "window.onNativeFiles(${JSONObject.quote(result.toString())}, ${JSONObject.quote(status)});",
                null
            )
        }
    }

    private fun sendError(message: String) {
        runOnUiThread {
            web.evaluateJavascript(
                "window.onNativeError(${JSONObject.quote(message)});",
                null
            )
        }
    }

    private fun cacheDir(): File = File(filesDir, "schedule_cache")

    private fun downloadScheduleToCache(): List<File> {
        val zipUrl = createZipLink(publicCode)
        val zipBytes = httpGet(zipUrl)

        val tempDir = File(filesDir, "schedule_cache_tmp").apply {
            deleteRecursively()
            mkdirs()
        }

        val downloaded = unzipXlsx(zipBytes, tempDir)
        if (downloaded.isEmpty()) {
            tempDir.deleteRecursively()
            error("В архиве Mail Облака нет Excel-файлов")
        }

        val target = cacheDir()
        target.deleteRecursively()
        if (!tempDir.renameTo(target)) {
            target.mkdirs()
            downloaded.forEach { file ->
                file.copyTo(File(target, file.name), overwrite = true)
            }
            tempDir.deleteRecursively()
        }

        return readCachedFiles()
    }

    private fun readCachedFiles(): List<File> =
        cacheDir().listFiles()
            ?.filter { it.isFile && it.extension.equals("xlsx", true) }
            ?.sortedBy { it.name.lowercase() }
            ?: emptyList()

    private fun isOnline(): Boolean {
        val cm = getSystemService(ConnectivityManager::class.java) ?: return false
        val network = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(network) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }

    private fun createZipLink(code: String): String {
        val url = URL("https://cloud.mail.ru/api/v3/zip/weblink")
        val conn = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 20000
            readTimeout = 30000
            doOutput = true
            setRequestProperty("Content-Type", "application/json;charset=UTF-8")
            setRequestProperty("Accept", "application/json")
            setRequestProperty("User-Agent", "ScheduleApp/1.0")
        }

        val body = "{\"x-email\":\"anonym\",\"weblink_list\":[\"$code\"],\"name\":\"schedule\"}"
        conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }

        val text = readText(conn)
        if (conn.responseCode !in 200..299) error("Mail Облако: HTTP ${conn.responseCode}")

        val key = JSONObject(text).optString("key")
        if (key.isBlank()) error("Mail Облако не вернул ссылку на архив")
        return if (key.startsWith("http")) key else "https://cloud.mail.ru$key"
    }

    private fun httpGet(urlText: String): ByteArray {
        val conn = (URL(urlText).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 20000
            readTimeout = 60000
            setRequestProperty("User-Agent", "ScheduleApp/1.0")
            setRequestProperty("Referer", "https://cloud.mail.ru/public/$publicCode")
        }
        if (conn.responseCode !in 200..399) error("Загрузка расписания: HTTP ${conn.responseCode}")
        return conn.inputStream.use { it.readBytes() }
    }

    private fun readText(conn: HttpURLConnection): String {
        val stream = if (conn.responseCode >= 400) conn.errorStream else conn.inputStream
        return stream.bufferedReader(Charsets.UTF_8).use { it.readText() }
    }

    private fun unzipXlsx(zipBytes: ByteArray, folder: File): List<File> {
        val out = mutableListOf<File>()
        ZipInputStream(zipBytes.inputStream()).use { zis ->
            while (true) {
                val entry = zis.nextEntry ?: break
                if (!entry.isDirectory && entry.name.lowercase().endsWith(".xlsx")) {
                    val safeName = entry.name.substringAfterLast('/')
                        .replace(Regex("[^\\p{L}\\p{N}._ -]"), "_")
                    val file = File(folder, safeName)
                    FileOutputStream(file).use { fos -> zis.copyTo(fos) }
                    out += file
                }
                zis.closeEntry()
            }
        }
        return out
    }
}
