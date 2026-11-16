package xyz.shasant.sangeet;

import androidx.annotation.Nullable;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.ResponseBody;
import org.json.JSONArray;
import org.json.JSONObject;

import java.util.concurrent.TimeUnit;

public final class YouTubeInnerTubeExtractor {
    private static final MediaType JSON_TYPE = MediaType.get("application/json; charset=utf-8");
    private static final OkHttpClient CLIENT = new OkHttpClient.Builder()
            .connectTimeout(12, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .build();

    public static final class StreamResult {
        public final String url;
        public final String userAgent;

        public StreamResult(String url, String userAgent) {
            this.url = url;
            this.userAgent = userAgent;
        }
    }

    @Nullable
    public static StreamResult extract(String videoId) {
        StreamResult vr = tryClient(
                videoId,
                "com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip",
                buildAndroidVrContext()
        );
        if (vr != null) return vr;

        return tryClient(
                videoId,
                "com.google.ios.youtube/19.29.1 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X;)",
                buildIosContext()
        );
    }

    private static JSONObject buildAndroidVrContext() {
        try {
            JSONObject client = new JSONObject();
            client.put("clientName", "ANDROID_VR");
            client.put("clientVersion", "1.60.19");
            client.put("deviceMake", "Oculus");
            client.put("deviceModel", "Quest 3");
            client.put("androidSdkVersion", 32);
            client.put("osName", "Android");
            client.put("osVersion", "12L");
            client.put("hl", "en");
            client.put("gl", "US");
            JSONObject ctx = new JSONObject();
            ctx.put("client", client);
            return ctx;
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    private static JSONObject buildIosContext() {
        try {
            JSONObject client = new JSONObject();
            client.put("clientName", "IOS");
            client.put("clientVersion", "19.29.1");
            client.put("deviceMake", "Apple");
            client.put("deviceModel", "iPhone16,2");
            client.put("osName", "iPhone");
            client.put("osVersion", "17.5.1.21F90");
            client.put("hl", "en");
            client.put("gl", "US");
            JSONObject ctx = new JSONObject();
            ctx.put("client", client);
            return ctx;
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    @Nullable
    private static StreamResult tryClient(String videoId, String userAgent, JSONObject context) {
        try {
            JSONObject body = new JSONObject();
            body.put("context", context);
            body.put("videoId", videoId);

            Request req = new Request.Builder()
                    .url("https://www.youtube.com/youtubei/v1/player?prettyPrint=false")
                    .header("User-Agent", userAgent)
                    .post(RequestBody.create(body.toString(), JSON_TYPE))
                    .build();

            try (Response res = CLIENT.newCall(req).execute()) {
                if (!res.isSuccessful()) return null;
                ResponseBody resBody = res.body();
                if (resBody == null) return null;
                JSONObject json = new JSONObject(resBody.string());
                JSONObject status = json.optJSONObject("playabilityStatus");
                if (status == null || !"OK".equals(status.optString("status"))) {
                    return null;
                }
                JSONObject streaming = json.optJSONObject("streamingData");
                if (streaming == null) return null;
                JSONArray adaptive = streaming.optJSONArray("adaptiveFormats");
                if (adaptive == null) return null;

                String bestMp4 = null;
                int bestMp4Bitrate = -1;
                String bestWebm = null;
                int bestWebmBitrate = -1;

                for (int i = 0; i < adaptive.length(); i++) {
                    JSONObject fmt = adaptive.optJSONObject(i);
                    if (fmt == null) continue;
                    String mime = fmt.optString("mimeType", "");
                    String url = fmt.optString("url", "");
                    if (url.isEmpty() || !mime.startsWith("audio/")) continue;
                    int bitrate = fmt.optInt("bitrate", 0);
                    if (mime.contains("audio/mp4")) {
                        if (bitrate > bestMp4Bitrate) {
                            bestMp4Bitrate = bitrate;
                            bestMp4 = url;
                        }
                    } else if (mime.contains("audio/webm")) {
                        if (bitrate > bestWebmBitrate) {
                            bestWebmBitrate = bitrate;
                            bestWebm = url;
                        }
                    }
                }

                String chosen = bestMp4 != null ? bestMp4 : bestWebm;
                return chosen != null ? new StreamResult(chosen, userAgent) : null;
            }
        } catch (Exception e) {
            return null;
        }
    }
}
