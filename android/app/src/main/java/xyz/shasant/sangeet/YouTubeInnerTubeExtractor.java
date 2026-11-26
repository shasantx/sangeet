package xyz.shasant.sangeet;

import androidx.annotation.Nullable;
import okhttp3.Call;
import okhttp3.ConnectionPool;
import okhttp3.Dispatcher;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.ResponseBody;
import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionService;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorCompletionService;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class YouTubeInnerTubeExtractor {
    private static final MediaType JSON_TYPE = MediaType.get("application/json; charset=utf-8");

    private static final ConnectionPool SHARED_POOL = new ConnectionPool(12, 5, TimeUnit.MINUTES);

    private static final Dispatcher FAST_DISPATCHER = createDispatcher(24, 10);

    private static final OkHttpClient CLIENT = new OkHttpClient.Builder()
            .connectionPool(SHARED_POOL)
            .dispatcher(FAST_DISPATCHER)
            .connectTimeout(4, TimeUnit.SECONDS)
            .readTimeout(6, TimeUnit.SECONDS)
            .callTimeout(8, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .build();

    private static final OkHttpClient MEDIA_CLIENT = new OkHttpClient.Builder()
            .connectionPool(SHARED_POOL)
            .dispatcher(createDispatcher(32, 12))
            .connectTimeout(8, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .followRedirects(true)
            .retryOnConnectionFailure(true)
            .build();

    private static final OkHttpClient VISITOR_CLIENT = new OkHttpClient.Builder()
            .connectionPool(SHARED_POOL)
            .connectTimeout(2, TimeUnit.SECONDS)
            .readTimeout(2, TimeUnit.SECONDS)
            .callTimeout(2500, TimeUnit.MILLISECONDS)
            .build();

    private static final ExecutorService CLIENT_EXECUTOR = Executors.newCachedThreadPool();
    private static final ExecutorService PREFETCH_EXECUTOR = Executors.newFixedThreadPool(2);

    private static final Pattern VISITOR_DATA_PATTERN = Pattern.compile("\"(Cg[A-Za-z0-9_\\-=%+/]{10,})\"");
    private static final long VISITOR_TTL_MS = 30L * 60L * 1000L;
    private static final long STREAM_CACHE_TTL_MS = 35L * 60L * 1000L;
    private static final int MAX_CACHE_SIZE = 200;

    private static volatile String cachedVisitorData;
    private static volatile long cachedVisitorAtMs;
    private static final AtomicBoolean visitorRefreshing = new AtomicBoolean(false);
    private static volatile String lastWorkingClientName;

    private static final ConcurrentHashMap<String, CacheEntry> STREAM_CACHE = new ConcurrentHashMap<>();
    private static final ConcurrentHashMap<String, CompletableFuture<StreamResult>> IN_FLIGHT = new ConcurrentHashMap<>();

    /** "aac": prefer native AAC (audio/mp4). "original": highest-bitrate stream in any codec. */
    private static volatile String preferredAudioFormat = "aac";

    public static void setPreferredAudioFormat(String format) {
        String next = "original".equalsIgnoreCase(format) ? "original" : "aac";
        if (!next.equals(preferredAudioFormat)) {
            preferredAudioFormat = next;
            // Cached stream URLs were chosen for the old format.
            STREAM_CACHE.clear();
        }
    }

    private static Dispatcher createDispatcher(int maxRequests, int maxPerHost) {
        Dispatcher d = new Dispatcher();
        d.setMaxRequests(maxRequests);
        d.setMaxRequestsPerHost(maxPerHost);
        return d;
    }

    public static OkHttpClient getSharedMediaClient() {
        return MEDIA_CLIENT;
    }

    public static final class StreamResult {
        public final String url;
        public final String userAgent;
        public final String clientName;
        public final String mimeType;
        public final long contentLength;

        public StreamResult(
                String url,
                String userAgent,
                String clientName,
                String mimeType,
                long contentLength
        ) {
            this.url = url;
            this.userAgent = userAgent;
            this.clientName = clientName;
            this.mimeType = mimeType != null && !mimeType.isEmpty() ? mimeType : "audio/mp4";
            this.contentLength = contentLength;
        }

        public boolean isHls() {
            String lower = url != null ? url.toLowerCase() : "";
            return lower.contains(".m3u8") || lower.contains("hls_variant") || lower.contains("hls_playlist");
        }
    }

    private static final class CacheEntry {
        final StreamResult result;
        final long cachedAtMs;

        CacheEntry(StreamResult result, long cachedAtMs) {
            this.result = result;
            this.cachedAtMs = cachedAtMs;
        }
    }

    private static final class ClientAttempt {
        final String name;
        final String userAgent;
        final JSONObject context;

        ClientAttempt(String name, String userAgent, JSONObject context) {
            this.name = name;
            this.userAgent = userAgent;
            this.context = context;
        }
    }

    /**
     * Non-blocking warm-up called on app startup: primes DNS/TLS to YouTube and
     * fetches visitorData so the very first song click never pays a cold-start penalty.
     */
    public static void warmUpAsync() {
        refreshVisitorDataAsync();
    }

    public static void invalidateCache(String videoId) {
        if (videoId == null || videoId.isEmpty()) return;
        STREAM_CACHE.remove(videoId);
    }

    @Nullable
    public static StreamResult getCached(String videoId) {
        if (videoId == null || videoId.isEmpty()) return null;
        CacheEntry entry = STREAM_CACHE.get(videoId);
        if (entry == null) return null;
        if (System.currentTimeMillis() - entry.cachedAtMs < STREAM_CACHE_TTL_MS) {
            return entry.result;
        }
        STREAM_CACHE.remove(videoId, entry);
        return null;
    }

    /**
     * Background prefetch for upcoming queue tracks or hovered/tapped cards.
     * Deduplicated so repeated calls for the same videoId are free.
     */
    public static void prefetch(String videoId) {
        if (videoId == null || !videoId.matches("^[A-Za-z0-9_-]{11}$")) return;
        if (getCached(videoId) != null || IN_FLIGHT.containsKey(videoId)) return;
        PREFETCH_EXECUTOR.execute(() -> {
            try {
                extractFast(videoId);
            } catch (Exception ignored) {
            }
        });
    }

    /**
     * Ultra-fast single-stream extraction:
     * 1. Instant return if cached (<1ms).
     * 2. Deduplicates concurrent requests for the same videoId.
     * 3. Never blocks on visitorData fetch (uses warm cached value or refreshes in background).
     * 4. Races top 3 clients (prioritizing lastWorkingClient) and returns THE INSTANT the first
     *    playable audio stream arrives, cancelling slower in-flight HTTP calls immediately.
     */
    @Nullable
    public static StreamResult extractFast(String videoId) {
        if (videoId == null || videoId.isEmpty()) return null;
        StreamResult cached = getCached(videoId);
        if (cached != null) return cached;

        CompletableFuture<StreamResult> newFuture = new CompletableFuture<>();
        CompletableFuture<StreamResult> existing = IN_FLIGHT.putIfAbsent(videoId, newFuture);
        if (existing != null) {
            try {
                return existing.get(7, TimeUnit.SECONDS);
            } catch (Exception ignored) {
                return null;
            }
        }

        try {
            StreamResult result = extractWithExclusions(videoId, null, false);
            if (result != null) {
                putCache(videoId, result);
            }
            newFuture.complete(result);
            return result;
        } catch (Exception e) {
            newFuture.complete(null);
            return null;
        } finally {
            IN_FLIGHT.remove(videoId, newFuture);
        }
    }

    /**
     * Fallback extraction excluding userAgents that failed during playback/download.
     */
    @Nullable
    public static StreamResult extractFallback(String videoId, @Nullable Set<String> excludeUserAgents, boolean disallowHls) {
        if (videoId == null || videoId.isEmpty()) return null;
        StreamResult result = extractWithExclusions(videoId, excludeUserAgents, disallowHls);
        if (result != null) {
            putCache(videoId, result);
        }
        return result;
    }

    @Nullable
    public static StreamResult extract(String videoId) {
        return extractFast(videoId);
    }

    public static List<StreamResult> extractAll(String videoId) {
        StreamResult fast = extractFast(videoId);
        if (fast != null) {
            return Collections.singletonList(fast);
        }
        return Collections.emptyList();
    }

    @Nullable
    private static StreamResult extractWithExclusions(
            String videoId,
            @Nullable Set<String> excludeUserAgents,
            boolean disallowHls
    ) {
        String visitorData = getVisitorDataNonBlocking();
        List<ClientAttempt> allAttempts = buildOrderedAttempts(visitorData, excludeUserAgents);
        if (allAttempts.isEmpty()) return null;

        // Batch 1: race the top 3 fastest/most reliable clients (last working client always first)
        int split = Math.min(3, allAttempts.size());
        StreamResult primary = raceBatchForFirst(videoId, allAttempts.subList(0, split), visitorData, disallowHls, 5000);
        if (primary != null) {
            return primary;
        }

        // Batch 2: fallback clients only if all 3 primary clients failed
        if (split < allAttempts.size()) {
            return raceBatchForFirst(videoId, allAttempts.subList(split, allAttempts.size()), visitorData, disallowHls, 5000);
        }
        return null;
    }

    @Nullable
    private static StreamResult raceBatchForFirst(
            String videoId,
            List<ClientAttempt> batch,
            @Nullable String visitorData,
            boolean disallowHls,
            long timeoutMs
    ) {
        if (batch.isEmpty()) return null;
        List<Call> activeCalls = Collections.synchronizedList(new ArrayList<>(batch.size()));
        CompletionService<StreamResult> completion = new ExecutorCompletionService<>(CLIENT_EXECUTOR);
        List<Future<StreamResult>> futures = new ArrayList<>(batch.size());

        for (ClientAttempt attempt : batch) {
            futures.add(completion.submit(() -> {
                StreamResult res = tryClient(videoId, attempt, visitorData, activeCalls);
                if (res != null && disallowHls && res.isHls()) {
                    return null;
                }
                return res;
            }));
        }

        StreamResult winner = null;
        StreamResult hlsFallback = null;
        long deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(timeoutMs);

        for (int i = 0; i < batch.size(); i++) {
            long remaining = deadline - System.nanoTime();
            if (remaining <= 0) break;
            try {
                Future<StreamResult> ready = completion.poll(remaining, TimeUnit.NANOSECONDS);
                if (ready == null) break;
                StreamResult candidate = ready.get();
                if (candidate != null) {
                    if (!candidate.isHls()) {
                        winner = candidate;
                        lastWorkingClientName = candidate.clientName;
                        break; // Return IMMEDIATELY — no waiting for slower clients!
                    } else if (hlsFallback == null) {
                        hlsFallback = candidate;
                    }
                }
            } catch (Exception ignored) {
            }
        }

        // Cancel remaining in-flight HTTP calls & tasks right away to free sockets
        synchronized (activeCalls) {
            for (Call call : activeCalls) {
                try {
                    call.cancel();
                } catch (Exception ignored) {
                }
            }
        }
        for (Future<StreamResult> future : futures) {
            future.cancel(true);
        }

        return winner != null ? winner : hlsFallback;
    }

    private static List<ClientAttempt> buildOrderedAttempts(
            @Nullable String visitorData,
            @Nullable Set<String> excludeUserAgents
    ) {
        List<ClientAttempt> defaults = new ArrayList<>(6);
        defaults.add(new ClientAttempt(
                "ANDROID_VR",
                "com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip",
                buildAndroidVrContext(visitorData)
        ));
        defaults.add(new ClientAttempt(
                "VISIONOS",
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15",
                buildVisionOsContext(visitorData)
        ));
        defaults.add(new ClientAttempt(
                "IOS",
                "com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_1 like Mac OS X;)",
                buildIosContext(visitorData)
        ));
        defaults.add(new ClientAttempt(
                "ANDROID",
                "com.google.android.youtube/20.10.38 (Linux; U; Android 14; en_US) gzip",
                buildAndroidContext(visitorData)
        ));
        defaults.add(new ClientAttempt(
                "TV_EMBEDDED",
                "Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.5) AppleWebKit/537.36 (KHTML, like Gecko) 85.0.4183.93/6.5 TV Safari/537.36",
                buildTvEmbeddedContext(visitorData)
        ));
        defaults.add(new ClientAttempt(
                "MWEB",
                "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
                buildMwebContext(visitorData)
        ));

        List<ClientAttempt> filtered = new ArrayList<>(defaults.size());
        for (ClientAttempt attempt : defaults) {
            if (excludeUserAgents == null || !excludeUserAgents.contains(attempt.userAgent)) {
                filtered.add(attempt);
            }
        }

        String preferred = lastWorkingClientName;
        if (preferred != null && !preferred.isEmpty()) {
            for (int i = 1; i < filtered.size(); i++) {
                if (preferred.equals(filtered.get(i).name)) {
                    ClientAttempt winner = filtered.remove(i);
                    filtered.add(0, winner);
                    break;
                }
            }
        }
        return filtered;
    }

    private static void putCache(String videoId, StreamResult result) {
        if (STREAM_CACHE.size() >= MAX_CACHE_SIZE) {
            long oldestAt = Long.MAX_VALUE;
            String oldestKey = null;
            for (Map.Entry<String, CacheEntry> entry : STREAM_CACHE.entrySet()) {
                if (entry.getValue().cachedAtMs < oldestAt) {
                    oldestAt = entry.getValue().cachedAtMs;
                    oldestKey = entry.getKey();
                }
            }
            if (oldestKey != null) {
                STREAM_CACHE.remove(oldestKey);
            }
        }
        STREAM_CACHE.put(videoId, new CacheEntry(result, System.currentTimeMillis()));
    }

    @Nullable
    private static String getVisitorDataNonBlocking() {
        long now = System.currentTimeMillis();
        String existing = cachedVisitorData;
        if (existing != null && !existing.isEmpty() && (now - cachedVisitorAtMs) < VISITOR_TTL_MS) {
            return existing;
        }
        // Refresh in background without blocking playback!
        refreshVisitorDataAsync();
        return existing;
    }

    private static void refreshVisitorDataAsync() {
        long now = System.currentTimeMillis();
        String existing = cachedVisitorData;
        if (existing != null && !existing.isEmpty() && (now - cachedVisitorAtMs) < VISITOR_TTL_MS) {
            return;
        }
        if (!visitorRefreshing.compareAndSet(false, true)) {
            return;
        }
        CLIENT_EXECUTOR.execute(() -> {
            try {
                String fetched = fetchVisitorDataFromSwJs();
                if (fetched != null && !fetched.isEmpty()) {
                    cachedVisitorData = fetched;
                    cachedVisitorAtMs = System.currentTimeMillis();
                }
            } finally {
                visitorRefreshing.set(false);
            }
        });
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
            client.put("clientVersion", "20.10.4");
            client.put("deviceMake", "Apple");
            client.put("deviceModel", "iPhone16,2");
            client.put("osName", "iPhone");
            client.put("osVersion", "18.3.1.22D72");
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
            client.put("clientVersion", "20.10.38");
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
            ClientAttempt attempt,
            @Nullable String visitorData,
            List<Call> activeCalls
    ) {
        try {
            JSONObject body = new JSONObject();
            body.put("context", attempt.context);
            body.put("videoId", videoId);
            body.put("contentCheckOk", true);
            body.put("racyCheckOk", true);

            Request.Builder reqBuilder = new Request.Builder()
                    .url("https://www.youtube.com/youtubei/v1/player?prettyPrint=false")
                    .header("User-Agent", attempt.userAgent)
                    .post(RequestBody.create(body.toString(), JSON_TYPE));
            if (visitorData != null && !visitorData.isEmpty()) {
                reqBuilder.header("X-Goog-Visitor-Id", visitorData);
            }
            Call call = CLIENT.newCall(reqBuilder.build());
            activeCalls.add(call);

            try (Response res = call.execute()) {
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
                long bestMp4Length = -1L;

                String bestWebm = null;
                int bestWebmBitrate = -1;
                long bestWebmLength = -1L;

                if (adaptive != null) {
                    for (int i = 0; i < adaptive.length(); i++) {
                        JSONObject fmt = adaptive.optJSONObject(i);
                        if (fmt == null) continue;
                        String mime = fmt.optString("mimeType", "");
                        String url = fmt.optString("url", "");
                        if (url.isEmpty() || !mime.startsWith("audio/")) continue;
                        int bitrate = fmt.optInt("bitrate", 0);
                        long contentLength = parseContentLength(fmt.optString("contentLength", ""));
                        if (mime.contains("audio/mp4")) {
                            if (bitrate > bestMp4Bitrate) {
                                bestMp4Bitrate = bitrate;
                                bestMp4 = url;
                                bestMp4Length = contentLength;
                            }
                        } else if (mime.contains("audio/webm")) {
                            if (bitrate > bestWebmBitrate) {
                                bestWebmBitrate = bitrate;
                                bestWebm = url;
                                bestWebmLength = contentLength;
                            }
                        }
                    }
                }

                boolean hasMp4 = bestMp4 != null && !bestMp4.isEmpty();
                boolean hasWebm = bestWebm != null && !bestWebm.isEmpty();
                // Original mode: take the higher-bitrate stream (usually Opus) instead of forcing AAC.
                if ("original".equals(preferredAudioFormat) && hasWebm
                        && (!hasMp4 || bestWebmBitrate > bestMp4Bitrate)) {
                    return new StreamResult(bestWebm, attempt.userAgent, attempt.name, "audio/webm", bestWebmLength);
                }
                // AAC mode (default): YouTube's own AAC stream — no re-encoding needed.
                if (hasMp4) {
                    return new StreamResult(bestMp4, attempt.userAgent, attempt.name, "audio/mp4", bestMp4Length);
                }
                if (bestWebm != null && !bestWebm.isEmpty()) {
                    return new StreamResult(bestWebm, attempt.userAgent, attempt.name, "audio/webm", bestWebmLength);
                }

                String hlsManifestUrl = streaming.optString("hlsManifestUrl", "");
                if (!hlsManifestUrl.isEmpty()) {
                    return new StreamResult(hlsManifestUrl, attempt.userAgent, attempt.name, "application/x-mpegURL", -1L);
                }
                return null;
            }
        } catch (Exception e) {
            return null;
        }
    }

    private static long parseContentLength(@Nullable String raw) {
        if (raw == null || raw.isEmpty()) return -1L;
        try {
            long val = Long.parseLong(raw.trim());
            return val > 0 ? val : -1L;
        } catch (Exception ignored) {
            return -1L;
        }
    }
}
