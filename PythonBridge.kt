package com.mark.jarvis

import android.content.Context
import android.webkit.JavascriptInterface
import android.webkit.WebView
import com.chaquo.python.Python
import com.chaquo.python.android.AndroidPlatform
import org.json.JSONObject
import java.util.concurrent.Executors

/** Android-мост: WebView(JS) → Python-движок → C++ ядро (.so грузится из nativeLibraryDir). */
class PythonBridge(private val ctx: Context, private val web: WebView) {
    private val pool = Executors.newFixedThreadPool(2)
    private val py by lazy {
        if (!Python.isStarted()) Python.start(AndroidPlatform(ctx))
        val os = Python.getInstance().getModule("os")
        os.get("environ")!!.callAttr("__setitem__", "VEKTOR_LIB_DIR", ctx.applicationInfo.nativeLibraryDir)
        Python.getInstance().getModule("vektor.engine").also { it.callAttr("start", ctx.filesDir.absolutePath + "/vektor") }
    }
    @JavascriptInterface fun pyCall(id: Int, json: String) {
        pool.execute {
            val res = try { py.callAttr("call", json).toString() }
                      catch (e: Exception) { JSONObject().put("ok", false).put("e", e.message ?: "error").toString() }
            web.post { web.evaluateJavascript("window.__vk($id, ${JSONObject.quote(res)})", null) }
        }
    }
}
// В MainActivity рядом с web.addJavascriptInterface(Bridge(), "Android") добавьте:
//   web.addJavascriptInterface(PythonBridge(this, web), "Android")  // ← объедините методы с Bridge(): имя интерфейса одно.
// Проще: перенесите метод pyCall в существующий класс Bridge и создайте там PythonBridge-логику.
