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
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class YouTubeInnerTubeExtractor {
    private static final MediaType JSON_TYPE = MediaType.get("application/json; charset=utf-8");
    private static final OkHttpClient CLIENT = new OkHttpClient.Builder()
            .connectTimeout(12, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .build();

    private static final Pattern VISITOR_DATA_PATTERN = Pattern.compile("\"(Cg[A-Za-z0-9_\\-=%]{10,})\"");
    private static final long VISITOR_TTL_MS = 30L * 60L * 1000L;
    private static volatile String cachedVisitorData;
    private static volatile long cachedVisitorAtMs;

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
        String visitorData = getVisitorData();

        StreamResult vr = tryClient(
                videoId,
                "com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip",
                buildAndroidVrContext(visitorData),
                visitorData
        );
        if (vr != null) return vr;

        StreamResult ios = tryClient(
                videoId,
                "com.google.ios.youtube/19.29.1 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X;)",
                buildIosContext(visitorData),
                visitorData
        );
        if (ios != null) return ios;

        StreamResult android = tryClient(
                videoId,
                "com.google.android.youtube/19.29.37 (Linux; U; Android 14) gzip",
                buildAndroidContext(visitorData),
                visitorData
        );
        if (android != null) return android;

        return tryClient(
                videoId,
                "Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.5) AppleWebKit/537.36 (KHTML, like Gecko) 85.0.4183.93/6.5 TV Safari/537.36",
                buildTvEmbeddedContext(visitorData),
                visitorData
        );
    }

    @Nullable
    private static String getVisitorData() {
        long now = System.currentTimeMillis();
        String existing = cachedVisitorData;
        if (existing != null && !existing.isEmpty() && (now - cachedVisitorAtMs) < VISITOR_TTL_MS) {
            return existing;
        }

        String fetched = fetchVisitorDataFromSwJs();
        if (fetched == null || fetched.isEmpty()) {
            fetched = fetchVisitorDataFromEndpoint();
        }
        if (fetched != null && !fetched.isEmpty()) {
            cachedVisitorData = fetched;
            cachedVisitorAtMs = now;
        }
        return fetched;
    }

    @Nullable
    private static String fetchVisitorDataFromSwJs() {
        try {
            Request req = new Request.Builder()
                    .url("https://www.youtube.com/sw.js_data")
                    .header("User-Agent", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36")
                    .get()
                    .build();
            try (Response res = CLIENT.newCall(req).execute()) {
                if (!res.isSuccessful()) return null;
                ResponseBody body = res.body();
                if (body == null) return null;
                String text = body.string();
                Matcher m = VISITOR_DATA_PATTERN.matcher(text);
                if (m.find()) {
                    return m.group(1);
                }
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    @Nullable
    private static String fetchVisitorDataFromEndpoint() {
        try {
            JSONObject client = new JSONObject();
            client.put("clientName", "WEB");
            client.put("clientVersion", "2.20241114.01.00");
            client.put("hl", "en");
            client.put("gl", "US");
            JSONObject ctx = new JSONObject();
            ctx.put("client", client);
            JSONObject payload = new JSONObject();
            payload.put("context", ctx);

            Request req = new Request.Builder()
                    .url("https://www.youtube.com/youtubei/v1/visitor_id?prettyPrint=false")
                    .header("User-Agent", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36")
                    .post(RequestBody.create(payload.toString(), JSON_TYPE))
                    .build();
            try (Response res = CLIENT.newCall(req).execute()) {
                if (!res.isSuccessful()) return null;
                ResponseBody body = res.body();
                if (body == null) return null;
                JSONObject json = new JSONObject(body.string());
                JSONObject responseContext = json.optJSONObject("responseContext");
                if (responseContext != null) {
                    String vd = responseContext.optString("visitorData", "");
                    if (!vd.isEmpty()) return vd;
                }
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    private static JSONObject buildAndroidVrContext(@Nullable String visitorData) {
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
            if (visitorData != null && !visitorData.isEmpty()) {
                client.put("visitorData", visitorData);
            }
            JSONObject ctx = new JSONObject();
            ctx.put("client", client);
            return ctx;
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    private static JSONObject buildIosContext(@Nullable String visitorData) {
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
            if (visitorData != null && !visitorData.isEmpty()) {
                client.put("visitorData", visitorData);
            }
            JSONObject ctx = new JSONObject();
            ctx.put("client", client);
            return ctx;
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    private static JSONObject buildAndroidContext(@Nullable String visitorData) {
        try {
            JSONObject client = new JSONObject();
            client.put("clientName", "ANDROID");
            client.put("clientVersion", "19.29.37");
            client.put("androidSdkVersion", 34);
            client.put("osName", "Android");
            client.put("osVersion", "14");
            client.put("hl", "en");
            client.put("gl", "US");
            if (visitorData != null && !visitorData.isEmpty()) {
                client.put("visitorData", visitorData);
            }
            JSONObject ctx = new JSONObject();
            ctx.put("client", client);
            return ctx;
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    private static JSONObject buildTvEmbeddedContext(@Nullable String visitorData) {
        try {
            JSONObject client = new JSONObject();
            client.put("clientName", "TVHTML5_SIMPLY_EMBEDDED_PLAYER");
            client.put("clientVersion", "2.0");
            client.put("hl", "en");
            client.put("gl", "US");
            if (visitorData != null && !visitorData.isEmpty()) {
                client.put("visitorData", visitorData);
            }
            JSONObject thirdParty = new JSONObject();
            thirdParty.put("embedUrl", "https://www.youtube.com/");
            JSONObject ctx = new JSONObject();
            ctx.put("client", client);
            ctx.put("thirdParty", thirdParty);
            return ctx;
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    @Nullable
    private static StreamResult tryClient(
            String videoId,
            String userAgent,
            JSONObject context,
            @Nullable String visitorData
    ) {
        try {
            JSONObject body = new JSONObject();
            body.put("context", context);
            body.put("videoId", videoId);
            body.put("contentCheckOk", true);
            body.put("racyCheckOk", true);

            Request.Builder reqBuilder = new Request.Builder()
                    .url("https://www.youtube.com/youtubei/v1/player?prettyPrint=false")
                    .header("User-Agent", userAgent)
                    .post(RequestBody.create(body.toString(), JSON_TYPE));
            if (visitorData != null && !visitorData.isEmpty()) {
                reqBuilder.header("X-Goog-Visitor-Id", visitorData);
            }
            Request req = reqBuilder.build();

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
