package xyz.shasant.sangeet;

import android.app.Activity;
import android.net.Uri;
import android.os.Bundle;
import androidx.browser.customtabs.CustomTabsClient;
import androidx.browser.customtabs.CustomTabsServiceConnection;
import androidx.browser.customtabs.CustomTabsSession;
import androidx.browser.trusted.TrustedWebActivityIntentBuilder;

public final class MainActivity extends Activity {
    private static final Uri START_URL = Uri.parse("https://sangeet.shasant.xyz/");
    private CustomTabsServiceConnection connection;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        String browser = CustomTabsClient.getPackageName(this, null);
        if (browser == null) {
            startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW, START_URL));
            finish();
            return;
        }
        connection = new CustomTabsServiceConnection() {
            @Override public void onCustomTabsServiceConnected(android.content.ComponentName name, CustomTabsClient client) {
                client.warmup(0L);
                CustomTabsSession session = client.newSession(null);
                new TrustedWebActivityIntentBuilder(START_URL).build(session).launchTrustedWebActivity(MainActivity.this);
                finish();
            }
            @Override public void onServiceDisconnected(android.content.ComponentName name) { }
        };
        if (!CustomTabsClient.bindCustomTabsService(this, browser, connection)) {
            startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW, START_URL));
            finish();
        }
    }

    @Override protected void onDestroy() {
        if (connection != null) unbindService(connection);
        super.onDestroy();
    }
}
