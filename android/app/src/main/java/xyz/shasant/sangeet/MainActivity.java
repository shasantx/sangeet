package xyz.shasant.sangeet;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.ContentUris;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.ViewGroup;
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
import java.io.InputStream;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

public final class MainActivity extends AppCompatActivity {
    private static final String START_URL = "https://sangeet.shasant.xyz/home";
    private static final int REQ_AUDIO_PERMISSION = 103;
    private static final int MAX_SCAN_TRACKS = 1500;
    private static final int MAX_OFFLINE_AUDIO_BYTES = 40 * 1024 * 1024;
    // Multiple of 3 bytes so Base64 chunks encode cleanly (~256KB ASCII per chunk).
    private static final int AUDIO_CHUNK_RAW_BYTES = 196608;
    private static final OkHttpClient HTTP_CLIENT = new OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .callTimeout(60, TimeUnit.SECONDS)
            .followRedirects(true)
            .build();
    private final ExecutorService bridgeExecutor = Executors.newFixedThreadPool(2);
    private WebView webView;
    private ValueCallback<Uri[]> fileUploadCallback;
    private ActivityResultLauncher<Intent> filePickerLauncher;
    private boolean wasAudioPermissionGranted = false;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

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
        getWindow().setStatusBarColor(0xFF080908);
        getWindow().setNavigationBarColor(0xFF080908);
        WindowInsetsControllerCompat insetsController =
                WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (insetsController != null) {
            insetsController.setAppearanceLightStatusBars(false);
            insetsController.setAppearanceLightNavigationBars(false);
        }

        FrameLayout rootContainer = new FrameLayout(this);
        rootContainer.setBackgroundColor(0xFF080908);
        webView = new WebView(this);
        webView.setBackgroundColor(0xFF080908);
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

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.resumeTimers();
        }
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
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setCookie(
                "https://sangeet.shasant.xyz",
                "aura_session=" + session + "; Path=/; Secure; HttpOnly; SameSite=Lax"
        );
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
            String[] projection = new String[]{
                    MediaStore.Audio.Media._ID,
                    MediaStore.Audio.Media.TITLE,
                    MediaStore.Audio.Media.ARTIST,
                    MediaStore.Audio.Media.ALBUM,
                    MediaStore.Audio.Media.DURATION,
                    MediaStore.Audio.Media.DISPLAY_NAME,
                    MediaStore.Audio.Media.MIME_TYPE,
                    MediaStore.Audio.Media.IS_MUSIC
            };
            String selection = MediaStore.Audio.Media.IS_MUSIC + " != 0"
                    + " OR " + MediaStore.Audio.Media.MIME_TYPE + " LIKE 'audio/%'"
                    + " OR LOWER(" + MediaStore.Audio.Media.DISPLAY_NAME + ") LIKE '%.mp3'"
                    + " OR LOWER(" + MediaStore.Audio.Media.DISPLAY_NAME + ") LIKE '%.m4a'"
                    + " OR LOWER(" + MediaStore.Audio.Media.DISPLAY_NAME + ") LIKE '%.aac'"
                    + " OR LOWER(" + MediaStore.Audio.Media.DISPLAY_NAME + ") LIKE '%.wav'"
                    + " OR LOWER(" + MediaStore.Audio.Media.DISPLAY_NAME + ") LIKE '%.flac'"
                    + " OR LOWER(" + MediaStore.Audio.Media.DISPLAY_NAME + ") LIKE '%.ogg'"
                    + " OR LOWER(" + MediaStore.Audio.Media.DISPLAY_NAME + ") LIKE '%.opus'";
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

            while (managedCursor.moveToNext() && results.length() < MAX_SCAN_TRACKS) {
                long id = managedCursor.getLong(idCol);
                if (id < 0 || seenIds.contains(id)) {
                    continue;
                }

                String mimeType = mimeCol >= 0 ? managedCursor.getString(mimeCol) : null;
                String displayName = displayNameCol >= 0 ? managedCursor.getString(displayNameCol) : null;
                int isMusic = isMusicCol >= 0 ? managedCursor.getInt(isMusicCol) : 0;
                long durationMs = durationCol >= 0 ? managedCursor.getLong(durationCol) : 0L;

                if (durationMs > 0 && durationMs < 500) {
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
                results.put(item);
                seenIds.add(id);
            }
        } catch (Exception ignored) {
        }
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
        SangeetAudioService.setEventListener(null);
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
