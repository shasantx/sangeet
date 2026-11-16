package xyz.shasant.sangeet;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
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
import androidx.core.view.WindowInsetsCompat;
import org.json.JSONObject;

public final class MainActivity extends AppCompatActivity {
    private static final String START_URL = "https://sangeet.shasant.xyz/home";
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
                    WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.ime()
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
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ContextCompat.startForegroundService(this, intent);
        } else {
            startService(intent);
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
            startService(intent);
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
            startService(intent);
        }

        @JavascriptInterface
        public void stop() {
            Intent intent = new Intent(MainActivity.this, SangeetAudioService.class);
            intent.setAction(SangeetAudioService.ACTION_STOP);
            startService(intent);
        }

        @JavascriptInterface
        public void setVolume(double volume) {
            Intent intent = new Intent(MainActivity.this, SangeetAudioService.class);
            intent.setAction(SangeetAudioService.ACTION_VOLUME);
            intent.putExtra(SangeetAudioService.EXTRA_VOLUME, (float) volume);
            startService(intent);
        }

        @JavascriptInterface
        public void setPlaybackRate(double rate) {
            Intent intent = new Intent(MainActivity.this, SangeetAudioService.class);
            intent.setAction(SangeetAudioService.ACTION_SPEED);
            intent.putExtra(SangeetAudioService.EXTRA_SPEED, (float) rate);
            startService(intent);
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
