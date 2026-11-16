package xyz.shasant.sangeet;

import androidx.annotation.NonNull;
import okhttp3.OkHttpClient;
import okhttp3.RequestBody;
import okhttp3.ResponseBody;
import org.schabi.newpipe.extractor.downloader.Downloader;
import org.schabi.newpipe.extractor.downloader.Request;
import org.schabi.newpipe.extractor.downloader.Response;
import org.schabi.newpipe.extractor.exceptions.ReCaptchaException;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

public final class SangeetDownloader extends Downloader {
    private static SangeetDownloader instance;
    private final OkHttpClient client;

    private SangeetDownloader() {
        this.client = new OkHttpClient.Builder()
                .readTimeout(25, TimeUnit.SECONDS)
                .connectTimeout(15, TimeUnit.SECONDS)
                .build();
    }

    public static synchronized SangeetDownloader getInstance() {
        if (instance == null) {
            instance = new SangeetDownloader();
        }
        return instance;
    }

    @Override
    public Response execute(@NonNull Request request) throws IOException, ReCaptchaException {
        okhttp3.Request.Builder builder = new okhttp3.Request.Builder()
                .url(request.url());

        for (Map.Entry<String, List<String>> entry : request.headers().entrySet()) {
            String key = entry.getKey();
            for (String value : entry.getValue()) {
                builder.addHeader(key, value);
            }
        }

        byte[] data = request.dataToSend();
        if ("POST".equalsIgnoreCase(request.httpMethod())) {
            RequestBody body = RequestBody.create(data != null ? data : new byte[0]);
            builder.post(body);
        } else if ("HEAD".equalsIgnoreCase(request.httpMethod())) {
            builder.head();
        } else {
            builder.get();
        }

        try (okhttp3.Response res = client.newCall(builder.build()).execute()) {
            if (res.code() == 429) {
                throw new ReCaptchaException("reCaptcha Challenge requested", request.url());
            }
            ResponseBody resBody = res.body();
            String bodyString = resBody != null ? resBody.string() : "";
            String latestUrl = res.request().url().toString();
            return new Response(
                    res.code(),
                    res.message(),
                    res.headers().toMultimap(),
                    bodyString,
                    latestUrl
            );
        }
    }
}
