package xyz.shasant.sangeet;

import android.content.Intent;
import android.net.Uri;
import android.os.Handler;
import android.os.IBinder;
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
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;
import org.schabi.newpipe.extractor.NewPipe;
import org.schabi.newpipe.extractor.ServiceList;
import org.schabi.newpipe.extractor.stream.AudioStream;
import org.schabi.newpipe.extractor.stream.StreamExtractor;

import java.util.List;
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
    private static volatile boolean newPipeInitialized = false;

    private ExoPlayer player;
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
        if (!newPipeInitialized) {
            NewPipe.init(SangeetDownloader.getInstance());
            newPipeInitialized = true;
        }

        AudioAttributes attrs = new AudioAttributes.Builder()
                .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                .setUsage(C.USAGE_MEDIA)
                .build();

        player = new ExoPlayer.Builder(this)
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
                    l.onError("Audio playback error: " + error.getMessage());
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
                    playDirectUrl(url, title, artist, artwork);
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
            try {
                StreamExtractor extractor = ServiceList.YouTube.getStreamExtractor(
                        "https://www.youtube.com/watch?v=" + videoId
                );
                extractor.fetchPage();
                List<AudioStream> audioStreams = extractor.getAudioStreams();
                AudioStream best = null;
                for (AudioStream stream : audioStreams) {
                    if (stream.getContent() == null || stream.getContent().isEmpty()) continue;
                    if (best == null) {
                        best = stream;
                    } else {
                        boolean isM4a = stream.getFormat() != null && "M4A".equalsIgnoreCase(stream.getFormat().name());
                        boolean bestIsM4a = best.getFormat() != null && "M4A".equalsIgnoreCase(best.getFormat().name());
                        if (isM4a && !bestIsM4a) {
                            best = stream;
                        } else if (isM4a == bestIsM4a && stream.getAverageBitrate() > best.getAverageBitrate()) {
                            best = stream;
                        }
                    }
                }
                if (best == null) {
                    throw new IllegalStateException("No playable audio stream found");
                }
                final String streamUrl = best.getContent();
                mainHandler.post(() -> {
                    if (token != activeRequestToken) return;
                    playDirectUrl(streamUrl, title, artist, artwork);
                });
            } catch (Exception e) {
                mainHandler.post(() -> {
                    if (token != activeRequestToken) return;
                    EventListener errListener = listener;
                    if (errListener != null) {
                        errListener.onError("Could not load track audio.");
                    }
                });
            }
        });
    }

    private void playDirectUrl(String url, @Nullable String title, @Nullable String artist, @Nullable String artwork) {
        if (player == null) return;
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
        // Keep playing in background if actively playing; stop only if paused/idle.
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
