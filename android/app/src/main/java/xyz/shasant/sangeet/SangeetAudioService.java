package xyz.shasant.sangeet;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.util.LruCache;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.ForwardingPlayer;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.MimeTypes;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.datasource.okhttp.OkHttpDataSource;
import androidx.media3.exoplayer.DefaultLoadControl;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;
import androidx.media3.session.MediaStyleNotificationHelper;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.json.JSONArray;
import org.json.JSONObject;

public final class SangeetAudioService extends MediaSessionService {
    public static final String ACTION_PLAY_YOUTUBE = "xyz.shasant.sangeet.PLAY_YOUTUBE";
    public static final String ACTION_PREFETCH_YOUTUBE = "xyz.shasant.sangeet.PREFETCH_YOUTUBE";
    public static final String ACTION_PLAY_URL = "xyz.shasant.sangeet.PLAY_URL";
    public static final String ACTION_SYNC_QUEUE = "xyz.shasant.sangeet.SYNC_QUEUE";
    public static final String ACTION_PAUSE = "xyz.shasant.sangeet.PAUSE";
    public static final String ACTION_RESUME = "xyz.shasant.sangeet.RESUME";
    public static final String ACTION_NEXT = "xyz.shasant.sangeet.NEXT";
    public static final String ACTION_PREVIOUS = "xyz.shasant.sangeet.PREVIOUS";
    public static final String ACTION_SEEK = "xyz.shasant.sangeet.SEEK";
    public static final String ACTION_STOP = "xyz.shasant.sangeet.STOP";
    public static final String ACTION_VOLUME = "xyz.shasant.sangeet.VOLUME";
    public static final String ACTION_SPEED = "xyz.shasant.sangeet.SPEED";
    public static final String ACTION_TOGGLE_REPEAT = "xyz.shasant.sangeet.TOGGLE_REPEAT";

    public static final String EXTRA_VIDEO_ID = "videoId";
    public static final String EXTRA_URL = "url";
    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_ARTIST = "artist";
    public static final String EXTRA_ARTWORK = "artwork";
    public static final String EXTRA_SEEK_MS = "seekMs";
    public static final String EXTRA_VOLUME = "volume";
    public static final String EXTRA_SPEED = "speed";
    public static final String EXTRA_QUEUE_JSON = "queueJson";
    public static final String EXTRA_QUEUE_INDEX = "queueIndex";
    public static final String EXTRA_REPEAT_ONE = "repeatOne";
    public static final String EXTRA_REPEAT_ALL = "repeatAll";
    public static final String EXTRA_SLEEP_AFTER_TRACK = "sleepAfterTrack";

    private static final class NativeQueueTrack {
        final String id;
        final String youtubeId;
        final String audioUrl;
        final String title;
        final String artist;
        final String artwork;
        final String offlineTrackId;

        NativeQueueTrack(
                String id,
                String youtubeId,
                String audioUrl,
                String title,
                String artist,
                String artwork,
                String offlineTrackId
        ) {
            this.id = id;
            this.youtubeId = youtubeId;
            this.audioUrl = audioUrl;
            this.title = title;
            this.artist = artist;
            this.artwork = artwork;
            this.offlineTrackId = offlineTrackId;
        }
    }

    private static final String CHANNEL_ID = "sangeet_playback";
    private static final int NOTIFICATION_ID = 1001;
    private static final int ARTWORK_CONNECT_TIMEOUT_MS = 4500;
    private static final int ARTWORK_READ_TIMEOUT_MS = 4500;
    private static final int MAX_ARTWORK_DIMENSION = 512;
    private static final int MAX_ARTWORK_BYTES = 5 * 1024 * 1024;
    private static final int MAX_FALLBACK_RETRIES = 2;

    public interface EventListener {
        void onState(String state);
        void onTime(double currentSec, double durationSec, boolean isPlaying);
        void onAction(String action);
        void onError(String message);
        void onTrackChanged(String trackId, int queueIndex);
    }

    private static volatile EventListener listener;
    private static volatile SangeetAudioService activeService;

    private final List<NativeQueueTrack> nativeQueue = new ArrayList<>();
    private int nativeQueueIndex = -1;
    private boolean repeatOne = false;
    private boolean repeatAll = false;
    private boolean sleepAfterTrack = false;
    private volatile boolean isAutoAdvancing = false;
    @Nullable private String activeTrackId;

    public static void syncCurrentTrackToListener() {
        SangeetAudioService service = activeService;
        if (service == null || service.isStopping) return;
        service.mainHandler.post(() -> {
            EventListener l = listener;
            if (l == null || service.isStopping) return;
            if (service.activeTrackId != null && service.nativeQueueIndex >= 0) {
                l.onTrackChanged(service.activeTrackId, service.nativeQueueIndex);
            }
            if (service.player != null) {
                int playbackState = service.player.getPlaybackState();
                boolean playing = service.player.isPlaying();
                if (playing) {
                    l.onState("playing");
                } else if (service.player.getPlayWhenReady() && playbackState == Player.STATE_BUFFERING) {
                    l.onState("buffering");
                } else if (service.player.getPlayWhenReady() && playbackState == Player.STATE_READY) {
                    l.onState("playing");
                } else if (playbackState != Player.STATE_IDLE) {
                    l.onState("paused");
                }
                if (playbackState != Player.STATE_IDLE) {
                    long posMs = Math.max(0, service.player.getCurrentPosition());
                    long rawDurMs = service.player.getDuration();
                    double durSec = (rawDurMs != C.TIME_UNSET && rawDurMs > 0) ? (rawDurMs / 1000.0) : 0.0;
                    l.onTime(posMs / 1000.0, durSec, playing);
                }
            }
        });
    }

    private ExoPlayer player;
    private OkHttpDataSource.Factory httpFactory;
    private MediaSession mediaSession;
    private PowerManager.WakeLock wakeLock;
    // Cached thread pool so rapid track taps cancel previous extraction and start immediately
    private final ExecutorService executor = Executors.newCachedThreadPool();
    private final ExecutorService artworkExecutor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final LruCache<String, Bitmap> artworkCache = new LruCache<>(16);
    private final LruCache<String, byte[]> artworkBytesCache = new LruCache<>(16);
    private final Set<Player.Listener> sessionListeners = new HashSet<>();
    private volatile long activeRequestToken = 0;
    private volatile Future<?> activeExtractionTask;
    private volatile boolean isForeground = false;
    private volatile boolean isStopping = false;

    @Nullable private String activeVideoId;
    private final Set<String> failedUserAgents = new HashSet<>();
    private int fallbackRetryCount = 0;
    @Nullable private String pendingTitle;
    @Nullable private String pendingArtist;
    @Nullable private String pendingArtwork;
    @Nullable private String currentTitle;
    @Nullable private String currentArtist;
    @Nullable private String currentArtworkUrl;
    @Nullable private Bitmap currentArtworkBitmap;
    @Nullable private byte[] currentArtworkBytes;
    @Nullable private String inFlightArtworkUrl;

    public static void setEventListener(@Nullable EventListener l) {
        listener = l;
    }

    public static boolean dispatchToRunningService(@Nullable Intent intent) {
        SangeetAudioService service = activeService;
        if (service == null || service.isStopping || intent == null) {
            return false;
        }
        final Intent copy = new Intent(intent);
        service.mainHandler.post(() -> {
            if (activeService == service && !service.isStopping) {
                service.handleIntentCommand(copy);
            }
        });
        return true;
    }

    private final Runnable progressRunnable = new Runnable() {
        @Override
        public void run() {
            if (player != null && player.getPlaybackState() != Player.STATE_IDLE
                    && player.getPlaybackState() != Player.STATE_ENDED) {
                long posMs = Math.max(0, player.getCurrentPosition());
                long rawDurMs = player.getDuration();
                double durSec = (rawDurMs != C.TIME_UNSET && rawDurMs > 0) ? (rawDurMs / 1000.0) : 0.0;
                EventListener l = listener;
                if (l != null) {
                    l.onTime(posMs / 1000.0, durSec, player.isPlaying());
                }
            }
            mainHandler.postDelayed(this, 500);
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        activeService = this;
        isStopping = false;
        YouTubeInnerTubeExtractor.warmUpAsync();
        initWakeLock();
        createPlaybackNotificationChannel();

        // Shared HTTP/2 connection-pooled OkHttp data source for low-latency ExoPlayer streaming
        httpFactory = new OkHttpDataSource.Factory(YouTubeInnerTubeExtractor.getSharedMediaClient());

        DefaultDataSource.Factory dataSourceFactory = new DefaultDataSource.Factory(this, httpFactory);

        // Aggressive fast-start buffer: starts audio in ~350ms instead of ExoPlayer's 2500ms default!
        DefaultLoadControl loadControl = new DefaultLoadControl.Builder()
                .setBufferDurationsMs(
                        15_000, // minBufferMs
                        50_000, // maxBufferMs
                        350,    // bufferForPlaybackMs (sub-second startup!)
                        900     // bufferForPlaybackAfterRebufferMs
                )
                .setPrioritizeTimeOverSizeThresholds(true)
                .build();

        AudioAttributes attrs = new AudioAttributes.Builder()
                .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                .setUsage(C.USAGE_MEDIA)
                .build();

        player = new ExoPlayer.Builder(this)
                .setMediaSourceFactory(new DefaultMediaSourceFactory(dataSourceFactory))
                .setLoadControl(loadControl)
                .setAudioAttributes(attrs, true)
                .setHandleAudioBecomingNoisy(true)
                .build();
        player.setWakeMode(C.WAKE_MODE_NETWORK);

        player.addListener(new Player.Listener() {
            @Override
            public void onIsPlayingChanged(boolean isPlaying) {
                if (isPlaying) {
                    isAutoAdvancing = false;
                    acquireWakeLock();
                } else if (!isAutoAdvancing && (player == null || !player.getPlayWhenReady())) {
                    releaseWakeLock();
                }
                EventListener l = listener;
                if (l != null) {
                    if (isPlaying) {
                        l.onState("playing");
                    } else if (player != null && player.getPlayWhenReady()) {
                        l.onState("buffering");
                    } else if (!isAutoAdvancing) {
                        l.onState("paused");
                    }
                }
                refreshNotificationIfForeground();
            }

            @Override
            public void onPlaybackStateChanged(int playbackState) {
                if (playbackState == Player.STATE_ENDED) {
                    if (handleNativeTrackEnded()) {
                        return;
                    }
                    refreshNotificationIfForeground();
                }
                EventListener l = listener;
                if (l == null) return;
                if (playbackState == Player.STATE_BUFFERING) {
                    l.onState(player.getPlayWhenReady() ? "buffering" : "paused");
                } else if (playbackState == Player.STATE_ENDED) {
                    l.onState("ended");
                } else if (playbackState == Player.STATE_READY) {
                    isAutoAdvancing = false;
                    long rawDurMs = player.getDuration();
                    double durSec = (rawDurMs != C.TIME_UNSET && rawDurMs > 0) ? (rawDurMs / 1000.0) : 0.0;
                    long posMs = Math.max(0, player.getCurrentPosition());
                    boolean playing = player.isPlaying() || player.getPlayWhenReady();
                    l.onTime(posMs / 1000.0, durSec, playing);
                    l.onState(playing ? "playing" : "paused");
                }
            }

            @Override
            public void onPlayerError(@NonNull PlaybackException error) {
                if (activeVideoId != null && fallbackRetryCount < MAX_FALLBACK_RETRIES) {
                    fallbackRetryCount++;
                    final String vid = activeVideoId;
                    final long token = activeRequestToken;
                    final Set<String> excluded = new HashSet<>(failedUserAgents);
                    YouTubeInnerTubeExtractor.invalidateCache(vid);
                    executor.execute(() -> {
                        YouTubeInnerTubeExtractor.StreamResult fallback =
                                YouTubeInnerTubeExtractor.extractFallback(vid, excluded, false);
                        mainHandler.post(() -> {
                            if (token != activeRequestToken || isStopping) return;
                            if (fallback != null) {
                                failedUserAgents.add(fallback.userAgent);
                                playDirectUrl(
                                        fallback.url,
                                        fallback.userAgent,
                                        true,
                                        pendingTitle,
                                        pendingArtist,
                                        pendingArtwork
                                );
                            } else {
                                releaseWakeLock();
                                EventListener l = listener;
                                if (l != null) l.onError("fallback_iframe");
                            }
                        });
                    });
                    return;
                }
                releaseWakeLock();
                EventListener l = listener;
                if (l != null) {
                    l.onError("fallback_iframe");
                }
            }
        });

        ForwardingPlayer forwardingPlayer = new ForwardingPlayer(player) {
            @Override
            public void addListener(@NonNull Player.Listener listener) {
                sessionListeners.add(listener);
                super.addListener(listener);
            }

            @Override
            public void removeListener(@NonNull Player.Listener listener) {
                sessionListeners.remove(listener);
                super.removeListener(listener);
            }

            @NonNull
            @Override
            public MediaMetadata getMediaMetadata() {
                return buildLiveMediaMetadata();
            }

            @Nullable
            @Override
            public MediaItem getCurrentMediaItem() {
                MediaItem item = super.getCurrentMediaItem();
                if (item == null) return null;
                return item.buildUpon()
                        .setMediaMetadata(buildLiveMediaMetadata())
                        .build();
            }

            @NonNull
            @Override
            public Player.Commands getAvailableCommands() {
                return super.getAvailableCommands().buildUpon()
                        .add(COMMAND_PLAY_PAUSE)
                        .add(COMMAND_SEEK_IN_CURRENT_MEDIA_ITEM)
                        .add(COMMAND_SEEK_TO_NEXT)
                        .add(COMMAND_SEEK_TO_PREVIOUS)
                        .add(COMMAND_GET_CURRENT_MEDIA_ITEM)
                        .add(COMMAND_GET_METADATA)
                        .build();
            }

            @Override
            public boolean isCommandAvailable(int command) {
                if (command == COMMAND_PLAY_PAUSE
                        || command == COMMAND_SEEK_IN_CURRENT_MEDIA_ITEM
                        || command == COMMAND_SEEK_TO_NEXT
                        || command == COMMAND_SEEK_TO_PREVIOUS
                        || command == COMMAND_GET_CURRENT_MEDIA_ITEM
                        || command == COMMAND_GET_METADATA) {
                    return true;
                }
                return super.isCommandAvailable(command);
            }

            @Override
            public void seekToNext() {
                if (!skipNativeQueue(1)) {
                    EventListener l = listener;
                    if (l != null) l.onAction("next");
                }
            }

            @Override
            public void seekToPrevious() {
                if (player != null && player.getCurrentPosition() > 3500) {
                    player.seekTo(0);
                    return;
                }
                if (!skipNativeQueue(-1)) {
                    EventListener l = listener;
                    if (l != null) l.onAction("previous");
                }
            }
        };

        mediaSession = new MediaSession.Builder(this, forwardingPlayer)
                .setSessionActivity(createContentIntent())
                .build();
        mainHandler.post(progressRunnable);
    }

    @Nullable
    @Override
    public MediaSession onGetSession(@NonNull MediaSession.ControllerInfo controllerInfo) {
        return mediaSession;
    }

    @Override
    public int onStartCommand(@Nullable Intent intent, int flags, int startId) {
        super.onStartCommand(intent, flags, startId);
        handleIntentCommand(intent);
        return START_STICKY;
    }

    private void handleIntentCommand(@Nullable Intent intent) {
        if (intent == null || intent.getAction() == null) {
            return;
        }
        isStopping = false;
        String action = intent.getAction();
        switch (action) {
            case ACTION_SYNC_QUEUE: {
                String queueJson = intent.getStringExtra(EXTRA_QUEUE_JSON);
                int idx = intent.getIntExtra(EXTRA_QUEUE_INDEX, -1);
                repeatOne = intent.getBooleanExtra(EXTRA_REPEAT_ONE, false);
                repeatAll = intent.getBooleanExtra(EXTRA_REPEAT_ALL, false);
                sleepAfterTrack = intent.getBooleanExtra(EXTRA_SLEEP_AFTER_TRACK, false);
                updateNativeQueue(queueJson, idx);
                refreshNotificationIfForeground();
                break;
            }
            case ACTION_TOGGLE_REPEAT: {
                if (!repeatAll && !repeatOne) {
                    repeatAll = true;
                    repeatOne = false;
                } else if (repeatAll && !repeatOne) {
                    repeatAll = false;
                    repeatOne = true;
                } else {
                    repeatAll = false;
                    repeatOne = false;
                }
                EventListener l = listener;
                if (l != null) {
                    l.onAction(repeatOne ? "repeat_one" : (repeatAll ? "repeat_all" : "repeat_off"));
                }
                refreshNotificationIfForeground();
                break;
            }
            case ACTION_PREFETCH_YOUTUBE: {
                String videoId = intent.getStringExtra(EXTRA_VIDEO_ID);
                if (videoId != null && !videoId.isEmpty()) {
                    YouTubeInnerTubeExtractor.prefetch(videoId);
                }
                break;
            }
            case ACTION_PLAY_YOUTUBE: {
                String videoId = intent.getStringExtra(EXTRA_VIDEO_ID);
                String title = intent.getStringExtra(EXTRA_TITLE);
                String artist = intent.getStringExtra(EXTRA_ARTIST);
                String artwork = intent.getStringExtra(EXTRA_ARTWORK);
                if (videoId != null && !videoId.isEmpty()) {
                    currentTitle = title;
                    currentArtist = artist;
                    prepareTrackArtwork(artwork);
                    notifyMediaMetadataChanged();
                    if (player != null) player.play();
                    ensureForegroundNotification(title, artist);
                    playYouTubeVideo(videoId, title, artist, artwork);
                }
                break;
            }
            case ACTION_PLAY_URL: {
                String url = intent.getStringExtra(EXTRA_URL);
                String title = intent.getStringExtra(EXTRA_TITLE);
                String artist = intent.getStringExtra(EXTRA_ARTIST);
                String artwork = intent.getStringExtra(EXTRA_ARTWORK);
                if (url != null && !url.isEmpty()) {
                    cancelActiveExtraction();
                    activeVideoId = null;
                    failedUserAgents.clear();
                    fallbackRetryCount = 0;
                    currentTitle = title;
                    currentArtist = artist;
                    prepareTrackArtwork(artwork);
                    notifyMediaMetadataChanged();
                    if (player != null) player.play();
                    ensureForegroundNotification(title, artist);
                    playDirectUrl(url, null, false, title, artist, artwork);
                }
                break;
            }
            case ACTION_PAUSE:
                releaseWakeLock();
                if (player != null) player.pause();
                refreshNotificationIfForeground();
                break;
            case ACTION_RESUME:
                acquireWakeLock();
                if (player != null) player.play();
                ensureForegroundNotification(currentTitle, currentArtist);
                break;
            case ACTION_NEXT: {
                if (!skipNativeQueue(1)) {
                    EventListener l = listener;
                    if (l != null) l.onAction("next");
                }
                break;
            }
            case ACTION_PREVIOUS: {
                if (player != null && player.getCurrentPosition() > 3500) {
                    player.seekTo(0);
                    break;
                }
                if (!skipNativeQueue(-1)) {
                    EventListener l = listener;
                    if (l != null) l.onAction("previous");
                }
                break;
            }
            case ACTION_SEEK: {
                long ms = intent.getLongExtra(EXTRA_SEEK_MS, 0);
                if (player != null) player.seekTo(Math.max(0, ms));
                break;
            }
            case ACTION_VOLUME: {
                float vol = intent.getFloatExtra(EXTRA_VOLUME, 1f);
                if (player != null) player.setVolume(Math.max(0f, Math.min(1f, vol)));
                break;
            }
            case ACTION_SPEED: {
                float speed = intent.getFloatExtra(EXTRA_SPEED, 1f);
                if (player != null) player.setPlaybackSpeed(Math.max(0.5f, Math.min(2f, speed)));
                break;
            }
            case ACTION_STOP:
                isStopping = true;
                isAutoAdvancing = false;
                activeRequestToken++;
                cancelActiveExtraction();
                nativeQueue.clear();
                nativeQueueIndex = -1;
                activeTrackId = null;
                activeVideoId = null;
                failedUserAgents.clear();
                fallbackRetryCount = 0;
                currentTitle = null;
                currentArtist = null;
                currentArtworkUrl = null;
                currentArtworkBitmap = null;
                currentArtworkBytes = null;
                releaseWakeLock();
                if (player != null) {
                    player.stop();
                    player.clearMediaItems();
                }
                isForeground = false;
                stopForeground(STOP_FOREGROUND_REMOVE);
                stopSelf();
                break;
        }
    }

    private void updateNativeQueue(@Nullable String queueJson, int currentIndex) {
        if (queueJson == null || queueJson.isEmpty()) return;
        try {
            JSONArray arr = new JSONArray(queueJson);
            nativeQueue.clear();
            for (int i = 0; i < arr.length(); i++) {
                JSONObject obj = arr.optJSONObject(i);
                if (obj == null) continue;
                String id = obj.optString("id", "");
                if (id.isEmpty()) continue;
                nativeQueue.add(new NativeQueueTrack(
                        id,
                        obj.optString("youtubeId", ""),
                        obj.optString("audioUrl", ""),
                        obj.optString("title", "Sangeet"),
                        obj.optString("artist", "Sangeet"),
                        obj.optString("artwork", ""),
                        obj.optString("offlineTrackId", "")
                ));
            }
            if (nativeQueue.isEmpty()) {
                nativeQueueIndex = -1;
            } else {
                nativeQueueIndex = Math.max(0, Math.min(nativeQueue.size() - 1, currentIndex));
                activeTrackId = nativeQueue.get(nativeQueueIndex).id;
                prefetchNextInNativeQueue();
            }
        } catch (Exception ignored) {
        }
    }

    private void prefetchNextInNativeQueue() {
        if (nativeQueue.isEmpty() || nativeQueueIndex < 0) return;
        for (int offset = 1; offset <= 2; offset++) {
            int idx = nativeQueueIndex + offset;
            if (idx >= nativeQueue.size()) {
                if (repeatAll && nativeQueue.size() > 1) {
                    idx = idx % nativeQueue.size();
                } else {
                    break;
                }
            }
            NativeQueueTrack next = nativeQueue.get(idx);
            if (!next.youtubeId.isEmpty() && resolveOfflineFile(next.offlineTrackId) == null) {
                YouTubeInnerTubeExtractor.prefetch(next.youtubeId);
            }
        }
    }

    @Nullable
    private File resolveOfflineFile(@Nullable String trackId) {
        if (trackId == null || trackId.trim().isEmpty()) return null;
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(trackId.getBytes(StandardCharsets.UTF_8));
            StringBuilder key = new StringBuilder(digest.length * 2);
            for (byte value : digest) key.append(String.format(Locale.ROOT, "%02x", value & 0xff));
            String ext = getSharedPreferences("offline-audio", MODE_PRIVATE)
                    .getString("ext_" + key, "m4a");
            File file = new File(new File(getFilesDir(), "offline-audio"), key + "." + ext);
            return (file.isFile() && file.length() > 0) ? file : null;
        } catch (Exception ignored) {
            return null;
        }
    }

    private boolean handleNativeTrackEnded() {
        if (isStopping || player == null) return false;
        if (sleepAfterTrack) {
            sleepAfterTrack = false;
            isAutoAdvancing = false;
            releaseWakeLock();
            return false;
        }
        if (repeatOne) {
            isAutoAdvancing = true;
            acquireWakeLock();
            player.seekTo(0);
            player.play();
            return true;
        }
        return skipNativeQueue(1);
    }

    private boolean skipNativeQueue(int delta) {
        if (isStopping || player == null || nativeQueue.isEmpty() || nativeQueueIndex < 0) {
            return false;
        }
        int nextIndex = nativeQueueIndex + delta;
        if (nextIndex >= nativeQueue.size()) {
            if (repeatAll && !nativeQueue.isEmpty()) {
                nextIndex = 0;
            } else {
                return false;
            }
        } else if (nextIndex < 0) {
            if (repeatAll && !nativeQueue.isEmpty()) {
                nextIndex = nativeQueue.size() - 1;
            } else {
                return false;
            }
        }

        NativeQueueTrack target = nativeQueue.get(nextIndex);
        nativeQueueIndex = nextIndex;
        activeTrackId = target.id;
        isAutoAdvancing = true;
        acquireWakeLock();

        currentTitle = target.title;
        currentArtist = target.artist;
        prepareTrackArtwork(target.artwork);
        notifyMediaMetadataChanged();
        ensureForegroundNotification(target.title, target.artist);

        EventListener l = listener;
        if (l != null) {
            l.onTrackChanged(target.id, nextIndex);
        }

        File offlineFile = resolveOfflineFile(!target.offlineTrackId.isEmpty() ? target.offlineTrackId : target.id);
        if (offlineFile != null) {
            cancelActiveExtraction();
            activeVideoId = null;
            failedUserAgents.clear();
            fallbackRetryCount = 0;
            player.setPlayWhenReady(true);
            playDirectUrl(Uri.fromFile(offlineFile).toString(), null, false, target.title, target.artist, target.artwork);
        } else if (!target.youtubeId.isEmpty()) {
            player.setPlayWhenReady(true);
            playYouTubeVideo(target.youtubeId, target.title, target.artist, target.artwork);
        } else if (!target.audioUrl.isEmpty()) {
            cancelActiveExtraction();
            activeVideoId = null;
            failedUserAgents.clear();
            fallbackRetryCount = 0;
            player.setPlayWhenReady(true);
            playDirectUrl(target.audioUrl, null, false, target.title, target.artist, target.artwork);
        } else {
            isAutoAdvancing = false;
            return false;
        }

        prefetchNextInNativeQueue();
        return true;
    }

    private void cancelActiveExtraction() {
        Future<?> prev = activeExtractionTask;
        if (prev != null && !prev.isDone()) {
            prev.cancel(true);
        }
        activeExtractionTask = null;
    }

    private void createPlaybackNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Sangeet Playback",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Background audio playback controls");
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) {
                nm.createNotificationChannel(channel);
            }
        }
    }

    private boolean isPlaybackActive() {
        return player != null
                && player.getPlaybackState() != Player.STATE_ENDED
                && (player.isPlaying() || player.getPlayWhenReady());
    }

    private PendingIntent createActionPendingIntent(String action, int requestCode) {
        Intent actionIntent = new Intent(this, SangeetAudioService.class);
        actionIntent.setAction(action);
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            piFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getService(this, requestCode, actionIntent, piFlags);
    }

    private PendingIntent createContentIntent() {
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            piFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getActivity(this, 0, openIntent, piFlags);
    }

    private MediaMetadata buildLiveMediaMetadata() {
        String safeTitle = (currentTitle != null && !currentTitle.isEmpty()) ? currentTitle : "Sangeet";
        String safeArtist = (currentArtist != null && !currentArtist.isEmpty()) ? currentArtist : "Sangeet";
        MediaMetadata.Builder builder = new MediaMetadata.Builder()
                .setTitle(safeTitle)
                .setArtist(safeArtist)
                .setDisplayTitle(safeTitle)
                .setSubtitle(safeArtist);
        if (currentArtworkUrl != null && !currentArtworkUrl.isEmpty()) {
            try {
                builder.setArtworkUri(Uri.parse(currentArtworkUrl));
            } catch (Exception ignored) {
            }
        }
        if (currentArtworkBytes != null && currentArtworkBytes.length > 0) {
            builder.setArtworkData(currentArtworkBytes, MediaMetadata.PICTURE_TYPE_FRONT_COVER);
        }
        return builder.build();
    }

    private void notifyMediaMetadataChanged() {
        if (isStopping || sessionListeners.isEmpty()) return;
        MediaMetadata metadata = buildLiveMediaMetadata();
        for (Player.Listener l : new ArrayList<>(sessionListeners)) {
            try {
                l.onMediaMetadataChanged(metadata);
            } catch (Exception ignored) {
            }
        }
    }

    @Nullable
    private static byte[] compressBitmapToJpeg(@Nullable Bitmap bitmap) {
        if (bitmap == null || bitmap.isRecycled()) return null;
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            if (bitmap.compress(Bitmap.CompressFormat.JPEG, 88, out)) {
                byte[] bytes = out.toByteArray();
                return bytes.length > 0 ? bytes : null;
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    private Notification buildNotification(@Nullable String title, @Nullable String artist) {
        PendingIntent contentIntent = createContentIntent();

        String safeTitle = (title != null && !title.isEmpty()) ? title : "Sangeet";
        String safeArtist = (artist != null && !artist.isEmpty()) ? artist : "Playing audio";
        boolean isPlaying = isPlaybackActive();

        PendingIntent prevPendingIntent = createActionPendingIntent(ACTION_PREVIOUS, 101);
        PendingIntent playPausePendingIntent = createActionPendingIntent(
                isPlaying ? ACTION_PAUSE : ACTION_RESUME,
                isPlaying ? 102 : 103
        );
        PendingIntent nextPendingIntent = createActionPendingIntent(ACTION_NEXT, 104);
        PendingIntent repeatPendingIntent = createActionPendingIntent(ACTION_TOGGLE_REPEAT, 105);
        String repeatLabel = repeatOne ? "Repeat One" : (repeatAll ? "Repeat All" : "Repeat Off");

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_sangeet)
                .setContentTitle(safeTitle)
                .setContentText(safeArtist)
                .setContentIntent(contentIntent)
                .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
                .setColorized(true)
                .setOngoing(isPlaying)
                .setOnlyAlertOnce(true)
                .setSilent(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .addAction(android.R.drawable.ic_media_previous, "Previous", prevPendingIntent)
                .addAction(
                        isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play,
                        isPlaying ? "Pause" : "Play",
                        playPausePendingIntent
                )
                .addAction(android.R.drawable.ic_media_next, "Next", nextPendingIntent)
                .addAction(android.R.drawable.ic_menu_rotate, repeatLabel, repeatPendingIntent);

        if (currentArtworkBitmap != null && !currentArtworkBitmap.isRecycled()) {
            builder.setLargeIcon(currentArtworkBitmap);
        }

        if (mediaSession != null) {
            builder.setStyle(new MediaStyleNotificationHelper.MediaStyle(mediaSession)
                    .setShowActionsInCompactView(0, 1, 2));
        }

        return builder.build();
    }

    private void ensureForegroundNotification(@Nullable String title, @Nullable String artist) {
        Notification notification = buildNotification(title, artist);
        if (!isForeground) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
            isForeground = true;
        } else {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) {
                nm.notify(NOTIFICATION_ID, notification);
            }
        }
    }

    private void refreshNotificationIfForeground() {
        if (isForeground && !isStopping && activeService == this) {
            ensureForegroundNotification(currentTitle, currentArtist);
        }
    }

    private void prepareTrackArtwork(@Nullable String artwork) {
        String normalizedUrl = (artwork != null && !artwork.trim().isEmpty()) ? artwork.trim() : null;
        boolean urlChanged = !Objects.equals(currentArtworkUrl, normalizedUrl);
        currentArtworkUrl = normalizedUrl;

        if (normalizedUrl == null) {
            currentArtworkBitmap = null;
            currentArtworkBytes = null;
            notifyMediaMetadataChanged();
            return;
        }

        Bitmap cached = artworkCache.get(normalizedUrl);
        byte[] cachedBytes = artworkBytesCache.get(normalizedUrl);
        if (cached != null && !cached.isRecycled()) {
            currentArtworkBitmap = cached;
            currentArtworkBytes = cachedBytes;
            if (cachedBytes != null) {
                notifyMediaMetadataChanged();
            } else {
                artworkExecutor.execute(() -> {
                    byte[] encoded = compressBitmapToJpeg(cached);
                    mainHandler.post(() -> {
                        if (encoded != null) {
                            artworkBytesCache.put(normalizedUrl, encoded);
                        }
                        if (isStopping || activeService != SangeetAudioService.this) return;
                        if (!Objects.equals(currentArtworkUrl, normalizedUrl)) return;
                        currentArtworkBytes = encoded;
                        notifyMediaMetadataChanged();
                        refreshNotificationIfForeground();
                    });
                });
            }
            return;
        }

        if (urlChanged) {
            currentArtworkBitmap = null;
            currentArtworkBytes = null;
        }

        if (normalizedUrl.equals(inFlightArtworkUrl)) {
            return;
        }
        inFlightArtworkUrl = normalizedUrl;

        artworkExecutor.execute(() -> {
            Bitmap decoded = decodeArtworkBitmap(normalizedUrl);
            byte[] encoded = compressBitmapToJpeg(decoded);
            mainHandler.post(() -> {
                if (normalizedUrl.equals(inFlightArtworkUrl)) {
                    inFlightArtworkUrl = null;
                }
                if (decoded != null) {
                    artworkCache.put(normalizedUrl, decoded);
                }
                if (encoded != null) {
                    artworkBytesCache.put(normalizedUrl, encoded);
                }
                if (isStopping || activeService != SangeetAudioService.this) {
                    return;
                }
                if (!Objects.equals(currentArtworkUrl, normalizedUrl)) {
                    return;
                }
                currentArtworkBitmap = decoded;
                currentArtworkBytes = encoded;
                notifyMediaMetadataChanged();
                refreshNotificationIfForeground();
            });
        });
    }

    @Nullable
    private Bitmap decodeArtworkBitmap(String artworkUrl) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(artworkUrl);
            String protocol = url.getProtocol();
            if (!"http".equalsIgnoreCase(protocol) && !"https".equalsIgnoreCase(protocol)) {
                return null;
            }

            conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(ARTWORK_CONNECT_TIMEOUT_MS);
            conn.setReadTimeout(ARTWORK_READ_TIMEOUT_MS);
            conn.setInstanceFollowRedirects(true);
            conn.setRequestMethod("GET");
            conn.connect();

            int responseCode = conn.getResponseCode();
            if (responseCode < 200 || responseCode >= 300) {
                return null;
            }

            int contentLength = conn.getContentLength();
            if (contentLength > MAX_ARTWORK_BYTES) {
                return null;
            }

            byte[] data;
            try (InputStream is = conn.getInputStream();
                 ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[8192];
                int total = 0;
                int read;
                while ((read = is.read(buffer)) != -1) {
                    total += read;
                    if (total > MAX_ARTWORK_BYTES) {
                        return null;
                    }
                    baos.write(buffer, 0, read);
                }
                data = baos.toByteArray();
            }

            if (data.length == 0) {
                return null;
            }

            BitmapFactory.Options boundsOpts = new BitmapFactory.Options();
            boundsOpts.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(data, 0, data.length, boundsOpts);
            if (boundsOpts.outWidth <= 0 || boundsOpts.outHeight <= 0) {
                return null;
            }

            int inSampleSize = 1;
            while ((boundsOpts.outWidth / inSampleSize) > MAX_ARTWORK_DIMENSION
                    || (boundsOpts.outHeight / inSampleSize) > MAX_ARTWORK_DIMENSION) {
                inSampleSize *= 2;
            }

            BitmapFactory.Options decodeOpts = new BitmapFactory.Options();
            decodeOpts.inSampleSize = inSampleSize;
            return BitmapFactory.decodeByteArray(data, 0, data.length, decodeOpts);
        } catch (Exception ignored) {
            return null;
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }

    private void playYouTubeVideo(String videoId, @Nullable String title, @Nullable String artist, @Nullable String artwork) {
        final long token = ++activeRequestToken;
        cancelActiveExtraction();
        activeVideoId = videoId;
        failedUserAgents.clear();
        fallbackRetryCount = 0;
        pendingTitle = title;
        pendingArtist = artist;
        pendingArtwork = artwork;

        EventListener l = listener;
        if (l != null) l.onState("buffering");

        // Instant zero-hop path if already prefetched or cached!
        YouTubeInnerTubeExtractor.StreamResult cached = YouTubeInnerTubeExtractor.getCached(videoId);
        if (cached != null) {
            failedUserAgents.add(cached.userAgent);
            playDirectUrl(cached.url, cached.userAgent, true, title, artist, artwork);
            return;
        }

        activeExtractionTask = executor.submit(() -> {
            YouTubeInnerTubeExtractor.StreamResult result = YouTubeInnerTubeExtractor.extractFast(videoId);
            mainHandler.post(() -> {
                if (token != activeRequestToken || isStopping) return;
                if (result == null) {
                    releaseWakeLock();
                    EventListener errListener = listener;
                    if (errListener != null) {
                        errListener.onError("fallback_iframe");
                    }
                    return;
                }
                failedUserAgents.add(result.userAgent);
                playDirectUrl(result.url, result.userAgent, true, title, artist, artwork);
            });
        });
    }

    private void playDirectUrl(
            String url,
            @Nullable String userAgent,
            boolean isYouTube,
            @Nullable String title,
            @Nullable String artist,
            @Nullable String artwork
    ) {
        if (player == null) return;
        if (httpFactory != null) {
            if (userAgent != null && !userAgent.isEmpty()) {
                httpFactory.setUserAgent(userAgent);
            }
            Map<String, String> headers = new HashMap<>();
            if (isYouTube) {
                headers.put("Origin", "https://www.youtube.com");
                headers.put("Referer", "https://www.youtube.com/");
            }
            httpFactory.setDefaultRequestProperties(headers);
        }
        MediaMetadata.Builder meta = new MediaMetadata.Builder()
                .setTitle(title != null && !title.isEmpty() ? title : "Sangeet")
                .setArtist(artist != null && !artist.isEmpty() ? artist : "Sangeet");
        if (artwork != null && !artwork.isEmpty()) {
            try {
                meta.setArtworkUri(Uri.parse(artwork));
            } catch (Exception ignored) {
            }
        }
        byte[] artBytes = currentArtworkBytes;
        if (artBytes == null && artwork != null && !artwork.trim().isEmpty()) {
            artBytes = artworkBytesCache.get(artwork.trim());
        }
        if (artBytes != null && artBytes.length > 0) {
            meta.setArtworkData(artBytes, MediaMetadata.PICTURE_TYPE_FRONT_COVER);
        }
        MediaItem.Builder itemBuilder = new MediaItem.Builder()
                .setUri(Uri.parse(url))
                .setMediaMetadata(meta.build());
        if (url.contains(".m3u8") || url.contains("hls_variant") || url.contains("hls_playlist")) {
            itemBuilder.setMimeType(MimeTypes.APPLICATION_M3U8);
        }
        MediaItem item = itemBuilder.build();
        if (player.getPlayWhenReady()) {
            acquireWakeLock();
        } else {
            releaseWakeLock();
        }
        player.setMediaItem(item);
        player.prepare();
        if (player.getPlayWhenReady()) {
            player.play();
        }
    }

    private void initWakeLock() {
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Sangeet::AudioPlaybackWakeLock");
            wakeLock.setReferenceCounted(false);
        }
    }

    private void acquireWakeLock() {
        if (wakeLock != null && !wakeLock.isHeld()) {
            wakeLock.acquire(4 * 60 * 60 * 1000L);
        }
    }

    private void releaseWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
    }

    @Override
    public void onTaskRemoved(@Nullable Intent rootIntent) {
        if (player == null || !player.isPlaying()) {
            stopSelf();
        }
    }

    @Override
    public void onDestroy() {
        isForeground = false;
        isStopping = true;
        cancelActiveExtraction();
        if (activeService == this) {
            activeService = null;
        }
        mainHandler.removeCallbacks(progressRunnable);
        releaseWakeLock();
        executor.shutdownNow();
        artworkExecutor.shutdownNow();
        artworkCache.evictAll();
        artworkBytesCache.evictAll();
        sessionListeners.clear();
        currentArtworkBitmap = null;
        currentArtworkBytes = null;
        currentArtworkUrl = null;
        inFlightArtworkUrl = null;
        if (mediaSession != null) {
            mediaSession.release();
            mediaSession = null;
        }
        if (player != null) {
            player.release();
            player = null;
        }
        super.onDestroy();
    }
}
