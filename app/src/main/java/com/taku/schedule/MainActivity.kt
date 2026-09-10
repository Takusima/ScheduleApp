 package com.taku.schedule

import android.annotation.SuppressLint
import android.content.Intent
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
import java.util.zip.ZipInputStream
import kotlin.concurrent.thread

class MainActivity : AppCompatActivity() {

    private lateinit var web: WebView

    private val publicCode = "vH1B/7LrFtqWqP"

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

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
                    val zipUrl = createZipLink(publicCode)
                    val zipBytes = httpGet(zipUrl)

                    val folder = File(cacheDir, "schedule_cache").apply {
                        mkdirs()
                    }

                    val files = unzipXlsx(zipBytes, folder)
                    val result = JSONArray()

                    files.forEach { file ->
                        val bytes = file.readBytes()

                        val item = JSONObject()
                        item.put("name", file.name)
                        item.put(
                            "data",
                            android.util.Base64.encodeToString(
                                bytes,
                                android.util.Base64.NO_WRAP
                            )
                        )

                        result.put(item)
                    }

                    runOnUiThread {
                        web.evaluateJavascript(
                            "window.onNativeFiles(${JSONObject.quote(result.toString())});",
                            null
                        )
                    }

                } catch (e: Exception) {
                    runOnUiThread {
                        web.evaluateJavascript(
                            "window.onNativeError(${JSONObject.quote(e.message ?: "Ошибка обновления")});",
                            null
                        )
                    }
                }
            }
        }

        @JavascriptInterface
        fun openSource() {
            runOnUiThread {
                val intent = Intent(
                    Intent.ACTION_VIEW,
                    Uri.parse("https://cloud.mail.ru/public/$publicCode")
                )

                startActivity(intent)
            }
        }
    }

    private fun createZipLink(code: String): String {
        val url = URL("https://cloud.mail.ru/api/v3/zip/weblink")

        val conn = (url.openConnection() as HttpURLConnection).apply {
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
            "{\"x-email\":\"anonym\",\"weblink_list\":[\"$code\"],\"name\":\"schedule\"}"

        conn.outputStream.use {
            it.write(body.toByteArray(Charsets.UTF_8))
        }

        val text = readText(conn)

        if (conn.responseCode !in 200..299) {
            error("Mail Cloud: HTTP ${conn.responseCode}")
        }

        val obj = JSONObject(text)
        val key = obj.optString("key")

        if (key.isBlank()) {
            error("Mail Cloud не вернул ссылку на архив")
        }

        return if (key.startsWith("http")) {
            key
        } else {
            "https://cloud.mail.ru$key"
        }
    }

    private fun httpGet(urlText: String): ByteArray {
        val conn = (URL(urlText).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 20000
            readTimeout = 60000

            setRequestProperty(
                "User-Agent",
                "ScheduleApp/1.0"
            )

            setRequestProperty(
                "Referer",
                "https://cloud.mail.ru/public/$publicCode"
            )
        }

        if (conn.responseCode !in 200..399) {
            error("Загрузка расписания: HTTP ${conn.responseCode}")
        }

        return conn.inputStream.use {
            it.readBytes()
        }
    }

    private fun readText(conn: HttpURLConnection): String {
        val stream =
            if (conn.responseCode >= 400) {
                conn.errorStream
            } else {
                conn.inputStream
            }

        return stream.bufferedReader(Charsets.UTF_8).use {
            it.readText()
        }
    }

    private fun unzipXlsx(
        zipBytes: ByteArray,
        folder: File
    ): List<File> {

        val out = mutableListOf<File>()

        ZipInputStream(zipBytes.inputStream()).use { zis ->

            while (true) {

                val entry = zis.nextEntry ?: break

                if (
                    !entry.isDirectory &&
                    entry.name.lowercase().endsWith(".xlsx")
                ) {

                    val safeName = entry.name
                        .substringAfterLast('/')
                        .replace(
                            Regex("[^\\p{L}\\p{N}._ -]"),
                            "_"
                        )

                    val file = File(folder, safeName)

                    FileOutputStream(file).use { fos ->
                        zis.copyTo(fos)
                    }

                    out += file
                }

                zis.closeEntry()
            }
        }

        return out
    }
}
