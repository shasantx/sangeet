"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { Camera, Loader2, X } from "lucide-react";

export function QrCodePreview({ value, size = 148 }: { value: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, {
      width: size * 2,
      margin: 2,
      color: {
        dark: "#080908",
        light: "#ffffff",
      },
    })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {
        if (active) setDataUrl("");
      });
    return () => {
      active = false;
    };
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div
        className="mx-auto flex items-center justify-center rounded-xl bg-white/10"
        style={{ width: size, height: size }}
      >
        <Loader2 className="h-5 w-5 animate-spin text-[#1ed760]" />
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      alt="Room QR Code"
      width={size}
      height={size}
      className="mx-auto rounded-xl border-4 border-white bg-white shadow-md"
    />
  );
}

export function QrScannerView({
  onDetected,
  onClose,
}: {
  onDetected: (rawText: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let active = true;
    let stream: MediaStream | null = null;
    let rafId = 0;
    let lastScan = 0;

    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError("Camera access is not available in this browser.");
          setStarting(false);
          return;
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setStarting(false);

        const tick = (now: number) => {
          if (!active) return;
          if (now - lastScan > 180 && video.readyState >= 2) {
            lastScan = now;
            const canvas = canvasRef.current;
            if (canvas && video.videoWidth > 0 && video.videoHeight > 0) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              const ctx = canvas.getContext("2d", { willReadFrequently: true });
              if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const decoded = jsQR(imgData.data, imgData.width, imgData.height, {
                  inversionAttempts: "dontInvert",
                });
                if (decoded?.data) {
                  active = false;
                  onDetected(decoded.data);
                  return;
                }
              }
            }
          }
          rafId = window.requestAnimationFrame(tick);
        };
        rafId = window.requestAnimationFrame(tick);
      } catch {
        if (active) {
          setError("Could not open camera. Allow camera permission or paste the Room Code.");
          setStarting(false);
        }
      }
    };

    void start();

    return () => {
      active = false;
      if (rafId) window.cancelAnimationFrame(rafId);
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [onDetected]);

  return (
    <div className="mt-3 rounded-2xl border border-white/15 bg-black/70 p-3 text-center">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 font-semibold text-white">
          <Camera className="h-3.5 w-3.5 text-[#1ed760]" />
          Point camera at Sangeet QR
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close scanner"
          className="flex h-6 w-6 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {error ? (
        <p className="py-6 text-[11px] text-rose-300">{error}</p>
      ) : (
        <div className="relative mx-auto aspect-square w-full max-w-[220px] overflow-hidden rounded-xl border border-[#1ed760]/40 bg-black">
          <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
          <canvas ref={canvasRef} className="hidden" />
          {starting && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <Loader2 className="h-5 w-5 animate-spin text-[#1ed760]" />
            </div>
          )}
          <div className="pointer-events-none absolute inset-5 rounded-lg border-2 border-[#1ed760]/60" />
        </div>
      )}
    </div>
  );
}
