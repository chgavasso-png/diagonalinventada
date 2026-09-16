package com.diagonalinventada.controleponto

import android.Manifest
import android.content.ContentValues
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.FileProvider
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import java.io.File

// URL do site já publicado. Trocar aqui se o domínio mudar.
private const val SITE_URL = "https://diagonalinventada.vercel.app/index.html"

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var splashOverlay: View

    // Callback pendente do <input type="file"> da página (foto de perfil).
    private var fileChooserCallback: ((Array<Uri>?) -> Unit)? = null
    private var cameraCaptureUri: Uri? = null

    private val cameraPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) abrirEscolhaDeArquivo() else abrirEscolhaDeArquivo(somenteGaleria = true)
        }

    // Só é solicitada em Android 9 (API 28) ou anterior — a partir do 10 (API
    // 29) o app grava em Downloads via MediaStore sem precisar de permissão.
    private var arquivoPendente: Triple<ByteArray, String, String>? = null
    private val storagePermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            val pendente = arquivoPendente
            arquivoPendente = null
            if (granted && pendente != null) {
                salvarNosDownloadsLegado(pendente.first, pendente.second, pendente.third)
            } else {
                Toast.makeText(this, "Permissão de armazenamento negada.", Toast.LENGTH_LONG).show()
            }
        }

    private val filePickerLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val callback = fileChooserCallback
            fileChooserCallback = null
            if (callback == null) return@registerForActivityResult

            val data = result.data
            if (result.resultCode != RESULT_OK) {
                callback(null)
                return@registerForActivityResult
            }

            val uris = when {
                data?.clipData != null -> {
                    val clip = data.clipData!!
                    Array(clip.itemCount) { i -> clip.getItemAt(i).uri }
                }
                data?.data != null -> arrayOf(data.data!!)
                cameraCaptureUri != null -> arrayOf(cameraCaptureUri!!)
                else -> null
            }
            callback(uris)
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        swipeRefresh = findViewById(R.id.swipeRefresh)
        splashOverlay = findViewById(R.id.splashOverlay)

        configurarWebView()
        webView.loadUrl(SITE_URL)

        swipeRefresh.setOnRefreshListener { webView.reload() }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack() else finish()
            }
        })
    }

    private fun configurarWebView() {
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.setSupportZoom(false)
        settings.builtInZoomControls = false
        settings.displayZoomControls = false

        // Ponte usada pelo site (js/admin.js -> salvarArquivoBlob) para salvar
        // os relatórios em Excel, já que um <a download> com blob: URL não
        // funciona dentro de uma WebView comum.
        webView.addJavascriptInterface(DownloadBridge(), "AndroidDownloadBridge")

        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                swipeRefresh.isRefreshing = false
                splashOverlay.visibility = View.GONE
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: android.webkit.ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                fileChooserCallback = { uris -> filePathCallback?.onReceiveValue(uris) }

                if (temPermissaoCamera()) {
                    abrirEscolhaDeArquivo()
                } else {
                    cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                }
                return true
            }
        }
    }

    private fun temPermissaoCamera(): Boolean =
        checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED

    // Abre um seletor único com as opções "Câmera" + "Galeria" para o <input type="file">.
    private fun abrirEscolhaDeArquivo(somenteGaleria: Boolean = false) {
        val galeriaIntent = Intent(Intent.ACTION_GET_CONTENT).apply {
            type = "image/*"
            putExtra(Intent.EXTRA_ALLOW_MULTIPLE, false)
        }

        val intents = mutableListOf<Intent>()
        if (!somenteGaleria) {
            criarUriDeCaptura()?.let { uri ->
                cameraCaptureUri = uri
                val cameraIntent = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
                    putExtra(MediaStore.EXTRA_OUTPUT, uri)
                    addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
                }
                intents.add(cameraIntent)
            }
        }

        val chooser = Intent.createChooser(galeriaIntent, "Escolher foto").apply {
            if (intents.isNotEmpty()) {
                putExtra(Intent.EXTRA_INITIAL_INTENTS, intents.toTypedArray())
            }
        }
        filePickerLauncher.launch(chooser)
    }

    private fun criarUriDeCaptura(): Uri? {
        return try {
            val dir = File(cacheDir, "captures").apply { mkdirs() }
            val file = File(dir, "captura_${System.currentTimeMillis()}.jpg")
            FileProvider.getUriForFile(this, "com.diagonalinventada.controleponto.fileprovider", file)
        } catch (e: Exception) {
            null
        }
    }

    // Recebe do JavaScript (salvarArquivoBlob em js/admin.js) o conteúdo do
    // relatório em Excel já em base64 e grava na pasta Downloads do aparelho.
    inner class DownloadBridge {
        @JavascriptInterface
        fun saveBase64File(base64DataUrl: String, filename: String, mimeType: String) {
            val base64Puro = base64DataUrl.substringAfter(",", base64DataUrl)
            val bytes = try {
                Base64.decode(base64Puro, Base64.DEFAULT)
            } catch (e: Exception) {
                null
            }
            runOnUiThread {
                if (bytes == null) {
                    Toast.makeText(this@MainActivity, "Erro ao preparar o arquivo.", Toast.LENGTH_LONG).show()
                    return@runOnUiThread
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    salvarNosDownloadsModerno(bytes, filename, mimeType)
                } else if (checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED) {
                    salvarNosDownloadsLegado(bytes, filename, mimeType)
                } else {
                    arquivoPendente = Triple(bytes, filename, mimeType)
                    storagePermissionLauncher.launch(Manifest.permission.WRITE_EXTERNAL_STORAGE)
                }
            }
        }
    }

    private fun salvarNosDownloadsModerno(bytes: ByteArray, filename: String, mimeType: String) {
        try {
            val values = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, filename)
                put(MediaStore.Downloads.MIME_TYPE, mimeType)
                put(MediaStore.Downloads.IS_PENDING, 1)
            }
            val uri = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
            if (uri == null) {
                Toast.makeText(this, "Não foi possível salvar o arquivo.", Toast.LENGTH_LONG).show()
                return
            }
            contentResolver.openOutputStream(uri)?.use { it.write(bytes) }
            values.clear()
            values.put(MediaStore.Downloads.IS_PENDING, 0)
            contentResolver.update(uri, values, null, null)
            Toast.makeText(this, "Salvo em Downloads: $filename", Toast.LENGTH_LONG).show()
        } catch (e: Exception) {
            Toast.makeText(this, "Erro ao salvar o arquivo.", Toast.LENGTH_LONG).show()
        }
    }

    @Suppress("DEPRECATION")
    private fun salvarNosDownloadsLegado(bytes: ByteArray, filename: String, mimeType: String) {
        try {
            val dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
            if (!dir.exists()) dir.mkdirs()
            File(dir, filename).writeBytes(bytes)
            Toast.makeText(this, "Salvo em Downloads: $filename", Toast.LENGTH_LONG).show()
        } catch (e: Exception) {
            Toast.makeText(this, "Erro ao salvar o arquivo.", Toast.LENGTH_LONG).show()
        }
    }
}
