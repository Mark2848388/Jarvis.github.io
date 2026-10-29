package com.mark.jarvis

import android.Manifest
import android.app.AlertDialog
import android.media.AudioManager
import android.os.BatteryManager
import android.provider.AlarmClock
import android.provider.CalendarContract
import android.provider.ContactsContract
import android.view.KeyEvent
import android.webkit.GeolocationPermissions
import android.webkit.WebChromeClient
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Base64
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.exifinterface.media.ExifInterface
import androidx.webkit.WebViewAssetLoader
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.Locale

class MainActivity : ComponentActivity() {
    private lateinit var web: WebView
    private var recognizer: SpeechRecognizer? = null
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var photoUri: Uri? = null

    private val micPerm = registerForActivityResult(ActivityResultContracts.RequestPermission()) { }
    private val camPerm = registerForActivityResult(ActivityResultContracts.RequestPermission()) { ok ->
        if (ok) doShoot() else js("window.onNativeError('Нет доступа к камере. Разрешите его в настройках Android.')")
    }
    private val pick = registerForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) sendPhoto(uri)
    }
    private val shoot = registerForActivityResult(ActivityResultContracts.TakePicture()) { ok ->
        if (ok) photoUri?.let { sendPhoto(it) }
    }

    private var afterPerm: (() -> Unit)? = null
    private val multiPerm = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { res ->
        val a = afterPerm; afterPerm = null
        if (res.values.all { it }) a?.invoke()
        else js("window.onNativeError('Не хватает разрешения. Включите его в настройках Android для JARVIS.')")
    }
    private val allPerm = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { res ->
        js("window.onNativeInfo('Выдано разрешений: " + res.values.count { it } + " из " + res.size + ".')")
    }

    private fun withPerms(perms: Array<String>, action: () -> Unit) {
        val missing = perms.filter { !has(it) }
        if (missing.isEmpty()) action() else { afterPerm = action; multiPerm.launch(missing.toTypedArray()) }
    }

    private fun err(msg: String) = js("window.onNativeError(" + JSONObject.quote(msg) + ")")

    private fun findContact(name: String): Pair<String, String>? {
        val all = ArrayList<Pair<String, String>>()
        val ph = ContactsContract.CommonDataKinds.Phone
        contentResolver.query(ph.CONTENT_URI, arrayOf(ph.DISPLAY_NAME, ph.NUMBER), null, null, null)?.use {
            while (it.moveToNext()) all.add(Pair(it.getString(0) ?: "", it.getString(1) ?: ""))
        }
        val q = name.trim().lowercase(Locale.getDefault())
        val lo = minOf(q.length, maxOf(3, q.length - 3))
        var n = q.length
        while (n >= lo && n > 0) {
            val part = q.substring(0, n)
            all.firstOrNull { it.first.lowercase(Locale.getDefault()).contains(part) }?.let { return it }
            n--
        }
        return null
    }

    private fun confirm(msg: String, yes: () -> Unit) {
        AlertDialog.Builder(this).setMessage(msg)
            .setPositiveButton("Да") { _, _ -> yes() }
            .setNegativeButton("Отмена", null).show()
    }

    private fun js(code: String) = runOnUiThread { web.evaluateJavascript(code, null) }
    private fun has(p: String) = ContextCompat.checkSelfPermission(this, p) == PackageManager.PERMISSION_GRANTED

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        web = WebView(this)
        setContentView(web)
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        web.settings.mediaPlaybackRequiresUserGesture = false
        web.settings.allowFileAccess = false
        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this)).build()
        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                loader.shouldInterceptRequest(request.url)
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (request.url.host == "appassets.androidplatform.net") return false
                openExternal(request.url.toString(), "")
                return true
            }
        }
        web.webChromeClient = object : WebChromeClient() {
            override fun onGeolocationPermissionsShowPrompt(origin: String, callback: GeolocationPermissions.Callback) {
                withPerms(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)) { callback.invoke(origin, true, false) }
            }
            override fun onPermissionRequest(request: android.webkit.PermissionRequest) {
                runOnUiThread { withPerms(arrayOf(Manifest.permission.RECORD_AUDIO)) { request.grant(request.resources) } }
            }
        }
        web.addJavascriptInterface(Bridge(), "Android")
        initTts(null)
        if (!has(Manifest.permission.RECORD_AUDIO)) micPerm.launch(Manifest.permission.RECORD_AUDIO)
        web.loadUrl("https://appassets.androidplatform.net/assets/www/index.html")
    }

    private var ttsEngine: String? = null
    private var voiceName: String = ""

    private fun applyVoice() {
        if (voiceName.isEmpty()) return
        try { tts?.voices?.firstOrNull { it.name == voiceName }?.let { tts?.voice = it } } catch (e: Exception) { }
    }

    private fun initTts(engine: String?) {
        ttsReady = false
        try { tts?.shutdown() } catch (e: Exception) { }
        val listener = TextToSpeech.OnInitListener { st ->
            if (st == TextToSpeech.SUCCESS) {
                tts?.language = Locale("ru", "RU")
                tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                    override fun onStart(id: String?) {}
                    override fun onDone(id: String?) { js("window.onNativeSpeakDone&&window.onNativeSpeakDone()") }
                    @Deprecated("Deprecated in Java")
                    override fun onError(id: String?) { js("window.onNativeSpeakDone&&window.onNativeSpeakDone()") }
                })
                applyVoice()
                ttsReady = true
                js("window.onNativeTtsReady&&window.onNativeTtsReady()")
            } else {
                js("window.onNativeError('Синтезатор речи не запустился. Проверьте Настройки Android, Синтез речи.')")
            }
        }
        tts = if (engine.isNullOrEmpty()) TextToSpeech(this, listener) else TextToSpeech(this, listener, engine)
    }

    private fun openExternal(url: String, pkg: String) {
        val i = Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        var done = false
        if (pkg.isNotEmpty()) {
            try { startActivity(Intent(i).setPackage(pkg)); done = true } catch (e: Exception) { }
        }
        if (!done) try { startActivity(i) } catch (e: Exception) { }
    }

    private fun findApp(name: String): Intent? {
        val pm = packageManager
        val q = name.trim().lowercase(Locale.getDefault())
        if (q.length < 2) return null
        val list = pm.queryIntentActivities(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER), 0)
        fun label(r: android.content.pm.ResolveInfo) = r.loadLabel(pm).toString().lowercase(Locale.getDefault())
        val hit = list.firstOrNull { label(it) == q }
            ?: list.firstOrNull { label(it).contains(q) || (label(it).length > 2 && q.contains(label(it))) }
        return hit?.let { pm.getLaunchIntentForPackage(it.activityInfo.packageName) }
    }

    private fun startListen() {
        if (!has(Manifest.permission.RECORD_AUDIO)) {
            micPerm.launch(Manifest.permission.RECORD_AUDIO)
            js("window.onNativeSpeechError('not-allowed');window.onNativeSpeechEnd()")
            return
        }
        recognizer?.destroy()
        val r = SpeechRecognizer.createSpeechRecognizer(this)
        recognizer = r
        r.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(p: Bundle?) { js("window.onNativeSpeechStart()") }
            override fun onResults(b: Bundle?) {
                val t = b?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
                if (t != null) js("window.onNativeSpeech(" + JSONObject.quote(t) + ")")
                js("window.onNativeSpeechEnd()")
            }
            override fun onError(e: Int) {
                val code = when (e) {
                    SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "no-speech"
                    SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "not-allowed"
                    SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "aborted"
                    SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "network"
                    else -> "error-$e"
                }
                js("window.onNativeSpeechError('$code');window.onNativeSpeechEnd()")
            }
            override fun onBeginningOfSpeech() {}
            override fun onRmsChanged(v: Float) {}
            override fun onBufferReceived(b: ByteArray?) {}
            override fun onEndOfSpeech() {}
            override fun onPartialResults(b: Bundle?) {}
            override fun onEvent(t: Int, b: Bundle?) {}
        })
        val i = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ru-RU")
            .putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
        r.startListening(i)
    }

    private fun doShoot() {
        val dir = File(cacheDir, "images").apply { mkdirs() }
        val uri = FileProvider.getUriForFile(this, "$packageName.files", File(dir, "shot.jpg"))
        photoUri = uri
        shoot.launch(uri)
    }

    private fun sendPhoto(uri: Uri) {
        Thread {
            try {
                val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
                var sample = 1
                while (maxOf(bounds.outWidth, bounds.outHeight) / sample > 2048) sample *= 2
                val opts = BitmapFactory.Options().apply { inSampleSize = sample }
                val src = contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, opts) }
                    ?: throw IllegalStateException("decode")
                val rot = contentResolver.openInputStream(uri)?.use {
                    when (ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, 1)) {
                        6 -> 90f; 3 -> 180f; 8 -> 270f; else -> 0f
                    }
                } ?: 0f
                val k = 1024f / maxOf(src.width, src.height)
                val m = Matrix().apply { if (k < 1f) postScale(k, k); if (rot != 0f) postRotate(rot) }
                val bmp = Bitmap.createBitmap(src, 0, 0, src.width, src.height, m, true)
                val out = ByteArrayOutputStream()
                bmp.compress(Bitmap.CompressFormat.JPEG, 80, out)
                val data = "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
                js("window.onNativePhoto(" + JSONObject.quote(data) + ")")
            } catch (e: Exception) {
                js("window.onNativeError('Не удалось обработать фото.')")
            }
        }.start()
    }

    inner class Bridge {
        @JavascriptInterface fun hasSpeech(): Boolean = SpeechRecognizer.isRecognitionAvailable(this@MainActivity)
        @JavascriptInterface fun listen() { runOnUiThread { startListen() } }
        @JavascriptInterface fun stopListen() { runOnUiThread { recognizer?.cancel() } }
        @JavascriptInterface fun speak(text: String, rate: Float, pitch: Float, lang: String) {
            runOnUiThread {
                if (!ttsReady) { js("window.onNativeSpeakDone&&window.onNativeSpeakDone()"); return@runOnUiThread }
                val l = lang.ifEmpty { "ru-RU" }
                val r = tts?.setLanguage(Locale.forLanguageTag(l))
                if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) tts?.language = Locale("ru", "RU")
                if (l.startsWith("ru")) applyVoice()
                tts?.setSpeechRate(rate)
                tts?.setPitch(pitch)
                val res = tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "jarvis")
                if (res != TextToSpeech.SUCCESS) js("window.onNativeSpeakDone&&window.onNativeSpeakDone()")
            }
        }
        @JavascriptInterface fun ttsInfo(): String {
            val o = JSONObject()
            val eng = JSONArray()
            try { tts?.engines?.forEach { eng.put(JSONObject().put("n", it.name).put("l", it.label.toString())) } } catch (e: Exception) { }
            val vs = JSONArray()
            try {
                tts?.voices?.filter { it.locale.language == "ru" }?.sortedBy { it.name }?.forEach {
                    vs.put(JSONObject().put("n", it.name).put("l", it.name + " (" + it.locale.displayCountry + ")"))
                }
            } catch (e: Exception) { }
            o.put("engines", eng)
            o.put("engine", ttsEngine ?: tts?.defaultEngine ?: "")
            o.put("voices", vs)
            return o.toString()
        }
        @JavascriptInterface fun setEngine(name: String) { runOnUiThread { ttsEngine = name.ifEmpty { null }; initTts(ttsEngine) } }
        @JavascriptInterface fun setVoice(name: String) { runOnUiThread { voiceName = name; applyVoice() } }
        @JavascriptInterface fun ttsSettings() {
            runOnUiThread {
                try { startActivity(Intent("com.android.settings.TTS_SETTINGS").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
                catch (e: Exception) { try { startActivity(Intent(Settings.ACTION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) } catch (e2: Exception) { } }
            }
        }
        @JavascriptInterface fun checkInfo(): String {
            val o = JSONObject()
            o.put("mic", has(Manifest.permission.RECORD_AUDIO))
            o.put("recog", SpeechRecognizer.isRecognitionAvailable(this@MainActivity))
            o.put("tts", ttsReady)
            o.put("engine", ttsEngine ?: tts?.defaultEngine ?: "")
            var ru = 0
            try { ru = tts?.voices?.count { it.locale.language == "ru" } ?: 0 } catch (e: Exception) { }
            o.put("ru", ru)
            return o.toString()
        }
        @JavascriptInterface fun stopSpeak() { runOnUiThread { tts?.stop() } }
        @JavascriptInterface fun openUrl(url: String, pkg: String) { runOnUiThread { openExternal(url, pkg) } }
        @JavascriptInterface fun hasApp(name: String): Boolean = findApp(name) != null
        @JavascriptInterface fun openApp(name: String) {
            runOnUiThread { findApp(name)?.let { try { startActivity(it) } catch (e: Exception) { } } }
        }
        @JavascriptInterface fun goHome() {
            runOnUiThread { try { startActivity(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) } catch (e: Exception) { } }
        }
        @JavascriptInterface fun torch(on: Boolean): Boolean {
            return try {
                val cm = getSystemService(Context.CAMERA_SERVICE) as CameraManager
                val id = cm.cameraIdList.firstOrNull {
                    cm.getCameraCharacteristics(it).get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true
                }
                if (id == null) false else { cm.setTorchMode(id, on); true }
            } catch (e: Exception) { false }
        }
        @JavascriptInterface fun openSettings(kind: String) {
            runOnUiThread {
                val a = when (kind) {
                    "wifi" -> Settings.ACTION_WIFI_SETTINGS
                    "bluetooth" -> Settings.ACTION_BLUETOOTH_SETTINGS
                    else -> Settings.ACTION_SETTINGS
                }
                try { startActivity(Intent(a).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) } catch (e: Exception) { }
            }
        }
        @JavascriptInterface fun keepAwake(on: Boolean) {
            runOnUiThread {
                if (on) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            }
        }
        @JavascriptInterface fun grantAll() {
            runOnUiThread {
                allPerm.launch(arrayOf(Manifest.permission.RECORD_AUDIO, Manifest.permission.CAMERA,
                    Manifest.permission.READ_CONTACTS, Manifest.permission.CALL_PHONE, Manifest.permission.ACCESS_FINE_LOCATION))
            }
        }
        @JavascriptInterface fun callContact(name: String) {
            runOnUiThread {
                withPerms(arrayOf(Manifest.permission.READ_CONTACTS)) {
                    val c = findContact(name)
                    if (c == null) err("Контакт «$name» не найден.")
                    else confirm("Позвонить: ${c.first} (${c.second})?") {
                        val uri = Uri.parse("tel:" + Uri.encode(c.second))
                        val call = has(Manifest.permission.CALL_PHONE)
                        try { startActivity(Intent(if (call) Intent.ACTION_CALL else Intent.ACTION_DIAL, uri)) } catch (e: Exception) { err("Не удалось позвонить.") }
                    }
                }
            }
        }
        @JavascriptInterface fun sendSms(who: String, text: String) {
            runOnUiThread {
                fun open(num: String, label: String) = confirm("Открыть сообщение для $label?\n«$text»") {
                    try { startActivity(Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:" + Uri.encode(num))).putExtra("sms_body", text)) }
                    catch (e: Exception) { err("Не удалось открыть сообщения.") }
                }
                if (who.count { it.isDigit() } >= 5) open(who.filter { it.isDigit() || it == '+' }, who)
                else withPerms(arrayOf(Manifest.permission.READ_CONTACTS)) {
                    val c = findContact(who)
                    if (c == null) err("Контакт «$who» не найден.") else open(c.second, c.first)
                }
            }
        }
        @JavascriptInterface fun setTimer(sec: Int, label: String) {
            runOnUiThread {
                try {
                    startActivity(Intent(AlarmClock.ACTION_SET_TIMER).putExtra(AlarmClock.EXTRA_LENGTH, sec)
                        .putExtra(AlarmClock.EXTRA_MESSAGE, label).putExtra(AlarmClock.EXTRA_SKIP_UI, true))
                } catch (e: Exception) { err("Не удалось поставить таймер.") }
            }
        }
        @JavascriptInterface fun setAlarm(hour: Int, min: Int) {
            runOnUiThread {
                try {
                    startActivity(Intent(AlarmClock.ACTION_SET_ALARM).putExtra(AlarmClock.EXTRA_HOUR, hour)
                        .putExtra(AlarmClock.EXTRA_MINUTES, min).putExtra(AlarmClock.EXTRA_MESSAGE, "Вектор")
                        .putExtra(AlarmClock.EXTRA_SKIP_UI, true))
                } catch (e: Exception) { err("Не удалось поставить будильник.") }
            }
        }
        @JavascriptInterface fun addEvent(title: String) {
            runOnUiThread {
                try {
                    startActivity(Intent(Intent.ACTION_INSERT).setData(CalendarContract.Events.CONTENT_URI)
                        .putExtra(CalendarContract.Events.TITLE, title))
                } catch (e: Exception) { err("Календарь не найден.") }
            }
        }
        @JavascriptInterface fun media(cmd: String) {
            runOnUiThread {
                val code = when (cmd) {
                    "play" -> KeyEvent.KEYCODE_MEDIA_PLAY
                    "pause" -> KeyEvent.KEYCODE_MEDIA_PAUSE
                    "next" -> KeyEvent.KEYCODE_MEDIA_NEXT
                    else -> KeyEvent.KEYCODE_MEDIA_PREVIOUS
                }
                val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
                am.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, code))
                am.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_UP, code))
            }
        }
        @JavascriptInterface fun volume(dir: Int) {
            runOnUiThread {
                val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
                am.adjustStreamVolume(AudioManager.STREAM_MUSIC,
                    if (dir > 0) AudioManager.ADJUST_RAISE else AudioManager.ADJUST_LOWER, AudioManager.FLAG_SHOW_UI)
            }
        }
        @JavascriptInterface fun battery(): String {
            val bm = getSystemService(Context.BATTERY_SERVICE) as BatteryManager
            return bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY).toString() + "|" + (if (bm.isCharging) "1" else "0")
        }
        @JavascriptInterface fun takePhoto() {
            runOnUiThread { if (has(Manifest.permission.CAMERA)) doShoot() else camPerm.launch(Manifest.permission.CAMERA) }
        }
        @JavascriptInterface fun pickPhoto() {
            runOnUiThread { pick.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }
        }
    }

    override fun onDestroy() {
        recognizer?.destroy()
        tts?.shutdown()
        super.onDestroy()
    }
}
