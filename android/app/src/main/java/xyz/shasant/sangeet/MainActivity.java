package xyz.shasant.sangeet;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.ContentUris;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.Display;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.browser.customtabs.CustomTabsIntent;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.ResponseBody;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.RandomAccessFile;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class MainActivity extends AppCompatActivity {
    private static final String START_URL = "https://sangeet.shasant.xyz/home";
    private static final int REQ_AUDIO_PERMISSION = 103;
    private static final int MAX_SCAN_TRACKS = 1500;
    private static final int MAX_OFFLINE_AUDIO_BYTES = 40 * 1024 * 1024;
    // Multiple of 3 bytes so Base64 chunks encode cleanly (~256KB ASCII per chunk).
    private static final int AUDIO_CHUNK_RAW_BYTES = 196608;
    // 512KB parallel segments defeat YouTube single-stream rate throttling (4x-8x faster downloads)
    private static final long PARALLEL_CHUNK_BYTES = 512L * 1024L;
    private static final int PARALLEL_DOWNLOAD_CONCURRENCY = 4;
    private static final Pattern CONTENT_RANGE_TOTAL_PATTERN = Pattern.compile("/(\\d+)\\s*$");
    private static final OkHttpClient HTTP_CLIENT = YouTubeInnerTubeExtractor.getSharedMediaClient()
            .newBuilder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(25, TimeUnit.SECONDS)
            .callTimeout(60, TimeUnit.SECONDS)
            .followRedirects(true)
            .build();
    // Shared HTTP/2 pooled client with bounded idle read timeout for segmented & streaming downloads
    private static final OkHttpClient OFFLINE_DOWNLOAD_CLIENT = YouTubeInnerTubeExtractor.getSharedMediaClient()
            .newBuilder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(45, TimeUnit.SECONDS)
            .callTimeout(0, TimeUnit.SECONDS)
            .build();
    private final ExecutorService bridgeExecutor = Executors.newFixedThreadPool(4);
    private final ExecutorService chunkDownloadExecutor = Executors.newFixedThreadPool(PARALLEL_DOWNLOAD_CONCURRENCY);
    private final ConcurrentHashMap<String, FileOutputStream> offlineAudioWriters = new ConcurrentHashMap<>();
    private FrameLayout rootContainer;
    private WebView webView;
    private ValueCallback<Uri[]> fileUploadCallback;
    private ActivityResultLauncher<Intent> filePickerLauncher;
    private boolean wasAudioPermissionGranted = false;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Pre-warm YouTube DNS/TLS and visitor data off the UI thread immediately on launch
        YouTubeInnerTubeExtractor.warmUpAsync();

        if (Build.VERSION.SDK_INT >= 33) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.POST_NOTIFICATIONS}, 101);
            }
        }

        filePickerLauncher = registerForActivityResult(
                new ActivityResultContracts.StartActivityForResult(),
                result -> {
                    if (fileUploadCallback == null) return;
                    Uri[] uris = null;
                    if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
                        Intent data = result.getData();
                        if (data.getClipData() != null) {
                            int count = data.getClipData().getItemCount();
                            uris = new Uri[count];
                            for (int i = 0; i < count; i++) {
                                uris[i] = data.getClipData().getItemAt(i).getUri();
                            }
                        } else if (data.getData() != null) {
                            uris = new Uri[]{data.getData()};
                        }
                    }
                    fileUploadCallback.onReceiveValue(uris);
                    fileUploadCallback = null;
                }
        );

        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
        requestMaxDisplayRefreshRate();
        getWindow().setStatusBarColor(0xFF070A08);
        getWindow().setNavigationBarColor(0xFF070A08);
        WindowInsetsControllerCompat insetsController =
                WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (insetsController != null) {
            insetsController.setAppearanceLightStatusBars(false);
            insetsController.setAppearanceLightNavigationBars(false);
        }

        rootContainer = new FrameLayout(this);
        rootContainer.setBackgroundColor(0xFF070A08);
        webView = new WebView(this);
        webView.setBackgroundColor(0xFF070A08);
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        webView.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        wasAudioPermissionGranted = hasAudioPermissionInternal();
        rootContainer.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));
        setContentView(rootContainer);

        ViewCompat.setOnApplyWindowInsetsListener(rootContainer, (v, windowInsets) -> {
            Insets insets = windowInsets.getInsets(
                    WindowInsetsCompat.Type.systemBars()
                            | WindowInsetsCompat.Type.displayCutout()
                            | WindowInsetsCompat.Type.ime()
            );
            v.setPadding(insets.left, insets.top, insets.right, insets.bottom);
            return WindowInsetsCompat.CONSUMED;
        });
        ViewCompat.requestApplyInsets(rootContainer);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(false);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setTextZoom(108);

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        webView.addJavascriptInterface(new SangeetJsBridge(), "SangeetAndroid");

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(
                    WebView view,
                    ValueCallback<Uri[]> filePathCallback,
                    FileChooserParams fileChooserParams
            ) {
                if (fileUploadCallback != null) {
                    fileUploadCallback.onReceiveValue(null);
                }
                fileUploadCallback = filePathCallback;
                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("audio/*");
                intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                try {
                    filePickerLauncher.launch(Intent.createChooser(intent, "Select audio files"));
                } catch (Exception e) {
                    fileUploadCallback = null;
                    return false;
                }
                return true;
            }

            @Override
            public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> {
                    for (String res : request.getResources()) {
                        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(res)) {
                            if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA)
                                    != PackageManager.PERMISSION_GRANTED) {
                                ActivityCompat.requestPermissions(MainActivity.this, new String[]{Manifest.permission.CAMERA}, 102);
                            }
                            request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                            return;
                        }
                    }
                    request.deny();
                });
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String host = uri.getHost() != null ? uri.getHost() : "";
                String path = uri.getPath() != null ? uri.getPath() : "";
                if (host.endsWith("sangeet.shasant.xyz")) {
                    if (path.startsWith("/api/auth/google")) {
                        Uri targetUri = uri;
                        if (uri.getQueryParameter("app") == null) {
                            targetUri = uri.buildUpon().appendQueryParameter("app", "android").build();
                        }
                        openExternalUri(targetUri);
                        return true;
                    }
                    return false;
                }
                openExternalUri(uri);
                return true;
            }

            @Override
            public void onReceivedError(
                    WebView view,
                    WebResourceRequest request,
                    WebResourceError error
            ) {
                super.onReceivedError(view, request, error);
                if (request != null && request.isForMainFrame()) {
                    String currentUrl = view.getUrl();
                    if (currentUrl == null || !currentUrl.startsWith("file:///android_asset/offline.html")) {
                        view.loadUrl("file:///android_asset/offline.html");
                    }
                }
            }
        });

        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            if (url == null || url.isEmpty()) {
                return;
            }
            Uri parsedUri = Uri.parse(url);
            String scheme = parsedUri.getScheme() != null
                    ? parsedUri.getScheme().toLowerCase(Locale.ROOT)
                    : "";
            if (!"http".equals(scheme) && !"https".equals(scheme)) {
                String message = "blob".equals(scheme)
                        ? "Use Download for offline in Sangeet to save songs on Android."
                        : "Direct download for this link type is not supported on Android.";
                Toast.makeText(this, message, Toast.LENGTH_LONG).show();
                return;
            }
            try {
                DownloadManager.Request req = new DownloadManager.Request(parsedUri);
                if (mimeType != null && !mimeType.isEmpty()) {
                    req.setMimeType(mimeType);
                }
                if (userAgent != null && !userAgent.isEmpty()) {
                    req.addRequestHeader("User-Agent", userAgent);
                }
                String cookies = CookieManager.getInstance().getCookie(url);
                if (cookies != null && !cookies.isEmpty()) {
                    req.addRequestHeader("Cookie", cookies);
                }
                String filename = URLUtil.guessFileName(url, contentDisposition, mimeType);
                req.setTitle(filename);
                req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                req.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename);
                DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                if (dm != null) {
                    dm.enqueue(req);
                    Toast.makeText(this, "Downloading " + filename, Toast.LENGTH_SHORT).show();
                } else {
                    Toast.makeText(this, "Download service is unavailable.", Toast.LENGTH_SHORT).show();
                }
            } catch (Exception e) {
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, parsedUri));
                } catch (Exception ignored) {
                    Toast.makeText(this, "Could not start download.", Toast.LENGTH_SHORT).show();
                }
            }
        });

        SangeetAudioService.setEventListener(new SangeetAudioService.EventListener() {
            @Override
            public void onState(String state) {
                dispatchToWeb("state", state);
            }

            @Override
            public void onTime(double currentSec, double durationSec) {
                dispatchToWeb("time", currentSec + ":" + durationSec);
            }

            @Override
            public void onAction(String action) {
                dispatchToWeb(action, "");
            }

            @Override
            public void onError(String message) {
                dispatchToWeb("error", message);
            }

            @Override
            public void onTrackChanged(String trackId, int queueIndex) {
                try {
                    JSONObject obj = new JSONObject();
                    obj.put("trackId", trackId);
                    obj.put("queueIndex", queueIndex);
                    dispatchToWeb("track_changed", obj.toString());
                } catch (Exception ignored) {
                }
            }
        });

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView != null && webView.canGoBack()) {
                    webView.goBack();
                } else {
                    moveTaskToBack(true);
                }
            }
        });

        if (!handleAuthDeepLink(getIntent())) {
            webView.loadUrl(START_URL);
        }
    }

    private void requestMaxDisplayRefreshRate() {
        try {
            Display display = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                    ? getDisplay()
                    : getWindowManager().getDefaultDisplay();
            if (display == null) return;
            Display.Mode[] modes = display.getSupportedModes();
            if (modes == null || modes.length <= 1) return;
            Display.Mode current = display.getMode();
            Display.Mode best = current;
            for (Display.Mode mode : modes) {
                if (mode.getPhysicalWidth() == current.getPhysicalWidth()
                        && mode.getPhysicalHeight() == current.getPhysicalHeight()
                        && mode.getRefreshRate() > best.getRefreshRate()) {
                    best = mode;
                }
            }
            if (best.getModeId() != current.getModeId()) {
                WindowManager.LayoutParams params = getWindow().getAttributes();
                params.preferredDisplayModeId = best.getModeId();
                getWindow().setAttributes(params);
            }
        } catch (Exception ignored) {
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.resumeTimers();
        }
        // Sync active track & playback state back to WebView if native service auto-advanced in background
        SangeetAudioService.syncCurrentTrackToListener();
        boolean grantedNow = hasAudioPermissionInternal();
        if (!wasAudioPermissionGranted && grantedNow) {
            dispatchToWeb("audio_permission", "granted");
        }
        wasAudioPermissionGranted = grantedNow;
    }

    @Override
    public void onRequestPermissionsResult(
            int requestCode,
            @NonNull String[] permissions,
            @NonNull int[] grantResults
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_AUDIO_PERMISSION) {
            boolean granted = (grantResults.length > 0
                    && grantResults[0] == PackageManager.PERMISSION_GRANTED)
                    || hasAudioPermissionInternal();
            wasAudioPermissionGranted = granted;
            dispatchToWeb("audio_permission", granted ? "granted" : "denied");
        }
    }

    private boolean hasAudioPermissionInternal() {
        String perm = Build.VERSION.SDK_INT >= 33
                ? Manifest.permission.READ_MEDIA_AUDIO
                : Manifest.permission.READ_EXTERNAL_STORAGE;
        return ContextCompat.checkSelfPermission(this, perm) == PackageManager.PERMISSION_GRANTED;
    }

    @Override
    protected void onNewIntent(@NonNull Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleAuthDeepLink(intent);
    }

    private void openExternalUri(Uri uri) {
        try {
            new CustomTabsIntent.Builder().build().launchUrl(MainActivity.this, uri);
        } catch (Exception e) {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
            } catch (Exception ignored) {
            }
        }
    }

    private boolean handleAuthDeepLink(@Nullable Intent intent) {
        if (intent == null) return false;
        Uri data = intent.getData();
        if (data == null) return false;
        if (!"sangeet".equalsIgnoreCase(data.getScheme()) || !"auth".equalsIgnoreCase(data.getHost())) {
            return false;
        }
        String session = data.getQueryParameter("session");
        if (session == null || session.isEmpty()) {
            return false;
        }
        String returnTo = data.getQueryParameter("returnTo");
        if (returnTo == null || returnTo.isEmpty() || !returnTo.startsWith("/") || returnTo.startsWith("//")) {
            returnTo = "/home?google=success";
        }
        String yt = data.getQueryParameter("yt");
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setCookie(
                "https://sangeet.shasant.xyz",
                "sangeet_session=" + session + "; Path=/; Secure; HttpOnly; SameSite=Lax"
        );
        cookieManager.setCookie(
                "https://sangeet.shasant.xyz",
                "aura_session=" + session + "; Path=/; Secure; HttpOnly; SameSite=Lax"
        );
        if (yt != null && !yt.isEmpty()) {
            cookieManager.setCookie(
                    "https://sangeet.shasant.xyz",
                    "sangeet_yt_oauth=" + yt + "; Path=/; Secure; HttpOnly; SameSite=Lax"
            );
        }
        cookieManager.flush();
        if (webView != null) {
            webView.loadUrl("https://sangeet.shasant.xyz" + returnTo);
        }
        return true;
    }

    private void dispatchToWeb(String type, String payload) {
        if (webView == null || isFinishing() || isDestroyed()) return;
        final String js = "window.__sangeetAndroidEvent && window.__sangeetAndroidEvent("
                + JSONObject.quote(type) + ","
                + JSONObject.quote(payload != null ? payload : "") + ");";
        runOnUiThread(() -> {
            if (webView != null && !isFinishing() && !isDestroyed()) {
                webView.evaluateJavascript(js, null);
            }
        });
    }

    private void sendServiceAction(Intent intent) {
        if (SangeetAudioService.dispatchToRunningService(intent)) {
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ContextCompat.startForegroundService(this, intent);
        } else {
            startService(intent);
        }
    }

    private void sendControlAction(Intent intent) {
        if (SangeetAudioService.dispatchToRunningService(intent)) {
            return;
        }
        try {
            startService(intent);
        } catch (Exception ignored) {
        }
    }

    public final class SangeetJsBridge {
        @JavascriptInterface
        public boolean isNativeApp() {
            return true;
        }

        @JavascriptInterface
        public void setSystemTheme(String theme) {
            final boolean isLight = "light".equalsIgnoreCase(theme);
            final int bgColor = isLight ? 0xFFEEF7F1 : 0xFF070A08;
            runOnUiThread(() -> {
                if (isFinishing() || isDestroyed()) return;
                getWindow().setStatusBarColor(bgColor);
                getWindow().setNavigationBarColor(bgColor);
                WindowInsetsControllerCompat controller =
                        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
                if (controller != null) {
                    controller.setAppearanceLightStatusBars(isLight);
                    controller.setAppearanceLightNavigationBars(isLight);
                }
                if (rootContainer != null) {
                    rootContainer.setBackgroundColor(bgColor);
                }
                if (webView != null) {
                    webView.setBackgroundColor(bgColor);
                }
            });
        }

        @JavascriptInterface
        public void playYouTube(String videoId, String title, String artist, String artworkUrl) {
            Intent intent = new Intent(MainActivity.this, SangeetAudioService.class);
            intent.setAction(SangeetAudioService.ACTION_PLAY_YOUTUBE);
            intent.putExtra(SangeetAudioService.EXTRA_VIDEO_ID, videoId);
            intent.putExtra(SangeetAudioService.EXTRA_TITLE, title);
            intent.putExtra(SangeetAudioService.EXTRA_ARTIST, artist);
            intent.putExtra(SangeetAudioService.EXTRA_ARTWORK, artworkUrl);
            sendServiceAction(intent);
        }

        @JavascriptInterface
        public void prefetchYouTube(String videoId) {
            if (videoId == null || !videoId.matches("^[A-Za-z0-9_-]{11}$")) return;
            YouTubeInnerTubeExtractor.prefetch(videoId);
        }

        @JavascriptInterface
        public void playAudioUrl(String url, String title, String artist, String artworkUrl) {
            Intent intent = new Intent(MainActivity.this, SangeetAudioService.class);
            intent.setAction(SangeetAudioService.ACTION_PLAY_URL);
            intent.putExtra(SangeetAudioService.EXTRA_URL, url);
            intent.putExtra(SangeetAudioService.EXTRA_TITLE, title);
            intent.putExtra(SangeetAudioService.EXTRA_ARTIST, artist);
            intent.putExtra(SangeetAudioService.EXTRA_ARTWORK, artworkUrl);
            sendServiceAction(intent);
        }

        @JavascriptInterface
        public void playLocalContent(String contentUri, String title, String artist) {
            if (contentUri == null || contentUri.isEmpty()) return;
            Intent intent = new Intent(MainActivity.this, SangeetAudioService.class);
            intent.setAction(SangeetAudioService.ACTION_PLAY_URL);
            intent.putExtra(SangeetAudioService.EXTRA_URL, contentUri);
            intent.putExtra(SangeetAudioService.EXTRA_TITLE, title);
            intent.putExtra(SangeetAudioService.EXTRA_ARTIST, artist);
            sendServiceAction(intent);
        }

        @JavascriptInterface
        public boolean downloadAudioFile(String url, String filename, String mimeType) {
            if (url == null || url.trim().isEmpty()) return false;
            String safeName = filename == null ? "sangeet-track.mp3" : filename.trim()
                    .replaceAll("[\\\\/:*?\"<>|]+", "_")
                    .replaceAll("[\\r\\n\\t]", " ");
            if (safeName.isEmpty() || safeName.equals(".") || safeName.equals("..")) {
                safeName = "sangeet-track.mp3";
            }
            Uri source = Uri.parse(url.trim());
            String scheme = source.getScheme() == null ? "" : source.getScheme().toLowerCase(Locale.ROOT);
            String type = mimeType == null || mimeType.trim().isEmpty() ? "audio/mpeg" : mimeType.trim();

            if ("http".equals(scheme) || "https".equals(scheme)) {
                final String downloadName = safeName;
                try {
                    DownloadManager.Request request = new DownloadManager.Request(source);
                    request.setMimeType(type);
                    request.setTitle(downloadName);
                    request.setDescription("Downloading with Sangeet");
                    request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                    request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "Sangeet/" + downloadName);
                    String cookies = CookieManager.getInstance().getCookie(url);
                    if (cookies != null && !cookies.isEmpty()) request.addRequestHeader("Cookie", cookies);
                    DownloadManager manager = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                    if (manager == null) return false;
                    manager.enqueue(request);
                    runOnUiThread(() -> Toast.makeText(MainActivity.this,
                            "Downloading " + downloadName, Toast.LENGTH_SHORT).show());
                    return true;
                } catch (Exception e) {
                    return false;
                }
            }

            if (!"content".equals(scheme) || Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return false;
            String sourceMime = getContentResolver().getType(source);
            if (sourceMime != null && sourceMime.startsWith("audio/")) type = sourceMime;
            String extension = extensionForAudioMime(type);
            if (extension != null && !safeName.toLowerCase(Locale.ROOT).endsWith("." + extension)) {
                int dot = safeName.lastIndexOf('.');
                if (dot > 0) safeName = safeName.substring(0, dot);
                safeName = safeName + "." + extension;
            }
            final String outputName = safeName;
            final String outputMimeType = type;
            bridgeExecutor.execute(() -> copyContentAudioToDownloads(source, outputName, outputMimeType));
            return true;
        }

        @Nullable
        private String extensionForAudioMime(String mimeType) {
            String lower = mimeType == null ? "" : mimeType.toLowerCase(Locale.ROOT);
            if (lower.contains("mpeg")) return "mp3";
            if (lower.contains("mp4") || lower.contains("m4a") || lower.contains("aac")) return "m4a";
            if (lower.contains("flac")) return "flac";
            if (lower.contains("webm")) return "webm";
            if (lower.contains("opus")) return "opus";
            if (lower.contains("ogg")) return "ogg";
            if (lower.contains("wav")) return "wav";
            return null;
        }

        private String safeOfflineExtensionForMime(String mimeType) {
            String extension = extensionForAudioMime(mimeType);
            return extension != null && !extension.isEmpty() ? extension : "m4a";
        }

        @Nullable
        private InputStream openSourceAudioStream(Uri source) throws Exception {
            if ("file".equals(source.getScheme())) {
                String path = source.getPath();
                if (path == null || path.isEmpty()) {
                    throw new IllegalStateException("Missing audio file path.");
                }
                return new FileInputStream(new File(path));
            }
            return getContentResolver().openInputStream(source);
        }

        private void copyContentAudioToDownloads(Uri source, String filename, String mimeType) {
            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, filename);
            values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
            values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Sangeet");
            values.put(MediaStore.Downloads.IS_PENDING, 1);
            Uri destination = null;
            try {
                destination = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (destination == null) throw new IllegalStateException("Could not create download file.");
                try (InputStream input = openSourceAudioStream(source);
                     OutputStream output = getContentResolver().openOutputStream(destination)) {
                    if (input == null || output == null) throw new IllegalStateException("Could not open audio file.");
                    byte[] buffer = new byte[64 * 1024];
                    int count;
                    while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
                    output.flush();
                }
                ContentValues ready = new ContentValues();
                ready.put(MediaStore.Downloads.IS_PENDING, 0);
                getContentResolver().update(destination, ready, null, null);
                runOnUiThread(() -> Toast.makeText(MainActivity.this,
                        "Saved " + filename + " to Downloads/Sangeet", Toast.LENGTH_SHORT).show());
            } catch (Exception e) {
                if (destination != null) {
                    try { getContentResolver().delete(destination, null, null); } catch (Exception ignored) {}
                }
                runOnUiThread(() -> Toast.makeText(MainActivity.this,
                        "Could not save this audio file.", Toast.LENGTH_LONG).show());
            }
        }

        @JavascriptInterface
        public boolean beginOfflineAudioWrite(String trackId, String extension) {
            try {
                String key = offlineAudioKey(trackId);
                File directory = new File(getFilesDir(), "offline-audio");
                if (!directory.exists() && !directory.mkdirs()) return false;
                abortOfflineAudioWrite(trackId);
                File temporary = new File(directory, key + ".part");
                offlineAudioWriters.put(key, new FileOutputStream(temporary, false));
                String safeExtension = extension != null && extension.matches("[a-zA-Z0-9]{2,5}")
                        ? extension.toLowerCase(Locale.ROOT) : "m4a";
                SharedPreferences prefs = getSharedPreferences("offline-audio", MODE_PRIVATE);
                SharedPreferences.Editor editor = prefs.edit();
                String previousExtension = prefs.getString("ext_" + key, null);
                if (previousExtension != null && !previousExtension.equals(safeExtension)
                        && new File(directory, key + "." + previousExtension).isFile()) {
                    editor.putString("prev_ext_" + key, previousExtension);
                }
                editor.putString("ext_" + key, safeExtension).apply();
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public boolean writeOfflineAudioChunk(String trackId, String base64) {
            if (base64 == null || base64.isEmpty()) return false;
            try {
                FileOutputStream output = offlineAudioWriters.get(offlineAudioKey(trackId));
                if (output == null) return false;
                output.write(Base64.decode(base64, Base64.DEFAULT));
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public boolean finishOfflineAudioWrite(String trackId) {
            String key;
            try {
                key = offlineAudioKey(trackId);
                FileOutputStream output = offlineAudioWriters.remove(key);
                if (output == null) return false;
                output.flush();
                output.getFD().sync();
                output.close();
                File directory = new File(getFilesDir(), "offline-audio");
                File temporary = new File(directory, key + ".part");
                SharedPreferences prefs = getSharedPreferences("offline-audio", MODE_PRIVATE);
                String extension = prefs.getString("ext_" + key, "m4a");
                String previousExtension = prefs.getString("prev_ext_" + key, null);
                if (previousExtension != null && !previousExtension.equals(extension)) {
                    File oldFile = new File(directory, key + "." + previousExtension);
                    if (oldFile.exists()) oldFile.delete();
                }
                if (previousExtension != null) {
                    prefs.edit().remove("prev_ext_" + key).apply();
                }
                File destination = new File(directory, key + "." + extension);
                if (destination.exists() && !destination.delete()) return false;
                return temporary.length() > 0 && temporary.renameTo(destination);
            } catch (Exception e) {
                abortOfflineAudioWrite(trackId);
                return false;
            }
        }

        @JavascriptInterface
        public void abortOfflineAudioWrite(String trackId) {
            try {
                String key = offlineAudioKey(trackId);
                FileOutputStream output = offlineAudioWriters.remove(key);
                if (output != null) output.close();
                File temporary = new File(new File(getFilesDir(), "offline-audio"), key + ".part");
                if (temporary.exists()) temporary.delete();
            } catch (Exception ignored) {
            }
        }

        @JavascriptInterface
        public boolean playOfflineAudio(String trackId, String title, String artist, String artworkUrl) {
            try {
                String key = offlineAudioKey(trackId);
                String extension = getSharedPreferences("offline-audio", MODE_PRIVATE)
                        .getString("ext_" + key, "m4a");
                File audio = new File(new File(getFilesDir(), "offline-audio"), key + "." + extension);
                if (!audio.isFile() || audio.length() == 0) return false;
                Intent intent = new Intent(MainActivity.this, SangeetAudioService.class);
                intent.setAction(SangeetAudioService.ACTION_PLAY_URL);
                intent.putExtra(SangeetAudioService.EXTRA_URL, Uri.fromFile(audio).toString());
                intent.putExtra(SangeetAudioService.EXTRA_TITLE, title);
                intent.putExtra(SangeetAudioService.EXTRA_ARTIST, artist);
                intent.putExtra(SangeetAudioService.EXTRA_ARTWORK, artworkUrl);
                sendServiceAction(intent);
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public void removeOfflineAudio(String trackId) {
            try {
                String key = offlineAudioKey(trackId);
                FileOutputStream output = offlineAudioWriters.remove(key);
                if (output != null) output.close();
                File directory = new File(getFilesDir(), "offline-audio");
                File temporary = new File(directory, key + ".part");
                if (temporary.exists()) temporary.delete();
                String extension = getSharedPreferences("offline-audio", MODE_PRIVATE)
                        .getString("ext_" + key, "m4a");
                File saved = new File(directory, key + "." + extension);
                if (saved.exists()) saved.delete();
                getSharedPreferences("offline-audio", MODE_PRIVATE).edit().remove("ext_" + key).apply();
            } catch (Exception ignored) {
            }
        }

        @JavascriptInterface
        public boolean hasOfflineAudio(String trackId) {
            try {
                String key = offlineAudioKey(trackId);
                String extension = getSharedPreferences("offline-audio", MODE_PRIVATE)
                        .getString("ext_" + key, "m4a");
                File audio = new File(new File(getFilesDir(), "offline-audio"), key + "." + extension);
                return audio.isFile() && audio.length() > 0;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public boolean exportOfflineAudio(String trackId, String filename) {
            try {
                String key = offlineAudioKey(trackId);
                String extension = getSharedPreferences("offline-audio", MODE_PRIVATE)
                        .getString("ext_" + key, "m4a");
                File audio = new File(new File(getFilesDir(), "offline-audio"), key + "." + extension);
                if (!audio.isFile() || audio.length() == 0) {
                    return false;
                }
                String rawName = filename == null ? "" : filename.trim()
                        .replaceAll("[\\\\/:*?\"<>|]+", "_")
                        .replaceAll("[\\r\\n\\t]", " ")
                        .trim();
                String baseName = rawName.replaceFirst("\\.[a-zA-Z0-9]{2,5}$", "");
                if (baseName.isEmpty()) {
                    baseName = "sangeet-track";
                }
                String safeName = baseName + "." + extension;
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
                    bridgeExecutor.execute(() -> {
                        File target = new File(
                                Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
                                "Sangeet/" + safeName);
                        try {
                            File parent = target.getParentFile();
                            if (parent != null && !parent.exists() && !parent.mkdirs()) {
                                throw new IllegalStateException("Could not create Downloads/Sangeet folder.");
                            }
                            try (InputStream input = new FileInputStream(audio);
                                 OutputStream output = new FileOutputStream(target, false)) {
                                byte[] buffer = new byte[64 * 1024];
                                int count;
                                while ((count = input.read(buffer)) != -1) {
                                    output.write(buffer, 0, count);
                                }
                                output.flush();
                            }
                            runOnUiThread(() -> Toast.makeText(MainActivity.this,
                                    "Saved " + safeName + " to Downloads/Sangeet", Toast.LENGTH_SHORT).show());
                        } catch (Exception e) {
                            if (target.exists()) {
                                try { target.delete(); } catch (Exception ignored) {}
                            }
                            runOnUiThread(() -> Toast.makeText(MainActivity.this,
                                    "Could not save this audio file.", Toast.LENGTH_LONG).show());
                        }
                    });
                    return true;
                }
                bridgeExecutor.execute(() -> copyContentAudioToDownloads(
                        Uri.fromFile(audio), safeName, mimeTypeForAudioExtension(extension)));
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        private String mimeTypeForAudioExtension(String extension) {
            switch (extension.toLowerCase(Locale.ROOT)) {
                case "mp3": return "audio/mpeg";
                case "webm": return "audio/webm";
                case "ogg":
                case "opus": return "audio/ogg";
                case "flac": return "audio/flac";
                case "wav": return "audio/wav";
                default: return "audio/mp4";
            }
        }

        private String offlineAudioKey(String trackId) throws Exception {
            if (trackId == null || trackId.trim().isEmpty()) throw new IllegalArgumentException("Missing track ID");
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(trackId.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder key = new StringBuilder(digest.length * 2);
            for (byte value : digest) key.append(String.format(Locale.ROOT, "%02x", value & 0xff));
            return key.toString();
        }

        @JavascriptInterface
        public void pause() {
            Intent intent = new Intent(MainActivity.this, SangeetAudioService.class);
            intent.setAction(SangeetAudioService.ACTION_PAUSE);
            sendControlAction(intent);
        }

        @JavascriptInterface
        public void resume() {
            Intent intent = new Intent(MainActivity.this, SangeetAudioService.class);
            intent.setAction(SangeetAudioService.ACTION_RESUME);
            sendServiceAction(intent);
        }

        @JavascriptInterface
        public void seekTo(double seconds) {
            Intent intent = new Intent(MainActivity.this, SangeetAudioService.class);
            intent.setAction(SangeetAudioService.ACTION_SEEK);
            intent.putExtra(SangeetAudioService.EXTRA_SEEK_MS, (long) (seconds * 1000));
            sendControlAction(intent);
        }

        @JavascriptInterface
        public void stop() {
            Intent intent = new Intent(MainActivity.this, SangeetAudioService.class);
            intent.setAction(SangeetAudioService.ACTION_STOP);
            sendControlAction(intent);
        }

        @JavascriptInterface
        public void setVolume(double volume) {
            Intent intent = new Intent(MainActivity.this, SangeetAudioService.class);
            intent.setAction(SangeetAudioService.ACTION_VOLUME);
            intent.putExtra(SangeetAudioService.EXTRA_VOLUME, (float) volume);
            sendControlAction(intent);
        }

        @JavascriptInterface
        public void setPlaybackRate(double rate) {
            Intent intent = new Intent(MainActivity.this, SangeetAudioService.class);
            intent.setAction(SangeetAudioService.ACTION_SPEED);
            intent.putExtra(SangeetAudioService.EXTRA_SPEED, (float) rate);
            sendControlAction(intent);
        }

        @JavascriptInterface
        public void syncQueue(
                String queueJson,
                int currentIndex,
                boolean repeatOne,
                boolean repeatAll,
                boolean sleepAfterTrack
        ) {
            if (queueJson == null || queueJson.isEmpty()) return;
            Intent intent = new Intent(MainActivity.this, SangeetAudioService.class);
            intent.setAction(SangeetAudioService.ACTION_SYNC_QUEUE);
            intent.putExtra(SangeetAudioService.EXTRA_QUEUE_JSON, queueJson);
            intent.putExtra(SangeetAudioService.EXTRA_QUEUE_INDEX, currentIndex);
            intent.putExtra(SangeetAudioService.EXTRA_REPEAT_ONE, repeatOne);
            intent.putExtra(SangeetAudioService.EXTRA_REPEAT_ALL, repeatAll);
            intent.putExtra(SangeetAudioService.EXTRA_SLEEP_AFTER_TRACK, sleepAfterTrack);
            sendControlAction(intent);
        }

        @JavascriptInterface
        public boolean hasAudioPermission() {
            return hasAudioPermissionInternal();
        }

        @JavascriptInterface
        public void reloadOnline() {
            runOnUiThread(() -> {
                if (webView != null) {
                    webView.loadUrl(START_URL);
                }
            });
        }

        @JavascriptInterface
        public void requestAudioPermission() {
            if (hasAudioPermissionInternal()) {
                wasAudioPermissionGranted = true;
                dispatchToWeb("audio_permission", "granted");
                return;
            }
            String perm = Build.VERSION.SDK_INT >= 33
                    ? Manifest.permission.READ_MEDIA_AUDIO
                    : Manifest.permission.READ_EXTERNAL_STORAGE;
            runOnUiThread(() -> ActivityCompat.requestPermissions(
                    MainActivity.this,
                    new String[]{perm},
                    REQ_AUDIO_PERMISSION
            ));
        }

        @JavascriptInterface
        public String scanLocalAudio() {
            if (!hasAudioPermissionInternal()) {
                return "[]";
            }
            JSONArray results = new JSONArray();
            Set<Long> seenIds = new HashSet<>();
            List<String> projectionList = new ArrayList<>();
            projectionList.add(MediaStore.Audio.Media._ID);
            projectionList.add(MediaStore.Audio.Media.TITLE);
            projectionList.add(MediaStore.Audio.Media.ARTIST);
            projectionList.add(MediaStore.Audio.Media.ALBUM);
            projectionList.add(MediaStore.Audio.Media.DURATION);
            projectionList.add(MediaStore.Audio.Media.DISPLAY_NAME);
            projectionList.add(MediaStore.Audio.Media.MIME_TYPE);
            projectionList.add(MediaStore.Audio.Media.IS_MUSIC);
            projectionList.add(MediaStore.Audio.Media.IS_RINGTONE);
            projectionList.add(MediaStore.Audio.Media.IS_ALARM);
            projectionList.add(MediaStore.Audio.Media.IS_NOTIFICATION);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                projectionList.add(MediaStore.Audio.Media.RELATIVE_PATH);
            } else {
                projectionList.add(MediaStore.Audio.Media.DATA);
            }
            String[] projection = projectionList.toArray(new String[0]);

            // Only real music: exclude ringtones, alarms, notifications, and clips shorter than 15s
            String selection = "("
                    + MediaStore.Audio.Media.IS_MUSIC + " != 0"
                    + " OR " + MediaStore.Audio.Media.MIME_TYPE + " LIKE 'audio/%'"
                    + " OR LOWER(" + MediaStore.Audio.Media.DISPLAY_NAME + ") LIKE '%.mp3'"
                    + " OR LOWER(" + MediaStore.Audio.Media.DISPLAY_NAME + ") LIKE '%.m4a'"
                    + " OR LOWER(" + MediaStore.Audio.Media.DISPLAY_NAME + ") LIKE '%.aac'"
                    + " OR LOWER(" + MediaStore.Audio.Media.DISPLAY_NAME + ") LIKE '%.wav'"
                    + " OR LOWER(" + MediaStore.Audio.Media.DISPLAY_NAME + ") LIKE '%.flac'"
                    + " OR LOWER(" + MediaStore.Audio.Media.DISPLAY_NAME + ") LIKE '%.ogg'"
                    + " OR LOWER(" + MediaStore.Audio.Media.DISPLAY_NAME + ") LIKE '%.opus'"
                    + ") AND " + MediaStore.Audio.Media.IS_RINGTONE + " = 0"
                    + " AND " + MediaStore.Audio.Media.IS_ALARM + " = 0"
                    + " AND " + MediaStore.Audio.Media.IS_NOTIFICATION + " = 0"
                    + " AND (" + MediaStore.Audio.Media.DURATION + " IS NULL OR " + MediaStore.Audio.Media.DURATION + " >= 15000)";
            String sortOrder = MediaStore.Audio.Media.TITLE + " ASC";

            queryAudioCollection(
                    MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
                    projection,
                    selection,
                    sortOrder,
                    false,
                    results,
                    seenIds
            );

            if (results.length() == 0 && Build.VERSION.SDK_INT >= 29) {
                Uri volumeExternalUri = MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL);
                queryAudioCollection(
                        volumeExternalUri,
                        projection,
                        null,
                        sortOrder,
                        true,
                        results,
                        seenIds
                );
            } else if (results.length() == 0) {
                queryAudioCollection(
                        MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
                        projection,
                        null,
                        sortOrder,
                        true,
                        results,
                        seenIds
                );
            }

            return results.toString();
        }

        @JavascriptInterface
        public void downloadYouTubeAudioToOffline(String requestId, String trackId, String videoId) {
            final String reqId = requestId != null ? requestId.trim() : "";
            final String track = trackId != null ? trackId.trim() : "";
            final String vid = videoId != null ? videoId.trim() : "";
            if (reqId.isEmpty() || track.isEmpty() || !vid.matches("^[A-Za-z0-9_-]{11}$")) {
                sendOfflineAudioError(reqId, "Invalid offline audio request.");
                return;
            }

            bridgeExecutor.execute(() -> {
                sendOfflineAudioProgress(reqId, 2);
                String lastError = "Could not extract audio stream from YouTube.";
                try {
                    Set<String> triedUserAgents = new HashSet<>();
                    YouTubeInnerTubeExtractor.StreamResult candidate =
                            YouTubeInnerTubeExtractor.extractFast(vid);
                    if (candidate != null && candidate.isHls()) {
                        triedUserAgents.add(candidate.userAgent);
                        candidate = YouTubeInnerTubeExtractor.extractFallback(vid, triedUserAgents, true);
                    }

                    boolean attemptedCandidate = false;
                    for (int attempt = 0; attempt < 3 && candidate != null; attempt++) {
                        if (candidate.url != null && !candidate.url.isEmpty() && !candidate.isHls()) {
                            attemptedCandidate = true;
                            triedUserAgents.add(candidate.userAgent);
                            try {
                                long size = downloadAudioCandidateToOffline(
                                        track,
                                        reqId,
                                        candidate.url,
                                        candidate.userAgent,
                                        candidate.contentLength
                                );
                                JSONObject payload = new JSONObject();
                                payload.put("requestId", reqId);
                                payload.put("sizeBytes", size);
                                dispatchToWeb("offline_audio_saved", payload.toString());
                                return;
                            } catch (Exception candidateError) {
                                String message = candidateError.getMessage();
                                if (message != null && !message.isEmpty()) lastError = message;
                                YouTubeInnerTubeExtractor.invalidateCache(vid);
                            }
                        }
                        candidate = YouTubeInnerTubeExtractor.extractFallback(vid, triedUserAgents, true);
                    }
                    sendOfflineAudioError(
                            reqId,
                            attemptedCandidate ? lastError : "No downloadable audio stream was found for this track.");
                } catch (Exception e) {
                    String message = e.getMessage();
                    sendOfflineAudioError(reqId, message != null && !message.isEmpty()
                            ? message : "Offline download failed on Android.");
                }
            });
        }

        private long downloadAudioCandidateToOffline(
                String trackId,
                String requestId,
                String url,
                @Nullable String userAgent,
                long knownContentLength
        ) throws Exception {
            String key = offlineAudioKey(trackId);
            File directory = new File(getFilesDir(), "offline-audio");
            if (!directory.exists() && !directory.mkdirs()) {
                throw new IllegalStateException("Could not create offline music folder.");
            }
            File temporary = new File(directory, key + ".part");
            try {
                // Probe with the first 512KB Range request: fetches chunk 0 immediately AND learns
                // total length + 206 support in one round-trip, avoiding a wasted HEAD request.
                long firstEnd = (knownContentLength > 0 && knownContentLength < PARALLEL_CHUNK_BYTES)
                        ? (knownContentLength - 1)
                        : (PARALLEL_CHUNK_BYTES - 1);
                Request.Builder probeBuilder = new Request.Builder()
                        .url(url)
                        .header("Accept", "*/*")
                        .header("Range", "bytes=0-" + firstEnd);
                if (userAgent != null && !userAgent.isEmpty()) {
                    probeBuilder.header("User-Agent", userAgent);
                }

                String mime;
                long totalReceived;

                try (Response probeRes = OFFLINE_DOWNLOAD_CLIENT.newCall(probeBuilder.build()).execute()) {
                    if (!probeRes.isSuccessful()) {
                        throw new IllegalStateException("YouTube audio source returned HTTP " + probeRes.code());
                    }
                    ResponseBody probeBody = probeRes.body();
                    if (probeBody == null) {
                        throw new IllegalStateException("The audio source returned an empty response.");
                    }
                    mime = normalizeAudioMimeType(probeRes.header("Content-Type"), url);
                    if (mime == null) {
                        throw new IllegalStateException("The audio source returned an unsupported file.");
                    }

                    long totalLength = parseTotalLengthFromRange(probeRes.header("Content-Range"));
                    if (totalLength <= 0 && knownContentLength > 0 && probeRes.code() == 206) {
                        totalLength = knownContentLength;
                    }
                    if (totalLength > MAX_OFFLINE_AUDIO_BYTES) {
                        throw new IllegalStateException("Audio file exceeds 40MB offline limit.");
                    }

                    if (probeRes.code() == 206 && totalLength > PARALLEL_CHUNK_BYTES && totalLength <= MAX_OFFLINE_AUDIO_BYTES) {
                        // Fast path: write chunk 0, then blast remaining 512KB segments across 4 parallel HTTP/2 streams!
                        byte[] firstChunk = probeBody.bytes();
                        if (firstChunk.length == 0) {
                            throw new IllegalStateException("Downloaded audio chunk was empty.");
                        }

                        final long fileTotal = totalLength;
                        final AtomicLong receivedAtomic = new AtomicLong(firstChunk.length);
                        final AtomicInteger lastPct = new AtomicInteger(
                                (int) Math.min(98, Math.max(2, firstChunk.length * 100L / fileTotal))
                        );
                        sendOfflineAudioProgress(requestId, lastPct.get());

                        try (RandomAccessFile raf = new RandomAccessFile(temporary, "rw")) {
                            raf.setLength(fileTotal);
                            raf.seek(0);
                            raf.write(firstChunk);
                        }

                        List<long[]> ranges = new ArrayList<>();
                        for (long start = firstChunk.length; start < fileTotal; start += PARALLEL_CHUNK_BYTES) {
                            long end = Math.min(fileTotal - 1, start + PARALLEL_CHUNK_BYTES - 1);
                            ranges.add(new long[]{start, end});
                        }

                        List<Future<?>> tasks = new ArrayList<>(ranges.size());
                        for (long[] range : ranges) {
                            final long start = range[0];
                            final long end = range[1];
                            tasks.add(chunkDownloadExecutor.submit(() -> {
                                downloadRangeSegment(
                                        temporary,
                                        url,
                                        userAgent,
                                        start,
                                        end,
                                        fileTotal,
                                        requestId,
                                        receivedAtomic,
                                        lastPct
                                );
                                return null;
                            }));
                        }

                        Exception chunkFailure = null;
                        for (Future<?> task : tasks) {
                            try {
                                task.get();
                            } catch (Exception e) {
                                if (chunkFailure == null) chunkFailure = e;
                                for (Future<?> remaining : tasks) remaining.cancel(true);
                            }
                        }
                        if (chunkFailure != null) {
                            throw chunkFailure;
                        }
                        totalReceived = receivedAtomic.get();
                    } else {
                        // Fallback single-stream path (either tiny file <= 512KB or upstream ignored Range)
                        long expected = probeBody.contentLength();
                        if (expected > MAX_OFFLINE_AUDIO_BYTES) {
                            throw new IllegalStateException("Audio file exceeds 40MB offline limit.");
                        }
                        long received = 0;
                        long lastHeartbeatAt = System.currentTimeMillis();
                        int lastProgress = -1;
                        try (InputStream input = probeBody.byteStream();
                             FileOutputStream output = new FileOutputStream(temporary, false)) {
                            byte[] buffer = new byte[64 * 1024];
                            int count;
                            while ((count = input.read(buffer)) != -1) {
                                if (isFinishing() || isDestroyed()) throw new IllegalStateException("Download cancelled.");
                                received += count;
                                if (received > MAX_OFFLINE_AUDIO_BYTES) {
                                    throw new IllegalStateException("Audio file exceeds 40MB offline limit.");
                                }
                                output.write(buffer, 0, count);
                                long now = System.currentTimeMillis();
                                if (expected > 0) {
                                    int progress = (int) Math.min(99, Math.max(2, received * 100L / expected));
                                    if (progress >= lastProgress + 3 || progress == 99) {
                                        lastProgress = progress;
                                        sendOfflineAudioProgress(requestId, progress);
                                        lastHeartbeatAt = now;
                                    } else if (now - lastHeartbeatAt >= 2000) {
                                        sendOfflineAudioProgress(requestId, Math.max(2, progress));
                                        lastHeartbeatAt = now;
                                    }
                                } else if (now - lastHeartbeatAt >= 2000) {
                                    sendOfflineAudioProgress(requestId, 10);
                                    lastHeartbeatAt = now;
                                }
                            }
                            output.flush();
                            output.getFD().sync();
                        }
                        totalReceived = received;
                    }
                }

                if (totalReceived <= 0) throw new IllegalStateException("Downloaded audio file was empty.");
                String extension = safeOfflineExtensionForMime(mime);
                SharedPreferences prefs = getSharedPreferences("offline-audio", MODE_PRIVATE);
                String previousExtension = prefs.getString("ext_" + key, null);
                if (previousExtension != null && !previousExtension.equals(extension)) {
                    File oldFile = new File(directory, key + "." + previousExtension);
                    if (oldFile.exists()) oldFile.delete();
                }
                File destination = new File(directory, key + "." + extension);
                if (destination.exists() && !destination.delete()) {
                    throw new IllegalStateException("Could not replace the saved offline song.");
                }
                if (!temporary.renameTo(destination)) {
                    throw new IllegalStateException("Could not finish saving the offline song.");
                }
                prefs.edit().putString("ext_" + key, extension).remove("prev_ext_" + key).apply();
                return totalReceived;
            } catch (Exception e) {
                if (temporary.exists()) temporary.delete();
                throw e;
            }
        }

        private void downloadRangeSegment(
                File targetFile,
                String url,
                @Nullable String userAgent,
                long start,
                long end,
                long fileTotal,
                String requestId,
                AtomicLong receivedAtomic,
                AtomicInteger lastPct
        ) throws Exception {
            Exception lastErr = null;
            for (int retry = 0; retry < 2; retry++) {
                if (isFinishing() || isDestroyed() || Thread.currentThread().isInterrupted()) {
                    throw new IllegalStateException("Download cancelled.");
                }
                Request.Builder reqBuilder = new Request.Builder()
                        .url(url)
                        .header("Accept", "*/*")
                        .header("Range", "bytes=" + start + "-" + end);
                if (userAgent != null && !userAgent.isEmpty()) {
                    reqBuilder.header("User-Agent", userAgent);
                }
                try (Response res = OFFLINE_DOWNLOAD_CLIENT.newCall(reqBuilder.build()).execute()) {
                    if (res.code() != 206 && !res.isSuccessful()) {
                        throw new IllegalStateException("Range segment HTTP " + res.code());
                    }
                    ResponseBody body = res.body();
                    if (body == null) throw new IllegalStateException("Empty range segment.");
                    byte[] data = body.bytes();
                    long expectedLen = end - start + 1;
                    if (data.length != expectedLen) {
                        throw new IllegalStateException("Short range read: " + data.length + " vs " + expectedLen);
                    }
                    try (RandomAccessFile raf = new RandomAccessFile(targetFile, "rw")) {
                        raf.seek(start);
                        raf.write(data);
                    }
                    long totalNow = receivedAtomic.addAndGet(data.length);
                    int pct = (int) Math.min(99, Math.max(2, totalNow * 100L / fileTotal));
                    int prev = lastPct.get();
                    if ((pct >= prev + 2 || pct == 99) && lastPct.compareAndSet(prev, pct)) {
                        sendOfflineAudioProgress(requestId, pct);
                    }
                    return;
                } catch (Exception e) {
                    lastErr = e;
                }
            }
            throw lastErr != null ? lastErr : new IllegalStateException("Segment download failed.");
        }

        private long parseTotalLengthFromRange(@Nullable String contentRange) {
            if (contentRange == null || contentRange.isEmpty()) return -1L;
            Matcher m = CONTENT_RANGE_TOTAL_PATTERN.matcher(contentRange);
            if (!m.find()) return -1L;
            try {
                long total = Long.parseLong(m.group(1));
                return total > 0 ? total : -1L;
            } catch (Exception ignored) {
                return -1L;
            }
        }

        @JavascriptInterface
        public void fetchYouTubeAudioBase64(String requestId, String videoId) {
            final String reqId = requestId != null ? requestId.trim() : "";
            final String vid = videoId != null ? videoId.trim() : "";
            if (reqId.isEmpty()) {
                return;
            }
            if (!vid.matches("^[A-Za-z0-9_-]{11}$")) {
                sendOfflineAudioError(reqId, "Invalid YouTube video ID.");
                return;
            }

            bridgeExecutor.execute(() -> {
                try {
                    List<YouTubeInnerTubeExtractor.StreamResult> candidates =
                            YouTubeInnerTubeExtractor.extractAll(vid);
                    if (candidates == null || candidates.isEmpty()) {
                        sendOfflineAudioError(reqId, "Could not extract audio stream from YouTube.");
                        return;
                    }

                    DownloadedAudioPayload downloaded = null;
                    String lastError = "Could not download YouTube audio stream.";

                    for (YouTubeInnerTubeExtractor.StreamResult candidate : candidates) {
                        if (candidate == null || candidate.url == null || candidate.url.isEmpty()) {
                            continue;
                        }
                        String lowerUrl = candidate.url.toLowerCase(Locale.ROOT);
                        if (lowerUrl.contains(".m3u8") || lowerUrl.contains("hls_playlist")) {
                            continue;
                        }
                        try {
                            downloaded = downloadAudioCandidate(reqId, candidate.url, candidate.userAgent);
                            if (downloaded != null && downloaded.bytes.length > 0) {
                                break;
                            }
                        } catch (Exception candidateError) {
                            String msg = candidateError.getMessage();
                            if (msg != null && !msg.isEmpty()) {
                                lastError = msg;
                            }
                        }
                    }

                    if (downloaded == null || downloaded.bytes.length == 0) {
                        sendOfflineAudioError(reqId, lastError);
                        return;
                    }

                    byte[] audioBytes = downloaded.bytes;
                    String mimeType = downloaded.mimeType;
                    int totalBytes = audioBytes.length;
                    int totalChunks = (totalBytes + AUDIO_CHUNK_RAW_BYTES - 1) / AUDIO_CHUNK_RAW_BYTES;
                    if (totalChunks <= 0) {
                        sendOfflineAudioError(reqId, "Downloaded audio file was empty.");
                        return;
                    }

                    for (int index = 0; index < totalChunks; index++) {
                        if (isFinishing() || isDestroyed()) {
                            return;
                        }
                        int offset = index * AUDIO_CHUNK_RAW_BYTES;
                        int len = Math.min(AUDIO_CHUNK_RAW_BYTES, totalBytes - offset);
                        String chunkB64 = Base64.encodeToString(audioBytes, offset, len, Base64.NO_WRAP);
                        JSONObject payload = new JSONObject();
                        payload.put("requestId", reqId);
                        payload.put("index", index);
                        payload.put("total", totalChunks);
                        payload.put("mimeType", mimeType);
                        payload.put("chunk", chunkB64);
                        dispatchToWeb("offline_audio_chunk", payload.toString());
                    }
                } catch (Exception e) {
                    String msg = e.getMessage();
                    sendOfflineAudioError(
                            reqId,
                            msg != null && !msg.isEmpty() ? msg : "Offline download failed on Android."
                    );
                }
            });
        }
    }

    private void queryAudioCollection(
            Uri collectionUri,
            String[] projection,
            @Nullable String selection,
            @Nullable String sortOrder,
            boolean filterInJava,
            JSONArray results,
            Set<Long> seenIds
    ) {
        Cursor cursor = null;
        try {
            cursor = getContentResolver().query(
                    collectionUri,
                    projection,
                    selection,
                    null,
                    sortOrder
            );
        } catch (Exception e) {
            if (sortOrder != null) {
                try {
                    cursor = getContentResolver().query(
                            collectionUri,
                            projection,
                            selection,
                            null,
                            null
                    );
                } catch (Exception ignored) {
                }
            }
        }
        if (cursor == null) {
            return;
        }
        try (Cursor managedCursor = cursor) {
            int idCol = managedCursor.getColumnIndex(MediaStore.Audio.Media._ID);
            if (idCol == -1) {
                return;
            }
            int titleCol = managedCursor.getColumnIndex(MediaStore.Audio.Media.TITLE);
            int artistCol = managedCursor.getColumnIndex(MediaStore.Audio.Media.ARTIST);
            int albumCol = managedCursor.getColumnIndex(MediaStore.Audio.Media.ALBUM);
            int durationCol = managedCursor.getColumnIndex(MediaStore.Audio.Media.DURATION);
            int displayNameCol = managedCursor.getColumnIndex(MediaStore.Audio.Media.DISPLAY_NAME);
            int mimeCol = managedCursor.getColumnIndex(MediaStore.Audio.Media.MIME_TYPE);
            int isMusicCol = managedCursor.getColumnIndex(MediaStore.Audio.Media.IS_MUSIC);
            int isRingtoneCol = managedCursor.getColumnIndex(MediaStore.Audio.Media.IS_RINGTONE);
            int isAlarmCol = managedCursor.getColumnIndex(MediaStore.Audio.Media.IS_ALARM);
            int isNotificationCol = managedCursor.getColumnIndex(MediaStore.Audio.Media.IS_NOTIFICATION);
            int pathCol = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                    ? managedCursor.getColumnIndex(MediaStore.Audio.Media.RELATIVE_PATH)
                    : managedCursor.getColumnIndex(MediaStore.Audio.Media.DATA);

            while (managedCursor.moveToNext() && results.length() < MAX_SCAN_TRACKS) {
                long id = managedCursor.getLong(idCol);
                if (id < 0 || seenIds.contains(id)) {
                    continue;
                }

                String mimeType = mimeCol >= 0 ? managedCursor.getString(mimeCol) : null;
                String displayName = displayNameCol >= 0 ? managedCursor.getString(displayNameCol) : null;
                int isMusic = isMusicCol >= 0 ? managedCursor.getInt(isMusicCol) : 0;
                int isRingtone = isRingtoneCol >= 0 ? managedCursor.getInt(isRingtoneCol) : 0;
                int isAlarm = isAlarmCol >= 0 ? managedCursor.getInt(isAlarmCol) : 0;
                int isNotification = isNotificationCol >= 0 ? managedCursor.getInt(isNotificationCol) : 0;
                String folderPath = pathCol >= 0 ? managedCursor.getString(pathCol) : "";
                long durationMs = durationCol >= 0 ? managedCursor.getLong(durationCol) : 0L;

                // Strictly skip ringtones, alarms, notifications, voice/call recordings & clips < 15s
                if (isRingtone != 0 || isAlarm != 0 || isNotification != 0) {
                    continue;
                }
                if (durationMs > 0 && durationMs < 15_000) {
                    continue;
                }
                if (isExcludedNonMusicPath(folderPath, displayName)) {
                    continue;
                }

                if (filterInJava) {
                    boolean isAudioMime = mimeType != null && (
                            mimeType.toLowerCase(Locale.ROOT).startsWith("audio/")
                            || "application/ogg".equalsIgnoreCase(mimeType)
                    );
                    if (!isAudioMime && isMusic == 0 && !hasAudioFileExtension(displayName)) {
                        continue;
                    }
                }

                String rawTitle = titleCol >= 0 ? managedCursor.getString(titleCol) : null;
                String title = normalizeScannedTitle(rawTitle, displayName);
                String rawArtist = artistCol >= 0 ? managedCursor.getString(artistCol) : null;
                String artist = rawArtist != null ? rawArtist.trim() : "";
                if (artist.isEmpty() || "<unknown>".equalsIgnoreCase(artist)) {
                    artist = "Unknown Artist";
                }
                String rawAlbum = albumCol >= 0 ? managedCursor.getString(albumCol) : null;
                String album = rawAlbum != null ? rawAlbum.trim() : "";
                if ("<unknown>".equalsIgnoreCase(album)) {
                    album = "";
                }

                Uri contentUri = ContentUris.withAppendedId(collectionUri, id);
                JSONObject item = new JSONObject();
                item.put("id", String.valueOf(id));
                item.put("title", title);
                item.put("artist", artist);
                item.put("album", album);
                item.put("duration", durationMs > 0 ? durationMs / 1000.0 : 0.0);
                item.put("uri", contentUri.toString());
                item.put("path", folderPath != null ? folderPath : "");
                results.put(item);
                seenIds.add(id);
            }
        } catch (Exception ignored) {
        }
    }

    private static boolean isExcludedNonMusicPath(@Nullable String folderPath, @Nullable String displayName) {
        String combined = ((folderPath != null ? folderPath : "") + " " + (displayName != null ? displayName : ""))
                .toLowerCase(Locale.ROOT);
        String[] excludedTokens = new String[]{
                "ringtone", "notification", "alarm", "recording", "soundrecorder", "voicerecorder",
                "callrecord", "call_record", "call record", "voicemail", "whatsapp", "telegram",
                "messenger", "wechat", "signal", "dictaphone", "screenrecord", "audiorecord",
                "ptt-", "aud-", "voice note", "voicenote", "ui_sounds", "/system/media"
        };
        for (String token : excludedTokens) {
            if (combined.contains(token)) {
                return true;
            }
        }
        return false;
    }

    private static String normalizeScannedTitle(@Nullable String rawTitle, @Nullable String displayName) {
        String title = rawTitle != null ? rawTitle.trim() : "";
        if (!title.isEmpty() && !"<unknown>".equalsIgnoreCase(title)) {
            return title;
        }
        if (displayName != null) {
            String cleaned = displayName.trim();
            int dot = cleaned.lastIndexOf('.');
            if (dot > 0) {
                cleaned = cleaned.substring(0, dot).trim();
            }
            if (!cleaned.isEmpty()) {
                return cleaned;
            }
        }
        return "Unknown Title";
    }

    private static boolean hasAudioFileExtension(@Nullable String displayName) {
        if (displayName == null) {
            return false;
        }
        String lower = displayName.trim().toLowerCase(Locale.ROOT);
        return lower.endsWith(".mp3")
                || lower.endsWith(".m4a")
                || lower.endsWith(".aac")
                || lower.endsWith(".wav")
                || lower.endsWith(".flac")
                || lower.endsWith(".ogg")
                || lower.endsWith(".opus");
    }

    private static final class DownloadedAudioPayload {
        final byte[] bytes;
        final String mimeType;

        DownloadedAudioPayload(byte[] bytes, String mimeType) {
            this.bytes = bytes;
            this.mimeType = mimeType;
        }
    }

    private DownloadedAudioPayload downloadAudioCandidate(
            String reqId,
            String url,
            @Nullable String userAgent
    ) throws Exception {
        Request.Builder reqBuilder = new Request.Builder()
                .url(url)
                .header("Accept", "*/*");
        if (userAgent != null && !userAgent.isEmpty()) {
            reqBuilder.header("User-Agent", userAgent);
        }
        try (Response res = HTTP_CLIENT.newCall(reqBuilder.build()).execute()) {
            if (!res.isSuccessful()) {
                throw new IllegalStateException("YouTube CDN returned HTTP " + res.code());
            }
            ResponseBody body = res.body();
            if (body == null) {
                throw new IllegalStateException("Empty audio response body.");
            }

            String mimeType = normalizeAudioMimeType(res.header("Content-Type"), url);
            if (mimeType == null) {
                throw new IllegalStateException("Invalid audio content type.");
            }

            long contentLength = body.contentLength();
            if (contentLength > MAX_OFFLINE_AUDIO_BYTES) {
                throw new IllegalStateException("Audio file exceeds 40MB offline limit.");
            }

            int initialCap = contentLength > 0 && contentLength <= MAX_OFFLINE_AUDIO_BYTES
                    ? (int) contentLength
                    : 64 * 1024;
            ByteArrayOutputStream buffer = new ByteArrayOutputStream(initialCap);
            byte[] readBuf = new byte[32 * 1024];
            long totalRead = 0;
            int lastReportedPct = -1;

            try (InputStream in = body.byteStream()) {
                int n;
                while ((n = in.read(readBuf)) != -1) {
                    if (isFinishing() || isDestroyed()) {
                        throw new IllegalStateException("Download cancelled.");
                    }
                    totalRead += n;
                    if (totalRead > MAX_OFFLINE_AUDIO_BYTES) {
                        throw new IllegalStateException("Audio file exceeds 40MB offline limit.");
                    }
                    buffer.write(readBuf, 0, n);
                    if (contentLength > 0) {
                        int pct = (int) Math.min(99, Math.max(1, (totalRead * 100L) / contentLength));
                        if (pct >= lastReportedPct + 5 || pct == 99) {
                            lastReportedPct = pct;
                            sendOfflineAudioProgress(reqId, pct);
                        }
                    }
                }
            }

            byte[] bytes = buffer.toByteArray();
            if (bytes.length == 0) {
                throw new IllegalStateException("Downloaded audio file was empty.");
            }
            return new DownloadedAudioPayload(bytes, mimeType);
        }
    }

    @Nullable
    private static String normalizeAudioMimeType(@Nullable String rawContentType, String url) {
        String cleaned = "";
        if (rawContentType != null) {
            int semi = rawContentType.indexOf(';');
            cleaned = (semi >= 0 ? rawContentType.substring(0, semi) : rawContentType)
                    .trim()
                    .toLowerCase(Locale.ROOT);
        }
        if (!cleaned.isEmpty() && !"application/octet-stream".equals(cleaned)) {
            if (cleaned.startsWith("audio/") || cleaned.startsWith("video/")) {
                return cleaned;
            }
            return null;
        }
        String lowerUrl = url.toLowerCase(Locale.ROOT);
        if (lowerUrl.contains("mime=audio%2fwebm") || lowerUrl.contains("mime=audio/webm")) {
            return "audio/webm";
        }
        return "audio/mp4";
    }

    private void sendOfflineAudioError(String requestId, String error) {
        try {
            JSONObject payload = new JSONObject();
            payload.put("requestId", requestId);
            payload.put("error", error != null && !error.isEmpty() ? error : "Offline download failed.");
            dispatchToWeb("offline_audio_error", payload.toString());
        } catch (Exception ignored) {
        }
    }

    private void sendOfflineAudioProgress(String requestId, int progress) {
        try {
            JSONObject payload = new JSONObject();
            payload.put("requestId", requestId);
            payload.put("progress", progress);
            dispatchToWeb("offline_audio_progress", payload.toString());
        } catch (Exception ignored) {
        }
    }

    @Override
    protected void onDestroy() {
        bridgeExecutor.shutdownNow();
        chunkDownloadExecutor.shutdownNow();
        for (String key : offlineAudioWriters.keySet()) {
            try {
                FileOutputStream output = offlineAudioWriters.remove(key);
                if (output != null) output.close();
                File temporary = new File(new File(getFilesDir(), "offline-audio"), key + ".part");
                if (temporary.exists()) temporary.delete();
            } catch (Exception ignored) {
            }
        }
        SangeetAudioService.setEventListener(null);
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
