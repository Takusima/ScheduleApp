package com.taku.schedule

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import kotlin.concurrent.thread

class MainActivity : AppCompatActivity() {

    private lateinit var web: WebView
    private lateinit var assetLoader: WebViewAssetLoader
    private val servedScheduleFiles = ConcurrentHashMap<String, File>()
    private val localScheduleBaseUrl = "https://appassets.androidplatform.net/schedule"

    private val openExcel = registerForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris ->
        if (uris.isNullOrEmpty()) return@registerForActivityResult
        importSelectedFiles(uris)
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ScheduleSync.scheduleNextSunday(this)
        ScheduleSync.scheduleNextNewYear(this)
        LessonReminderScheduler.restore(this)

        assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .addPathHandler("/schedule/", WebViewAssetLoader.PathHandler { path ->
                val token = path.trim('/').substringBefore('/')
                val file = servedScheduleFiles[token] ?: return@PathHandler null
                if (!file.exists() || !file.isFile || file.length() <= 0L) {
                    servedScheduleFiles.remove(token)
                    return@PathHandler null
                }
                try {
                    WebResourceResponse(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        null,
                        file.inputStream()
                    )
                } catch (_: Exception) {
                    null
                }
            })
            .build()

        web = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.loadsImagesAutomatically = true
            settings.setSupportZoom(false)
            settings.builtInZoomControls = false
            settings.displayZoomControls = false
            webChromeClient = WebChromeClient()
            webViewClient = object : WebViewClientCompat() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                    return assetLoader.shouldInterceptRequest(request.url)
                }

                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest): Boolean = false

                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    view?.evaluateJavascript("""
                        (function() {
                            function addScript(id, src) {
                                if (!document.getElementById(id)) {
                                    var script = document.createElement('script');
                                    script.id = id;
                                    script.src = src;
                                    document.head.appendChild(script);
                                }
                            }
                            addScript('scheduleCustomizationScript', './customization.js');
                            addScript('scheduleRemindersScript', './reminders.js');
                            addScript('schedulePerformanceScript', './performance.js');
                        })();
                    """.trimIndent(), null)
                }
            }
            addJavascriptInterface(Bridge(), "Android")
            loadUrl("https://appassets.androidplatform.net/assets/index.html")
        }
        setContentView(web)
    }

    override fun onDestroy() {
        if (::web.isInitialized) {
            web.removeJavascriptInterface("Android")
            web.destroy()
        }
        servedScheduleFiles.clear()
        super.onDestroy()
    }

    inner class Bridge {
        @JavascriptInterface
        fun sync() {
            thread {
                try {
                    if (!isOnline()) {
                        val cached = ScheduleFileSelector.select(ScheduleRepository.readCachedFiles(this@MainActivity))
                        if (cached.isNotEmpty()) sendFiles(cached, "Нет интернета • используется расписание на текущую дату")
                        else sendError("Нет интернета и ещё нет сохранённого Excel-файла")
                        return@thread
                    }
                    val files = MailCloudDownloader.download(this@MainActivity)
                    val selected = ScheduleFileSelector.select(files)
                    sendFiles(selected, "Расписание загружено • выбрана неделя по текущей дате")
                } catch (e: Exception) {
                    val cached = ScheduleFileSelector.select(ScheduleRepository.readCachedFiles(this@MainActivity))
                    if (cached.isNotEmpty()) sendFiles(cached, "Не удалось обновить • используется сохранённая неделя")
                    else sendError(e.message ?: "Не удалось загрузить расписание")
                }
            }
        }

        @JavascriptInterface
        fun loadCached() {
            thread {
                try {
                    val files = ScheduleFileSelector.select(ScheduleRepository.readCachedFiles(this@MainActivity))
                    if (files.isEmpty()) sendError("Сохранённого расписания пока нет")
                    else sendFiles(files, "Сохранённое расписание • выбрана неделя по дате")
                } catch (e: Exception) {
                    sendError(e.message ?: "Не удалось открыть сохранённое расписание")
                }
            }
        }

        @JavascriptInterface
        fun pickExcel() {
            runOnUiThread {
                openExcel.launch(arrayOf(
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    "application/vnd.ms-excel"
                ))
            }
        }

        @JavascriptInterface
        fun openSource() {
            runOnUiThread {
                try { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(ScheduleRepository.PUBLIC_URL))) } catch (_: Exception) { }
            }
        }

        @JavascriptInterface
        fun getCachedCount(): Int = ScheduleRepository.readCachedFiles(this@MainActivity).size

        @JavascriptInterface
        fun setLessonReminders(enabled: Boolean, minutes: Int, group: String, sound: String, lessonsJson: String) {
            LessonReminderScheduler.saveAndSchedule(this@MainActivity, enabled, minutes, group, sound, lessonsJson)
        }
    }

    private fun importSelectedFiles(uris: List<Uri>) {
        thread {
            try {
                val files = ScheduleRepository.importExcelFiles(this@MainActivity, uris)
                sendFiles(files, "Excel загружен • сохранено файлов: ${files.size}")
            } catch (e: Exception) {
                sendError(e.message ?: "Не удалось загрузить Excel")
            }
        }
    }

    private fun sendFiles(files: List<File>, status: String) {
        if (files.isEmpty()) {
            sendError("Excel-файлы не найдены")
            return
        }

        while (servedScheduleFiles.size > 24) {
            val first = servedScheduleFiles.keys.firstOrNull() ?: break
            servedScheduleFiles.remove(first)
        }

        val result = JSONArray()
        files.forEach { file ->
            if (!file.exists() || !file.isFile || file.length() <= 0L) return@forEach
            val token = UUID.randomUUID().toString()
            servedScheduleFiles[token] = file
            result.put(JSONObject().apply {
                put("name", file.name)
                put("url", "$localScheduleBaseUrl/$token")
            })
        }

        if (result.length() == 0) {
            sendError("Excel-файлы не найдены")
            return
        }

        val json = result.toString()
        val js = """
            (function() {
                var data = ${JSONObject.quote(json)};
                var status = ${JSONObject.quote(status)};
                if (window.__schedulePerformanceReady && typeof window.onNativeFiles === 'function') {
                    window.onNativeFiles(data, status);
                } else {
                    window.__schedulePendingNativeFiles = { json: data, status: status };
                }
            })();
        """.trimIndent()

        runOnUiThread {
            if (::web.isInitialized) web.evaluateJavascript(js, null)
        }
    }

    private fun sendError(message: String) {
        val js = """
            (function() {
                if (window.__schedulePerformanceReady && typeof window.onNativeError === 'function') {
                    window.onNativeError(${JSONObject.quote(message)});
                } else {
                    window.__schedulePendingNativeError = ${JSONObject.quote(message)};
                }
            })();
        """.trimIndent()
        runOnUiThread {
            if (::web.isInitialized) web.evaluateJavascript(js, null)
        }
    }

    private fun isOnline(): Boolean {
        val manager = getSystemService(ConnectivityManager::class.java) ?: return false
        val network = manager.activeNetwork ?: return false
        val capabilities = manager.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
            capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }
}
