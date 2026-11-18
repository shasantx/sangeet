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

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.CompletionService;
import java.util.concurrent.ExecutorCompletionService;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class YouTubeInnerTubeExtractor {
    private static final MediaType JSON_TYPE = MediaType.get("application/json; charset=utf-8");
    private static final OkHttpClient CLIENT = new OkHttpClient.Builder()
            .connectTimeout(6, TimeUnit.SECONDS)
            .readTimeout(8, TimeUnit.SECONDS)
            .callTimeout(12, TimeUnit.SECONDS)
            .build();
    private static final OkHttpClient VISITOR_CLIENT = new OkHttpClient.Builder()
            .connectTimeout(2, TimeUnit.SECONDS)
            .readTimeout(2, TimeUnit.SECONDS)
            .callTimeout(3, TimeUnit.SECONDS)
            .build();
    private static final ExecutorService CLIENT_EXECUTOR = Executors.newFixedThreadPool(6);

    private static final Pattern VISITOR_DATA_PATTERN = Pattern.compile("\"(Cg[A-Za-z0-9_\\-=%+/]{10,})\"");
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
        List<StreamResult> all = extractAll(videoId);
        return all.isEmpty() ? null : all.get(0);
    }

    public static List<StreamResult> extractAll(String videoId) {
        String visitorData = getVisitorData();
        List<StreamResult> results = new ArrayList<>();
        final class ClientAttempt {
            final String userAgent;
            final JSONObject context;
            ClientAttempt(String userAgent, JSONObject context) {
                this.userAgent = userAgent;
                this.context = context;
            }
        }
        List<ClientAttempt> attempts = List.of(
                new ClientAttempt("com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip", buildAndroidVrContext(visitorData)),
                new ClientAttempt("Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15", buildVisionOsContext(visitorData)),
                new ClientAttempt("com.google.ios.youtube/19.29.1 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X;)", buildIosContext(visitorData)),
                new ClientAttempt("Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.5) AppleWebKit/537.36 (KHTML, like Gecko) 85.0.4183.93/6.5 TV Safari/537.36", buildTvEmbeddedContext(visitorData)),
                new ClientAttempt("com.google.android.youtube/21.26.364 (Linux; U; Android 14) gzip", buildAndroidContext(visitorData)),
                new ClientAttempt("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36", buildMwebContext(visitorData))
        );
        CompletionService<StreamResult> completed = new ExecutorCompletionService<>(CLIENT_EXECUTOR);
        List<Future<StreamResult>> pending = new ArrayList<>();
        for (ClientAttempt attempt : attempts) {
            pending.add(completed.submit(() -> tryClient(videoId, attempt.userAgent, attempt.context, visitorData)));
        }
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(9);
        boolean firstResultSeen = false;
        for (int i = 0; i < attempts.size(); i++) {
            long remaining = deadline - System.nanoTime();
            if (remaining <= 0) break;
            try {
                Future<StreamResult> ready = completed.poll(remaining, TimeUnit.NANOSECONDS);
                if (ready == null) break;
                StreamResult result = ready.get();
                if (result != null) {
                    results.add(result);
                    if (!firstResultSeen) {
                        firstResultSeen = true;
                        long tightenedDeadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(1200);
                        if (tightenedDeadline < deadline) {
                            deadline = tightenedDeadline;
                        }
                    }
                }
            } catch (Exception ignored) {
                // One public client failing must not block the remaining clients.
            }
        }
        for (Future<StreamResult> future : pending) future.cancel(true);
        List<String> priority = new ArrayList<>();
        for (ClientAttempt attempt : attempts) priority.add(attempt.userAgent);
        results.sort(Comparator.comparingInt(result -> priority.indexOf(result.userAgent)));
        return results;
    }

    @Nullable
    private static String getVisitorData() {
        long now = System.currentTimeMillis();
        String existing = cachedVisitorData;
        if (existing != null && !existing.isEmpty() && (now - cachedVisitorAtMs) < VISITOR_TTL_MS) {
            return existing;
        }

        // Visitor data is optional. Keep the cold-start cost bounded; a second
        // visitor endpoint request used to burn another full network timeout.
        String fetched = fetchVisitorDataFromSwJs();
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
            try (Response res = VISITOR_CLIENT.newCall(req).execute()) {
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

    private static JSONObject buildVisionOsContext(@Nullable String visitorData) {
        try {
            JSONObject client = new JSONObject();
            client.put("clientName", "VISIONOS");
            client.put("clientVersion", "1.02");
            client.put("deviceMake", "Apple");
            client.put("deviceModel", "RealityDevice17,1");
            client.put("osName", "visionOS");
            client.put("osVersion", "26.5.23O471");
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

    private static JSONObject buildAndroidVrContext(@Nullable String visitorData) {
        try {
            JSONObject client = new JSONObject();
            client.put("clientName", "ANDROID_VR");
            client.put("clientVersion", "1.65.10");
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
            client.put("clientVersion", "21.26.364");
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

    private static JSONObject buildMwebContext(@Nullable String visitorData) {
        try {
            JSONObject client = new JSONObject();
            client.put("clientName", "MWEB");
            client.put("clientVersion", "2.20241114.01.00");
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

                String bestMp4 = null;
                int bestMp4Bitrate = -1;
                String bestWebm = null;
                int bestWebmBitrate = -1;

                if (adaptive != null) {
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
                }

                String chosen = bestMp4 != null ? bestMp4 : bestWebm;
                if (chosen != null && !chosen.isEmpty()) {
                    return new StreamResult(chosen, userAgent);
                }

                String hlsManifestUrl = streaming.optString("hlsManifestUrl", "");
                if (!hlsManifestUrl.isEmpty()) {
                    return new StreamResult(hlsManifestUrl, userAgent);
                }
                return null;
            }
        } catch (Exception e) {
            return null;
        }
    }
}
