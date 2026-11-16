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
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
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
import org.json.JSONArray;
import org.json.JSONObject;

public final class MainActivity extends AppCompatActivity {
    private static final String START_URL = "https://sangeet.shasant.xyz/home";
    private static final int REQ_AUDIO_PERMISSION = 103;
    private WebView webView;
    private ValueCallback<Uri[]> fileUploadCallback;
    private ActivityResultLauncher<Intent> filePickerLauncher;

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
        });

        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            try {
                DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
                req.setMimeType(mimeType);
                req.addRequestHeader("User-Agent", userAgent);
                String filename = URLUtil.guessFileName(url, contentDisposition, mimeType);
                req.setTitle(filename);
                req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                req.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename);
                DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                if (dm != null) {
                    dm.enqueue(req);
                    Toast.makeText(this, "Downloading " + filename, Toast.LENGTH_SHORT).show();
                }
            } catch (Exception e) {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
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
    }

    @Override
    public void onRequestPermissionsResult(
            int requestCode,
            @NonNull String[] permissions,
            @NonNull int[] grantResults
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_AUDIO_PERMISSION) {
            boolean granted = grantResults.length > 0
                    && grantResults[0] == PackageManager.PERMISSION_GRANTED;
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
        if (webView == null) return;
        final String js = "window.__sangeetAndroidEvent && window.__sangeetAndroidEvent("
                + JSONObject.quote(type) + ","
                + JSONObject.quote(payload != null ? payload : "") + ");";
        runOnUiThread(() -> {
            if (webView != null) {
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
        public void requestAudioPermission() {
            if (hasAudioPermissionInternal()) {
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
            String[] projection = new String[]{
                    MediaStore.Audio.Media._ID,
                    MediaStore.Audio.Media.TITLE,
                    MediaStore.Audio.Media.ARTIST,
                    MediaStore.Audio.Media.ALBUM,
                    MediaStore.Audio.Media.DURATION,
                    MediaStore.Audio.Media.DISPLAY_NAME
            };
            String selection = MediaStore.Audio.Media.IS_MUSIC + " != 0"
                    + " OR LOWER(" + MediaStore.Audio.Media.DISPLAY_NAME + ") LIKE '%.mp3'"
                    + " OR LOWER(" + MediaStore.Audio.Media.DISPLAY_NAME + ") LIKE '%.m4a'"
                    + " OR LOWER(" + MediaStore.Audio.Media.DISPLAY_NAME + ") LIKE '%.flac'"
                    + " OR LOWER(" + MediaStore.Audio.Media.DISPLAY_NAME + ") LIKE '%.wav'"
                    + " OR LOWER(" + MediaStore.Audio.Media.DISPLAY_NAME + ") LIKE '%.ogg'";
            String sortOrder = MediaStore.Audio.Media.TITLE + " ASC";
            try (Cursor cursor = getContentResolver().query(
                    MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
                    projection,
                    selection,
                    null,
                    sortOrder
            )) {
                if (cursor != null) {
                    int idCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID);
                    int titleCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE);
                    int artistCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST);
                    int albumCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM);
                    int durationCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION);
                    int count = 0;
                    while (cursor.moveToNext() && count < 500) {
                        long id = cursor.getLong(idCol);
                        String title = cursor.getString(titleCol);
                        String artist = cursor.getString(artistCol);
                        String album = cursor.getString(albumCol);
                        long durationMs = cursor.getLong(durationCol);
                        Uri contentUri = ContentUris.withAppendedId(
                                MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, id);
                        JSONObject item = new JSONObject();
                        item.put("id", id);
                        item.put("title", title != null && !title.isEmpty() ? title : "Unknown Title");
                        item.put("artist", artist != null && !artist.isEmpty() && !"<unknown>".equals(artist)
                                ? artist : "Unknown Artist");
                        item.put("album", album != null && !album.isEmpty() && !"<unknown>".equals(album)
                                ? album : "");
                        item.put("duration", Math.max(0.0, durationMs / 1000.0));
                        item.put("uri", contentUri.toString());
                        results.put(item);
                        count++;
                    }
                }
            } catch (Exception ignored) {
            }
            return results.toString();
        }
    }

    @Override
    protected void onDestroy() {
        SangeetAudioService.setEventListener(null);
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
