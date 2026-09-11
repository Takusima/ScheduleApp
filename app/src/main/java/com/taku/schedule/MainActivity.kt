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
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import kotlin.concurrent.thread

class MainActivity : AppCompatActivity() {

    private lateinit var web: WebView

    private val openExcel =
        registerForActivityResult(
            ActivityResultContracts.OpenMultipleDocuments()
        ) { uris ->
            if (uris.isNullOrEmpty()) return@registerForActivityResult
            importSelectedFiles(uris)
        }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        ScheduleSync.scheduleNextSunday(this)

        web = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = true
            settings.allowContentAccess = true
            settings.loadsImagesAutomatically = true

            webChromeClient = WebChromeClient()

            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(
                    view: WebView?,
                    url: String?
                ): Boolean = false

                override fun onPageFinished(
                    view: WebView?,
                    url: String?
                ) {
                    super.onPageFinished(view, url)

                    view?.evaluateJavascript(
                        """
                        (function() {
                            if (document.getElementById('scheduleCustomizationScript')) return;
                            var script = document.createElement('script');
                            script.id = 'scheduleCustomizationScript';
                            script.src = './customization.js';
                            document.head.appendChild(script);
                        })();
                        """.trimIndent(),
                        null
                    )
                }
            }

            addJavascriptInterface(Bridge(), "Android")
            loadUrl("file:///android_asset/index.html")
        }

        setContentView(web)
    }

    override fun onDestroy() {
        if (::web.isInitialized) {
            web.removeJavascriptInterface("Android")
            web.destroy()
        }
        super.onDestroy()
    }

    inner class Bridge {

        @JavascriptInterface
        fun sync() {
            thread {
                try {
                    if (!isOnline()) {
                        val cached = ScheduleFileSelector.select(
                            ScheduleRepository.readCachedFiles(this@MainActivity)
                        )

                        if (cached.isNotEmpty()) {
                            sendFiles(
                                cached,
                                "Нет интернета • используется расписание на текущую дату"
                            )
                        } else {
                            sendError("Нет интернета и ещё нет сохранённого Excel-файла")
                        }
                        return@thread
                    }

                    val files = MailCloudDownloader.download(this@MainActivity)
                    val selected = ScheduleFileSelector.select(files)

                    sendFiles(
                        selected,
                        "Расписание обновлено • выбрана неделя по текущей дате"
                    )
                } catch (e: Exception) {
                    val cached = ScheduleFileSelector.select(
                        ScheduleRepository.readCachedFiles(this@MainActivity)
                    )

                    if (cached.isNotEmpty()) {
                        sendFiles(
                            cached,
                            "Не удалось обновить • используется сохранённая неделя"
                        )
                    } else {
                        sendError(e.message ?: "Не удалось загрузить расписание")
                    }
                }
            }
        }

        @JavascriptInterface
        fun loadCached() {
            thread {
                try {
                    val files = ScheduleFileSelector.select(
                        ScheduleRepository.readCachedFiles(this@MainActivity)
                    )

                    if (files.isEmpty()) {
                        sendError("Сохранённого расписания пока нет")
                    } else {
                        sendFiles(files, "Сохранённое расписание • выбрана неделя по дате")
                    }
                } catch (e: Exception) {
                    sendError(e.message ?: "Не удалось открыть сохранённое расписание")
                }
            }
        }

        @JavascriptInterface
        fun pickExcel() {
            runOnUiThread {
                openExcel.launch(
                    arrayOf(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        "application/vnd.ms-excel"
                    )
                )
            }
        }

        @JavascriptInterface
        fun openSource() {
            runOnUiThread {
                try {
                    startActivity(
                        Intent(
                            Intent.ACTION_VIEW,
                            Uri.parse(ScheduleRepository.PUBLIC_URL)
                        )
                    )
                } catch (_: Exception) {
                }
            }
        }

        @JavascriptInterface
        fun getCachedCount(): Int {
            return ScheduleRepository
                .readCachedFiles(this@MainActivity)
                .size
        }
    }

    private fun importSelectedFiles(uris: List<Uri>) {
        thread {
            try {
                val files = ScheduleRepository.importExcelFiles(
                    this@MainActivity,
                    uris
                )

                sendFiles(
                    files,
                    "Excel загружен • сохранено файлов: ${files.size}"
                )
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

        val filesJson = result.toString()
        val js =
            "window.onNativeFiles(" +
                JSONObject.quote(filesJson) +
                "," +
                JSONObject.quote(status) +
                ");"

        runOnUiThread {
            if (!::web.isInitialized) return@runOnUiThread
            web.evaluateJavascript(js, null)
        }
    }

    private fun sendError(message: String) {
        val js =
            "window.onNativeError(" +
                JSONObject.quote(message) +
                ");"

        runOnUiThread {
            if (!::web.isInitialized) return@runOnUiThread
            web.evaluateJavascript(js, null)
        }
    }

    private fun isOnline(): Boolean {
        val manager = getSystemService(ConnectivityManager::class.java)
            ?: return false
        val network = manager.activeNetwork ?: return false
        val capabilities = manager.getNetworkCapabilities(network)
            ?: return false

        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
            capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }
}
