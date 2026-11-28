package xyz.shasant.sangeet;

import androidx.media3.common.C;
import androidx.media3.common.audio.AudioProcessor;
import androidx.media3.common.audio.BaseAudioProcessor;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;

/**
 * Dhun's own audio effects, applied inside ExoPlayer's audio pipeline to every
 * song the native player plays (YouTube, streams, downloads):
 *
 *  - 5-band equalizer (60 Hz low-shelf, 230 / 910 / 3600 Hz peaking, 14 kHz
 *    high-shelf) using the same RBJ biquad formulas as Web Audio's
 *    BiquadFilterNode, so presets sound the same on web and Android.
 *  - Spatial sound for stereo music on headphones:
 *      natural    = wider stereo image + speaker-style crossfeed
 *      immersive  = wider still + crossfeed + early "room" reflections
 *
 * Implemented in plain Java (not android.media.audiofx) so it behaves the same
 * on every phone. Settings change live; no re-buffering.
 */
public final class DhunAudioEffects extends BaseAudioProcessor {

    public static final int SPATIAL_OFF = 0;
    public static final int SPATIAL_NATURAL = 1;
    public static final int SPATIAL_IMMERSIVE = 2;

    private static final double[] FREQS = {60, 230, 910, 3600, 14000};
    private static final double PEAK_Q = 1.1;

    // ---- shared settings (written from the JS bridge thread) ----
    private static volatile boolean eqEnabled = false;
    private static volatile double[] eqGainsDb = new double[5];
    private static volatile int spatialMode = SPATIAL_OFF;
    private static volatile int settingsVersion = 0;

    public static void setEqualizer(boolean enabled, double[] gainsDb) {
        double[] g = new double[5];
        for (int i = 0; i < 5; i++) {
            double v = gainsDb != null && i < gainsDb.length ? gainsDb[i] : 0;
            g[i] = Math.max(-12, Math.min(12, Double.isNaN(v) ? 0 : v));
        }
        eqGainsDb = g;
        eqEnabled = enabled;
        settingsVersion++;
    }

    public static void setSpatialMode(int mode) {
        spatialMode = (mode == SPATIAL_NATURAL || mode == SPATIAL_IMMERSIVE) ? mode : SPATIAL_OFF;
        settingsVersion++;
    }

    // ---- per-instance DSP state ----
    private int sampleRate;
    private int channels;
    private int encoding;
    private int appliedVersion = -1;

    private boolean eqOn;
    private final double[][] coef = new double[5][5]; // b0 b1 b2 a1 a2 (normalised)
    private double[][][] z;                            // [channel][band][z1,z2]
    private double preGain = 1.0;

    private int spatial;
    private double widenA = 1, widenB = 0, crossfeed = 0, outGain = 1;
    private static final int RING = 4096;              // ~85 ms at 48 kHz
    private final double[] ringL = new double[RING];
    private final double[] ringR = new double[RING];
    private int ringPos = 0;
    private int crossfeedDelay;
    private double cfLpL, cfLpR, cfAlpha;              // one-pole low-pass on the crossfeed path
    private int[] reflDelay = new int[0];
    private double[] reflGain = new double[0];
    private double reflLpL, reflLpR, reflAlpha;

    @Override
    protected AudioProcessor.AudioFormat onConfigure(AudioProcessor.AudioFormat in)
            throws AudioProcessor.UnhandledAudioFormatException {
        boolean pcm = in.encoding == C.ENCODING_PCM_16BIT || in.encoding == C.ENCODING_PCM_FLOAT;
        if (!pcm || in.channelCount < 1 || in.channelCount > 2) {
            // Not ours to process (e.g. surround): stay inactive so playback continues untouched.
            return AudioProcessor.AudioFormat.NOT_SET;
        }
        sampleRate = in.sampleRate;
        channels = in.channelCount;
        encoding = in.encoding;
        z = new double[channels][5][2];
        appliedVersion = -1;
        return in; // same format out: we only change sample values
    }

    private void refreshSettings() {
        int v = settingsVersion;
        if (v == appliedVersion) return;
        appliedVersion = v;

        double[] g = eqGainsDb;
        eqOn = eqEnabled;
        double maxBoost = 0, sum = 0;
        for (int i = 0; i < 5; i++) {
            double gain = eqOn ? g[i] : 0;
            maxBoost = Math.max(maxBoost, gain);
            sum += gain;
            designBand(i, gain);
        }
        // Headroom so boosted presets don't distort: half the biggest single-band
        // boost, or the whole average boost when many bands are raised together.
        // The soft clipper only catches rare peaks after that.
        double headroomDb = Math.max(maxBoost * 0.5, Math.max(0, sum / 5.0));
        preGain = Math.pow(10, -headroomDb / 20.0);

        spatial = channels == 2 ? spatialMode : SPATIAL_OFF;
        double width;
        if (spatial == SPATIAL_NATURAL) {
            width = 1.3;
            crossfeed = 0.18;
            reflDelay = new int[0];
            reflGain = new double[0];
        } else if (spatial == SPATIAL_IMMERSIVE) {
            width = 1.55;
            crossfeed = 0.22;
            double[] ms = {7.1, 11.3, 17.9, 23.7, 31.3};
            double[] gs = {0.20, 0.16, 0.12, 0.09, 0.06};
            reflDelay = new int[ms.length];
            reflGain = gs;
            for (int i = 0; i < ms.length; i++) {
                reflDelay[i] = Math.min(RING - 1, (int) Math.round(ms[i] / 1000.0 * sampleRate));
            }
        } else {
            width = 1.0;
            crossfeed = 0;
            reflDelay = new int[0];
            reflGain = new double[0];
        }
        // L' = a*L + b*R ; R' = b*L + a*R  (mid/side widening)
        widenA = (1 + width) / 2;
        widenB = (1 - width) / 2;
        crossfeedDelay = Math.max(1, (int) Math.round(0.00027 * sampleRate));
        cfAlpha = onePoleAlpha(700);
        reflAlpha = onePoleAlpha(4500);
        double reflSum = 0;
        for (double r : reflGain) reflSum += r;
        outGain = spatial == SPATIAL_OFF ? 1 : 1.0 / (1 + crossfeed + reflSum * 0.5);
    }

    private double onePoleAlpha(double cutoffHz) {
        return 1 - Math.exp(-2 * Math.PI * cutoffHz / sampleRate);
    }

    /** RBJ Audio EQ Cookbook, matching the Web Audio BiquadFilterNode definitions. */
    private void designBand(int band, double gainDb) {
        double f = Math.min(FREQS[band], sampleRate * 0.45);
        double w0 = 2 * Math.PI * f / sampleRate;
        double cos = Math.cos(w0);
        double sin = Math.sin(w0);
        double A = Math.pow(10, gainDb / 40.0);
        double b0, b1, b2, a0, a1, a2;
        if (gainDb == 0) {
            coef[band][0] = 1; coef[band][1] = 0; coef[band][2] = 0; coef[band][3] = 0; coef[band][4] = 0;
            return;
        }
        if (band == 0 || band == 4) {
            double alpha = sin / 2 * Math.sqrt(2); // shelf slope S = 1
            double sqA = 2 * Math.sqrt(A) * alpha;
            if (band == 0) { // low shelf
                b0 = A * ((A + 1) - (A - 1) * cos + sqA);
                b1 = 2 * A * ((A - 1) - (A + 1) * cos);
                b2 = A * ((A + 1) - (A - 1) * cos - sqA);
                a0 = (A + 1) + (A - 1) * cos + sqA;
                a1 = -2 * ((A - 1) + (A + 1) * cos);
                a2 = (A + 1) + (A - 1) * cos - sqA;
            } else { // high shelf
                b0 = A * ((A + 1) + (A - 1) * cos + sqA);
                b1 = -2 * A * ((A - 1) + (A + 1) * cos);
                b2 = A * ((A + 1) + (A - 1) * cos - sqA);
                a0 = (A + 1) - (A - 1) * cos + sqA;
                a1 = 2 * ((A - 1) - (A + 1) * cos);
                a2 = (A + 1) - (A - 1) * cos - sqA;
            }
        } else { // peaking
            double alpha = sin / (2 * PEAK_Q);
            b0 = 1 + alpha * A;
            b1 = -2 * cos;
            b2 = 1 - alpha * A;
            a0 = 1 + alpha / A;
            a1 = -2 * cos;
            a2 = 1 - alpha / A;
        }
        coef[band][0] = b0 / a0;
        coef[band][1] = b1 / a0;
        coef[band][2] = b2 / a0;
        coef[band][3] = a1 / a0;
        coef[band][4] = a2 / a0;
    }

    private double eq(int ch, double x) {
        for (int b = 0; b < 5; b++) {
            double[] c = coef[b];
            if (c[0] == 1 && c[1] == 0 && c[2] == 0 && c[3] == 0 && c[4] == 0) continue;
            double[] s = z[ch][b];
            // transposed direct form II
            double y = c[0] * x + s[0];
            s[0] = c[1] * x - c[3] * y + s[1];
            s[1] = c[2] * x - c[4] * y;
            x = y;
        }
        return x;
    }

    private static double softClip(double x) {
        if (x > 0.9) return 0.9 + 0.1 * Math.tanh((x - 0.9) / 0.1);
        if (x < -0.9) return -0.9 + 0.1 * Math.tanh((x + 0.9) / 0.1);
        return x;
    }

    @Override
    public void queueInput(ByteBuffer input) {
        int remaining = input.remaining();
        if (remaining == 0) return;
        refreshSettings();
        ByteBuffer out = replaceOutputBuffer(remaining);
        boolean isFloat = encoding == C.ENCODING_PCM_FLOAT;
        int bytesPerSample = isFloat ? 4 : 2;
        int frames = remaining / (bytesPerSample * channels);
        ByteBuffer in = input.order(ByteOrder.nativeOrder());
        boolean passthrough = !eqOn && spatial == SPATIAL_OFF;

        for (int i = 0; i < frames; i++) {
            double l = isFloat ? in.getFloat() : in.getShort() / 32768.0;
            double r = channels == 2 ? (isFloat ? in.getFloat() : in.getShort() / 32768.0) : l;

            if (!passthrough) {
                if (eqOn) {
                    l = eq(0, l * preGain);
                    if (channels == 2) r = eq(1, r * preGain);
                }
                if (spatial != SPATIAL_OFF) {
                    ringL[ringPos] = l;
                    ringR[ringPos] = r;
                    double wl = widenA * l + widenB * r;
                    double wr = widenB * l + widenA * r;

                    int cf = (ringPos - crossfeedDelay + RING) % RING;
                    cfLpL += cfAlpha * (ringR[cf] - cfLpL);   // right ear hears a little of the left speaker...
                    cfLpR += cfAlpha * (ringL[cf] - cfLpR);   // ...and vice versa, slightly later and duller
                    wl += crossfeed * cfLpL;
                    wr += crossfeed * cfLpR;

                    if (reflDelay.length > 0) {
                        double rl = 0, rr = 0;
                        for (int k = 0; k < reflDelay.length; k++) {
                            int p = (ringPos - reflDelay[k] + RING) % RING;
                            // alternate sides so reflections arrive from around the listener
                            if ((k & 1) == 0) { rl += reflGain[k] * ringR[p]; rr += reflGain[k] * ringL[p]; }
                            else { rl += reflGain[k] * ringL[p]; rr += reflGain[k] * ringR[p]; }
                        }
                        reflLpL += reflAlpha * (rl - reflLpL);
                        reflLpR += reflAlpha * (rr - reflLpR);
                        wl += reflLpL;
                        wr += reflLpR;
                    }
                    ringPos = (ringPos + 1) % RING;
                    l = wl * outGain;
                    r = wr * outGain;
                }
                l = softClip(l);
                r = softClip(r);
            }

            if (isFloat) {
                out.putFloat((float) l);
                if (channels == 2) out.putFloat((float) r);
            } else {
                out.putShort(toShort(l));
                if (channels == 2) out.putShort(toShort(r));
            }
        }
        input.position(input.limit());
        out.flip();
    }

    private static short toShort(double v) {
        double s = Math.round(v * 32767.0);
        if (s > 32767) s = 32767;
        if (s < -32768) s = -32768;
        return (short) s;
    }

    private void clearState() {
        if (z != null) {
            for (double[][] ch : z) for (double[] b : ch) { b[0] = 0; b[1] = 0; }
        }
        java.util.Arrays.fill(ringL, 0);
        java.util.Arrays.fill(ringR, 0);
        ringPos = 0;
        cfLpL = cfLpR = reflLpL = reflLpR = 0;
    }

    @Override
    protected void onFlush() {
        clearState();
    }

    @Override
    protected void onReset() {
        clearState();
        appliedVersion = -1;
    }
}
