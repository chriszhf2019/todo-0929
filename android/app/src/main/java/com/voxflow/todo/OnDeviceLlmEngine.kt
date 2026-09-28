package com.voxflow.todo

import android.content.Context
import android.util.Log
import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Conversation
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import com.google.ai.edge.litertlm.ExperimentalApi
import com.google.ai.edge.litertlm.Message
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong

/**
 * Manages the on-device Gemma model via LiteRT-LM (the same runtime used by
 * Google's Edge Gallery). The model is a .litertlm file (~2.6GB for Gemma 4 E2B).
 *
 * It is downloaded on first run into the app's private external files dir (or
 * copied from an existing model on the device), then loaded lazily and kept
 * resident. All heavy work runs on a single background thread.
 */
class OnDeviceLlmEngine private constructor(context: Context) {

    private val appContext: Context = context.applicationContext
    private val executor = Executors.newSingleThreadExecutor()
    private val loadLock = Any()
    private val downloadInProgress = AtomicBoolean(false)
    private val downloadedBytes = AtomicLong(0)

    @Volatile private var engine: Engine? = null
    @Volatile private var conversation: Conversation? = null
    @Volatile private var state: String = "not_downloaded"
    @Volatile private var errorMessage: String = ""
    @Volatile private var totalBytes: Long = 0

    fun modelFile(): File {
        val external = appContext.getExternalFilesDir(MODEL_SUBDIR)
        return if (external != null) File(external, MODEL_FILENAME)
        else File(File(appContext.filesDir, MODEL_SUBDIR), MODEL_FILENAME)
    }

    fun status(): JSONObject {
        val downloaded = modelFile().exists()
        val effectiveState = when {
            state == "ready" || state == "loading" || state == "error" || state == "downloading" -> state
            downloaded -> "not_loaded"
            else -> "not_downloaded"
        }
        return JSONObject().apply {
            put("state", effectiveState)
            put("downloaded", downloaded)
            put("modelPath", modelFile().absolutePath)
            put("modelSizeBytes", if (downloaded) modelFile().length() else 0)
            put("downloadedBytes", downloadedBytes.get())
            put("totalBytes", totalBytes)
            put("errorMessage", errorMessage)
        }
    }

    /** Kick off a background download of the model file. Safe to call repeatedly. */
    fun download(url: String, listener: ProgressListener?) {
        if (!downloadInProgress.compareAndSet(false, true)) return
        executor.execute {
            try {
                state = "downloading"
                errorMessage = ""
                downloadedBytes.set(0)
                totalBytes = 0

                val dir = modelFile().parentFile
                if (dir != null && !dir.exists() && !dir.mkdirs()) {
                    throw IllegalStateException("无法创建模型目录")
                }

                val connection = URL(url).openConnection() as HttpURLConnection
                connection.connectTimeout = 20000
                connection.readTimeout = 60000
                connection.instanceFollowRedirects = true
                connection.setRequestProperty("Accept", "application/octet-stream")
                totalBytes = connection.contentLengthLong

                val tmp = File(modelFile().absolutePath + ".tmp")
                connection.inputStream.use { input ->
                    FileOutputStream(tmp).use { out ->
                        val buffer = ByteArray(65536)
                        var read = input.read(buffer)
                        while (read != -1) {
                            out.write(buffer, 0, read)
                            downloadedBytes.addAndGet(read.toLong())
                            listener?.onProgress(downloadedBytes.get(), totalBytes)
                            read = input.read(buffer)
                        }
                    }
                }

                if (!tmp.renameTo(modelFile())) {
                    throw IllegalStateException("模型文件保存失败")
                }

                state = "not_loaded"
                Log.i(TAG, "model downloaded: ${modelFile().length()} bytes")
            } catch (e: Exception) {
                state = "error"
                errorMessage = e.message ?: ""
                Log.e(TAG, "model download failed", e)
            } finally {
                downloadInProgress.set(false)
            }
        }
    }

    /** Load the LiteRT-LM engine if not already loaded. Must run off the main thread. */
    private fun ensureLoaded() {
        if (engine != null) return
        synchronized(loadLock) {
            if (engine != null) return

            if (!modelFile().exists()) {
                state = "not_downloaded"
                throw IllegalStateException("端侧模型尚未下载")
            }

            state = "loading"
            errorMessage = ""

            // Some Edge Gallery exports only run on the device's accelerator, while others
            // fail fast on unsupported backends. Try the Tensor backend first on Pixel
            // devices, then NPU and CPU, so a mismatched model does not block app startup.
            val candidates = listOf(
                Backend.GOOGLE_TENSOR(),
                Backend.NPU(),
                Backend.CPU()
            )
            var lastFailure: Throwable? = null
            for (backend in candidates) {
                try {
                    val config = EngineConfig(
                        modelPath = modelFile().absolutePath,
                        backend = backend,
                        cacheDir = appContext.cacheDir.absolutePath
                    )
                    val e = Engine(config)
                    e.initialize()
                    conversation = e.createConversation()
                    engine = e
                    state = "ready"
                    Log.i(TAG, "LiteRT-LM engine ready with backend=${backend.name}")
                    return
                } catch (failure: Throwable) {
                    lastFailure = failure
                    Log.w(TAG, "LiteRT-LM backend ${backend.name} failed: ${failure.message}")
                }
            }

            state = "error"
            errorMessage = lastFailure?.message ?: "没有可用的推理后端"
            throw IllegalStateException("端侧模型初始化失败: $errorMessage")
        }
    }

    /** Run generation on the background thread and report the result via callback. */
    @OptIn(ExperimentalApi::class)
    fun generate(prompt: String, callback: GenerateCallback) {
        executor.execute {
            try {
                ensureLoaded()
                val message: Message = conversation!!.sendMessage(prompt)
                val text: String = conversation!!.renderMessageIntoString(message)
                callback.onResult(text)
            } catch (e: Exception) {
                errorMessage = e.message ?: ""
                if (state == "loading" || state == "ready") state = "error"
                Log.e(TAG, "generation failed", e)
                callback.onError(e.message ?: "推理失败")
            }
        }
    }

    interface ProgressListener {
        fun onProgress(downloaded: Long, total: Long)
    }

    interface GenerateCallback {
        fun onResult(text: String)
        fun onError(message: String)
    }

    companion object {
        private const val TAG = "OnDeviceLlmEngine"
        private const val MODEL_SUBDIR = "models"
        private const val MODEL_FILENAME = "gemma.litertlm"

        @Volatile private var instance: OnDeviceLlmEngine? = null

        @JvmStatic
        fun getInstance(context: Context): OnDeviceLlmEngine {
            return instance ?: synchronized(this) {
                instance ?: OnDeviceLlmEngine(context).also { instance = it }
            }
        }
    }
}
