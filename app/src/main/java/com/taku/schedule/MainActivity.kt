package com.taku.schedule

import android.annotation.SuppressLint
import android.content.Intent
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
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
    private val backgroundDir by lazy { File(filesDir, "schedule_background") }

    private val openExcel = registerForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris ->
        if (uris.isNullOrEmpty()) return@registerForActivityResult
        importSelectedFiles(uris)
    }
    private val openBackground = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) importBackground(uri)
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ScheduleSync.scheduleNextSunday(this)
        ScheduleSync.scheduleNextNewYear(this)
        LessonReminderScheduler.restore(this)
        backgroundDir.mkdirs()
        assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .addPathHandler("/schedule/", WebViewAssetLoader.PathHandler { path ->
                val token = path.trim('/').substringBefore('/')
                val file = servedScheduleFiles[token] ?: return@PathHandler null
                if (!file.exists() || !file.isFile || file.length() <= 0L) { servedScheduleFiles.remove(token); return@PathHandler null }
                try { WebResourceResponse("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", null, file.inputStream()) } catch (_: Exception) { null }
            })
            .addPathHandler("/background/", WebViewAssetLoader.PathHandler { path ->
                if (path.trim('/') != "current") return@PathHandler null
                val file = File(backgroundDir, "current")
                if (!file.exists() || !file.isFile || file.length() <= 0L) return@PathHandler null
                val mime = when (file.extension.lowercase()) { "gif" -> "image/gif"; "webp" -> "image/webp"; "png" -> "image/png"; else -> "image/jpeg" }
                try { WebResourceResponse(mime, null, file.inputStream()) } catch (_: Exception) { null }
            }).build()

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
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? = assetLoader.shouldInterceptRequest(request.url)
                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest): Boolean {
                    val uri = request.url
                    val tg = uri.scheme.equals("tg", true) || (uri.scheme.equals("https", true) && uri.host.equals("t.me", true))
                    if (tg) { try { startActivity(Intent(Intent.ACTION_VIEW, uri)) } catch (_: Exception) {}; return true }
                    return false
                }
                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    view?.evaluateJavascript("""
                        (function(){
                          function addScript(id,src){if(!document.getElementById(id)){var s=document.createElement('script');s.id=id;s.src=src;document.head.appendChild(s)}}
                          addScript('scheduleCustomizationScript','./customization.js');
                          addScript('scheduleRemindersScript','./reminders_optimized.js');
                          addScript('schedulePerformanceScript','./performance.js');
                          addScript('scheduleExtrasScript','./schedule_extras.js');
                          addScript('scheduleCustomFeaturesScript','./custom_features.js');
                          document.querySelectorAll('p,h3,button').forEach(function(el){if(el.textContent==='Mail Облако • автоматическая синхронизация')el.textContent='КМК • автоматическая синхронизация';else if(el.textContent==='Mail Облако')el.textContent='КМК';else if(el.textContent==='Открыть Mail Облако')el.textContent='Открыть источник КМК'});
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
        if (::web.isInitialized) { web.removeJavascriptInterface("Android"); web.destroy() }
        servedScheduleFiles.clear()
        super.onDestroy()
    }

    inner class Bridge {
        @JavascriptInterface fun sync() { thread { try {
            if (!isOnline()) { val cached=ScheduleFileSelector.select(ScheduleRepository.readCachedFiles(this@MainActivity)); if(cached.isNotEmpty())sendFiles(cached,"Нет интернета • используется расписание на текущую дату") else sendError("Нет интернета и ещё нет сохранённого Excel-файла"); return@thread }
            val files=MailCloudDownloader.download(this@MainActivity); sendFiles(ScheduleFileSelector.select(files),"Расписание загружено • выбрана неделя по текущей дате")
        } catch(e:Exception) { val cached=ScheduleFileSelector.select(ScheduleRepository.readCachedFiles(this@MainActivity)); if(cached.isNotEmpty())sendFiles(cached,"Не удалось обновить • используется сохранённая неделя") else sendError(e.message?:"Не удалось загрузить расписание") } } }
        @JavascriptInterface fun loadCached(){thread{try{val files=ScheduleFileSelector.select(ScheduleRepository.readCachedFiles(this@MainActivity));if(files.isEmpty())sendError("Сохранённого расписания пока нет")else sendFiles(files,"Сохранённое расписание • выбрана неделя по дате")}catch(e:Exception){sendError(e.message?:"Не удалось открыть сохранённое расписание")}}}
        @JavascriptInterface fun pickExcel(){runOnUiThread{openExcel.launch(arrayOf("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","application/vnd.ms-excel"))}}
        @JavascriptInterface fun pickBackground(){runOnUiThread{openBackground.launch(arrayOf("image/*"))}}
        @JavascriptInterface fun clearBackground(){thread{try{File(backgroundDir,"current").delete()}catch(_:Exception){};runOnUiThread{web.evaluateJavascript("window.clearScheduleBackground&&window.clearScheduleBackground()",null)}}}
        @JavascriptInterface fun openSource(){runOnUiThread{try{startActivity(Intent(Intent.ACTION_VIEW,Uri.parse(ScheduleRepository.PUBLIC_URL)))}catch(_:Exception){}}}
        @JavascriptInterface fun openTelegram(){runOnUiThread{val tg=Uri.parse("tg://resolve?domain=takusima");val webUri=Uri.parse("https://t.me/takusima");try{startActivity(Intent(Intent.ACTION_VIEW,tg))}catch(_:Exception){try{startActivity(Intent(Intent.ACTION_VIEW,webUri))}catch(_:Exception){}}}}
        @JavascriptInterface fun updateWidgetData(json:String,accent:String){thread{try{ScheduleWidgetProvider.saveAndRefresh(this@MainActivity,json,accent)}catch(_:Exception){}}}
        @JavascriptInterface fun getCachedCount():Int=ScheduleRepository.readCachedFiles(this@MainActivity).size
        @JavascriptInterface fun setLessonReminders(enabled:Boolean,minutes:Int,group:String,sound:String,lessonsJson:String){LessonReminderScheduler.saveAndSchedule(this@MainActivity,enabled,minutes,group,sound,lessonsJson)}
    }

    private fun importBackground(uri:Uri){thread{try{
        backgroundDir.mkdirs();val name=queryDisplayName(uri)?.lowercase()? : "background.jpg"
        val ext=when{ name.endsWith(".gif")->"gif";name.endsWith(".webp")->"webp";name.endsWith(".png")->"png";else->"jpg" }
        val tmp=File(backgroundDir,"background.tmp.$ext");contentResolver.openInputStream(uri)?.use{input->tmp.outputStream().use{out->input.copyTo(out,64*1024)}}?:throw IllegalStateException("Не удалось прочитать изображение")
        val current=File(backgroundDir,"current");if(current.exists())current.delete();if(!tmp.renameTo(current)){tmp.copyTo(current,true);tmp.delete()}
        val url="https://appassets.androidplatform.net/background/current?v=${current.lastModified()}";runOnUiThread{web.evaluateJavascript("window.setScheduleBackground&&window.setScheduleBackground(${JSONObject.quote(url)},${JSONObject.quote(name)})",null)}
    }catch(e:Exception){sendError(e.message?:"Не удалось установить фон")}}}
    private fun queryDisplayName(uri:Uri):String?=try{contentResolver.query(uri,null,null,null,null)?.use{c->val i=c.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME);if(i>=0&&c.moveToFirst())c.getString(i)else null}}catch(_:Exception){null}
    private fun importSelectedFiles(uris:List<Uri>){thread{try{val files=ScheduleRepository.importExcelFiles(this@MainActivity,uris);sendFiles(files,"Excel загружен • сохранено файлов: ${files.size}")}catch(e:Exception){sendError(e.message?:"Не удалось загрузить Excel")}}}
    private fun sendFiles(files:List<File>,status:String){if(files.isEmpty()){sendError("Excel-файлы не найдены");return};while(servedScheduleFiles.size>24){val k=servedScheduleFiles.keys.firstOrNull()?:break;servedScheduleFiles.remove(k)};val r=JSONArray();files.forEach{f->if(f.exists()&&f.isFile&&f.length()>0){val t=UUID.randomUUID().toString();servedScheduleFiles[t]=f;r.put(JSONObject().apply{put("name",f.name);put("url","$localScheduleBaseUrl/$t")})}};if(r.length()==0){sendError("Excel-файлы не найдены");return};val js="""(function(){var data=${JSONObject.quote(r.toString())},status=${JSONObject.quote(status)};if(window.__schedulePerformanceReady&&typeof window.onNativeFiles==='function')window.onNativeFiles(data,status);else window.__schedulePendingNativeFiles={json:data,status:status}})();""";runOnUiThread{if(::web.isInitialized)web.evaluateJavascript(js,null)}}
    private fun sendError(message:String){val js="""(function(){if(window.__schedulePerformanceReady&&typeof window.onNativeError==='function')window.onNativeError(${JSONObject.quote(message)});else window.__schedulePendingNativeError=${JSONObject.quote(message)}})();""";runOnUiThread{if(::web.isInitialized)web.evaluateJavascript(js,null)}}
    private fun isOnline():Boolean{val m=getSystemService(ConnectivityManager::class.java)?:return false;val n=m.activeNetwork?:return false;val c=m.getNetworkCapabilities(n)?:return false;return c.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)&&c.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)}
}
