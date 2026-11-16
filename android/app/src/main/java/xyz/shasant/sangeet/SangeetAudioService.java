package xyz.shasant.sangeet;

import android.content.Intent;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.ForwardingPlayer;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;

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

    public interface EventListener {
        void onState(String state);
        void onTime(double currentSec, double durationSec);
        void onAction(String action);
        void onError(String message);
    }

    private static volatile EventListener listener;

    private ExoPlayer player;
    private DefaultHttpDataSource.Factory httpFactory;
    private MediaSession mediaSession;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private volatile long activeRequestToken = 0;

    public static void setEventListener(@Nullable EventListener l) {
        listener = l;
    }

    private final Runnable progressRunnable = new Runnable() {
        @Override
        public void run() {
            if (player != null && player.isPlaying()) {
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

        player.addListener(new Player.Listener() {
            @Override
            public void onIsPlayingChanged(boolean isPlaying) {
                EventListener l = listener;
                if (l != null) {
                    l.onState(isPlaying ? "playing" : "paused");
                }
            }

            @Override
            public void onPlaybackStateChanged(int playbackState) {
                EventListener l = listener;
                if (l == null) return;
                if (playbackState == Player.STATE_BUFFERING) {
                    l.onState("buffering");
                } else if (playbackState == Player.STATE_ENDED) {
                    l.onState("ended");
                } else if (playbackState == Player.STATE_READY) {
                    long durMs = Math.max(0, player.getDuration());
                    long posMs = Math.max(0, player.getCurrentPosition());
                    l.onTime(posMs / 1000.0, durMs == C.TIME_UNSET ? 0.0 : durMs / 1000.0);
                    l.onState(player.isPlaying() ? "playing" : "paused");
                }
            }

            @Override
            public void onPlayerError(@NonNull PlaybackException error) {
                EventListener l = listener;
                if (l != null) {
                    l.onError("fallback_iframe");
                }
            }
        });

        ForwardingPlayer forwardingPlayer = new ForwardingPlayer(player) {
            @Override
            public int getAvailableCommands() {
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
        if (intent == null || intent.getAction() == null) {
            return START_STICKY;
        }
        String action = intent.getAction();
        switch (action) {
            case ACTION_PLAY_YOUTUBE: {
                String videoId = intent.getStringExtra(EXTRA_VIDEO_ID);
                String title = intent.getStringExtra(EXTRA_TITLE);
                String artist = intent.getStringExtra(EXTRA_ARTIST);
                String artwork = intent.getStringExtra(EXTRA_ARTWORK);
                if (videoId != null && !videoId.isEmpty()) {
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
                    playDirectUrl(url, null, title, artist, artwork);
                }
                break;
            }
            case ACTION_PAUSE:
                if (player != null) player.pause();
                break;
            case ACTION_RESUME:
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
                activeRequestToken++;
                if (player != null) {
                    player.stop();
                    player.clearMediaItems();
                }
                stopForeground(STOP_FOREGROUND_REMOVE);
                stopSelf();
                break;
        }
        return START_STICKY;
    }

    private void playYouTubeVideo(String videoId, @Nullable String title, @Nullable String artist, @Nullable String artwork) {
        final long token = ++activeRequestToken;
        EventListener l = listener;
        if (l != null) l.onState("buffering");

        executor.execute(() -> {
            YouTubeInnerTubeExtractor.StreamResult result = YouTubeInnerTubeExtractor.extract(videoId);
            mainHandler.post(() -> {
                if (token != activeRequestToken) return;
                if (result == null) {
                    EventListener errListener = listener;
                    if (errListener != null) {
                        errListener.onError("fallback_iframe");
                    }
                    return;
                }
                playDirectUrl(result.url, result.userAgent, title, artist, artwork);
            });
        });
    }

    private void playDirectUrl(
            String url,
            @Nullable String userAgent,
            @Nullable String title,
            @Nullable String artist,
            @Nullable String artwork
    ) {
        if (player == null) return;
        if (httpFactory != null && userAgent != null) {
            httpFactory.setUserAgent(userAgent);
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
        MediaItem item = new MediaItem.Builder()
                .setUri(url)
                .setMediaMetadata(meta.build())
                .build();
        player.setMediaItem(item);
        player.prepare();
        player.play();
    }

    @Override
    public void onTaskRemoved(@Nullable Intent rootIntent) {
        if (player == null || !player.isPlaying()) {
            stopSelf();
        }
    }

    @Override
    public void onDestroy() {
        mainHandler.removeCallbacks(progressRunnable);
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
