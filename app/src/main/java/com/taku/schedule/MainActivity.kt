package com.taku.schedule

import android.Manifest
import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageManager
import android.media.RingtoneManager
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
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import kotlin.concurrent.thread

class MainActivity : AppCompatActivity() {

    private lateinit var web: WebView
    private lateinit var assetLoader: WebViewAssetLoader

    private val openExcel = registerForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris ->
        if (uris.isNullOrEmpty()) return@registerForActivityResult
        importSelectedFiles(uris)
    }

    private val notificationPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ScheduleSync.scheduleNextSunday(this)
        ScheduleSync.scheduleNextNewYear(this)
        LessonReminderScheduler.restore(this)
        requestNotificationPermissionIfNeeded()

        assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
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

                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest): Boolean {
                    return false
                }

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

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT < 33) return
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
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
                        val cached = ScheduleFileSelector.select(ScheduleRepository.readCachedFiles(this@MainActivity))
                        if (cached.isNotEmpty()) sendFiles(cached, "Нет интернета • используется расписание на текущую дату")
                        else sendError("Нет интернета и ещё нет сохранённого Excel-файла")
                        return@thread
                    }

                    val files = MailCloudDownloader.download(this@MainActivity)
                    val selected = ScheduleFileSelector.select(files)
                    sendFiles(selected, "Расписание обновлено • выбрана неделя по текущей дате")
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
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(ScheduleRepository.PUBLIC_URL)))
                } catch (_: Exception) {
                }
            }
        }

        @JavascriptInterface
        fun getCachedCount(): Int = ScheduleRepository.readCachedFiles(this@MainActivity).size

        @JavascriptInterface
        fun setLessonReminders(enabled: Boolean, minutes: Int, group: String, sound: String, lessonsJson: String) {
            LessonReminderScheduler.saveAndSchedule(
                this@MainActivity,
                enabled,
                minutes,
                group,
                sound,
                lessonsJson
            )
        }

        @JavascriptInterface
        fun notifyScheduleUpdated(message: String) {
            if (
                Build.VERSION.SDK_INT >= 33 &&
                ContextCompat.checkSelfPermission(
                    this@MainActivity,
                    Manifest.permission.POST_NOTIFICATIONS
                ) != PackageManager.PERMISSION_GRANTED
            ) return

            val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
            val channelId = "schedule_updates"

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val channel = NotificationChannel(
                    channelId,
                    "Обновления расписания",
                    NotificationManager.IMPORTANCE_DEFAULT
                ).apply {
                    description = "Уведомления об обновлении расписания"
                    setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION), null)
                }
                manager.createNotificationChannel(channel)
            }

            val pending = PendingIntent.getActivity(
                this@MainActivity,
                9012,
                Intent(this@MainActivity, MainActivity::class.java),
                PendingIntent.FLAG_UPDATE_CURRENT or
                    if (Build.VERSION.SDK_INT >= 23) PendingIntent.FLAG_IMMUTABLE else 0
            )

            val notification = NotificationCompat.Builder(this@MainActivity, channelId)
                .setSmallIcon(android.R.drawable.ic_popup_sync)
                .setContentTitle("📚 Расписание обновлено")
                .setContentText(message)
                .setContentIntent(pending)
                .setAutoCancel(true)
                .build()

            NotificationManagerCompat.from(this@MainActivity).notify(9012, notification)
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

        val js = "window.onNativeFiles(" +
            JSONObject.quote(result.toString()) +
            "," +
            JSONObject.quote(status) +
            ");"

        runOnUiThread {
            if (::web.isInitialized) web.evaluateJavascript(js, null)
        }
    }

    private fun sendError(message: String) {
        val js = "window.onNativeError(" + JSONObject.quote(message) + ");"
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
