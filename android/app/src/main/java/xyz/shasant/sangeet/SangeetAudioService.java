package xyz.shasant.sangeet;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
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
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class SangeetAudioService extends MediaSessionService {
    public static final String ACTION_PLAY_YOUTUBE = "xyz.shasant.sangeet.PLAY_YOUTUBE";
    public static final String ACTION_PLAY_URL = "xyz.shasant.sangeet.PLAY_URL";
    public static final String ACTION_PAUSE = "xyz.shasant.sangeet.PAUSE";
    public static final String ACTION_RESUME = "xyz.shasant.sangeet.RESUME";
    public static final String ACTION_SEEK = "xyz.shasant.sangeet.SEEK";
    public static final String ACTION_STOP = "xyz.shasant.sangeet.STOP";
    public static final String ACTION_VOLUME = "xyz.shasant.sangeet.VOLUME";
    public static final String ACTION_SPEED = "xyz.shasant.sangeet.SPEED";

    public static final String EXTRA_VIDEO_ID = "videoId";
    public static final String EXTRA_URL = "url";
    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_ARTIST = "artist";
    public static final String EXTRA_ARTWORK = "artwork";
    public static final String EXTRA_SEEK_MS = "seekMs";
    public static final String EXTRA_VOLUME = "volume";
    public static final String EXTRA_SPEED = "speed";

    private static final String CHANNEL_ID = "sangeet_playback";
    private static final int NOTIFICATION_ID = 1001;

    public interface EventListener {
        void onState(String state);
        void onTime(double currentSec, double durationSec);
        void onAction(String action);
        void onError(String message);
    }

    private static volatile EventListener listener;
    private static volatile SangeetAudioService activeService;

    private ExoPlayer player;
    private DefaultHttpDataSource.Factory httpFactory;
    private MediaSession mediaSession;
    private PowerManager.WakeLock wakeLock;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private volatile long activeRequestToken = 0;
    private volatile boolean isForeground = false;
    private volatile boolean isStopping = false;
    private List<YouTubeInnerTubeExtractor.StreamResult> pendingCandidates = Collections.emptyList();
    private int pendingCandidateIndex = 0;
    private String pendingTitle;
    private String pendingArtist;
    private String pendingArtwork;
    @Nullable private String currentTitle;
    @Nullable private String currentArtist;

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
                long durMs = Math.max(0, player.getDuration());
                EventListener l = listener;
                if (l != null) {
                    l.onTime(posMs / 1000.0, durMs == C.TIME_UNSET ? 0.0 : durMs / 1000.0);
                }
            }
            mainHandler.postDelayed(this, 800);
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        activeService = this;
        isStopping = false;
        initWakeLock();
        createPlaybackNotificationChannel();
        httpFactory = new DefaultHttpDataSource.Factory()
                .setAllowCrossProtocolRedirects(true)
                .setConnectTimeoutMs(12000)
                .setReadTimeoutMs(15000);

        DefaultDataSource.Factory dataSourceFactory = new DefaultDataSource.Factory(this, httpFactory);

        AudioAttributes attrs = new AudioAttributes.Builder()
                .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                .setUsage(C.USAGE_MEDIA)
                .build();

        player = new ExoPlayer.Builder(this)
                .setMediaSourceFactory(new DefaultMediaSourceFactory(dataSourceFactory))
                .setAudioAttributes(attrs, true)
                .setHandleAudioBecomingNoisy(true)
                .build();
        player.setWakeMode(C.WAKE_MODE_NETWORK);

        player.addListener(new Player.Listener() {
            @Override
            public void onIsPlayingChanged(boolean isPlaying) {
                if (isPlaying) {
                    acquireWakeLock();
                } else {
                    releaseWakeLock();
                }
                EventListener l = listener;
                if (l != null) {
                    if (isPlaying) {
                        l.onState("playing");
                    } else if (player != null && player.getPlayWhenReady()) {
                        // Media3 reports isPlaying=false while buffering. Treating that as a pause
                        // made the web player icon and lyrics flicker during normal network stalls.
                        l.onState("buffering");
                    } else {
                        l.onState("paused");
                    }
                }
            }

            @Override
            public void onPlaybackStateChanged(int playbackState) {
                EventListener l = listener;
                if (l == null) return;
                if (playbackState == Player.STATE_BUFFERING) {
                    l.onState(player.getPlayWhenReady() ? "buffering" : "paused");
                } else if (playbackState == Player.STATE_ENDED) {
                    l.onState("ended");
                } else if (playbackState == Player.STATE_READY) {
                    long durMs = Math.max(0, player.getDuration());
                    long posMs = Math.max(0, player.getCurrentPosition());
                    l.onTime(posMs / 1000.0, durMs == C.TIME_UNSET ? 0.0 : durMs / 1000.0);
                    l.onState(player.isPlaying() || player.getPlayWhenReady() ? "playing" : "paused");
                }
            }

            @Override
            public void onPlayerError(@NonNull PlaybackException error) {
                if (pendingCandidates != null && pendingCandidateIndex + 1 < pendingCandidates.size()) {
                    pendingCandidateIndex++;
                    YouTubeInnerTubeExtractor.StreamResult next = pendingCandidates.get(pendingCandidateIndex);
                    playDirectUrl(next.url, next.userAgent, true, pendingTitle, pendingArtist, pendingArtwork);
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
            @NonNull
            @Override
            public Player.Commands getAvailableCommands() {
                return super.getAvailableCommands().buildUpon()
                        .add(COMMAND_SEEK_TO_NEXT)
                        .add(COMMAND_SEEK_TO_PREVIOUS)
                        .build();
            }

            @Override
            public boolean isCommandAvailable(int command) {
                if (command == COMMAND_SEEK_TO_NEXT || command == COMMAND_SEEK_TO_PREVIOUS) {
                    return true;
                }
                return super.isCommandAvailable(command);
            }

            @Override
            public void seekToNext() {
                EventListener l = listener;
                if (l != null) l.onAction("next");
            }

            @Override
            public void seekToPrevious() {
                EventListener l = listener;
                if (l != null) l.onAction("previous");
            }
        };

        mediaSession = new MediaSession.Builder(this, forwardingPlayer).build();
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
            case ACTION_PLAY_YOUTUBE: {
                String videoId = intent.getStringExtra(EXTRA_VIDEO_ID);
                String title = intent.getStringExtra(EXTRA_TITLE);
                String artist = intent.getStringExtra(EXTRA_ARTIST);
                String artwork = intent.getStringExtra(EXTRA_ARTWORK);
                if (videoId != null && !videoId.isEmpty()) {
                    currentTitle = title;
                    currentArtist = artist;
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
                    pendingCandidates = Collections.emptyList();
                    pendingCandidateIndex = 0;
                    currentTitle = title;
                    currentArtist = artist;
                    ensureForegroundNotification(title, artist);
                    playDirectUrl(url, null, false, title, artist, artwork);
                }
                break;
            }
            case ACTION_PAUSE:
                releaseWakeLock();
                if (player != null) player.pause();
                break;
            case ACTION_RESUME:
                ensureForegroundNotification(currentTitle, currentArtist);
                acquireWakeLock();
                if (player != null) player.play();
                break;
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
                activeRequestToken++;
                pendingCandidates = Collections.emptyList();
                pendingCandidateIndex = 0;
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

    private Notification buildNotification(@Nullable String title, @Nullable String artist) {
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            piFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent contentIntent = PendingIntent.getActivity(this, 0, openIntent, piFlags);

        String safeTitle = (title != null && !title.isEmpty()) ? title : "Sangeet";
        String safeArtist = (artist != null && !artist.isEmpty()) ? artist : "Playing audio";

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.sangeet_icon)
                .setContentTitle(safeTitle)
                .setContentText(safeArtist)
                .setContentIntent(contentIntent)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .build();
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

    private void playYouTubeVideo(String videoId, @Nullable String title, @Nullable String artist, @Nullable String artwork) {
        final long token = ++activeRequestToken;
        pendingCandidates = Collections.emptyList();
        pendingCandidateIndex = 0;
        EventListener l = listener;
        if (l != null) l.onState("buffering");

        executor.execute(() -> {
            List<YouTubeInnerTubeExtractor.StreamResult> results = YouTubeInnerTubeExtractor.extractAll(videoId);
            mainHandler.post(() -> {
                if (token != activeRequestToken) return;
                if (results == null || results.isEmpty()) {
                    releaseWakeLock();
                    EventListener errListener = listener;
                    if (errListener != null) {
                        errListener.onError("fallback_iframe");
                    }
                    return;
                }
                pendingCandidates = results;
                pendingCandidateIndex = 0;
                pendingTitle = title;
                pendingArtist = artist;
                pendingArtwork = artwork;
                YouTubeInnerTubeExtractor.StreamResult first = pendingCandidates.get(0);
                playDirectUrl(first.url, first.userAgent, true, title, artist, artwork);
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
        MediaItem.Builder itemBuilder = new MediaItem.Builder()
                .setUri(Uri.parse(url))
                .setMediaMetadata(meta.build());
        if (url.contains(".m3u8") || url.contains("hls_variant") || url.contains("hls_playlist")) {
            itemBuilder.setMimeType(MimeTypes.APPLICATION_M3U8);
        }
        MediaItem item = itemBuilder.build();
        acquireWakeLock();
        player.setMediaItem(item);
        player.prepare();
        player.play();
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
        if (activeService == this) {
            activeService = null;
        }
        mainHandler.removeCallbacks(progressRunnable);
        releaseWakeLock();
        executor.shutdownNow();
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
