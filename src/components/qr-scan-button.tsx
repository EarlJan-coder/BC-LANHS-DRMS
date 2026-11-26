"use client";

import jsQR from "jsqr";
import { Camera, CameraOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

function verificationValue(raw: string) {
  try {
    const url = new URL(raw);
    const code = url.searchParams.get("code");
    if (code) return code;
    const parts = url.pathname.split("/").filter(Boolean);
    return decodeURIComponent(parts.at(-1) ?? raw);
  } catch {
    return raw.trim();
  }
}

export function QrScanButton() {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  async function startCamera() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera scanning is unavailable in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setScanning(true);
      scanFrame();
    } catch {
      stopCamera();
      setError("Camera access was unavailable. Check your browser permission and try again.");
    }
  }

  function stopCamera() {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setScanning(false);
  }

  function scanFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { willReadFrequently: true });
    if (video && canvas && context && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      const scale = Math.min(1, 720 / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      const result = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });
      if (result?.data) {
        const code = verificationValue(result.data);
        stopCamera();
        router.push(`/verify?code=${encodeURIComponent(code)}`);
        return;
      }
    }
    frameRef.current = requestAnimationFrame(scanFrame);
  }

  return (
    <div className="grid gap-3">
      <Button type="button" tone="secondary" onClick={scanning ? stopCamera : startCamera}>
        {scanning ? <CameraOff className="h-4 w-4" aria-hidden /> : <Camera className="h-4 w-4" aria-hidden />}
        {scanning ? "Stop camera" : "Scan QR code"}
      </Button>
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      <div className={scanning ? "overflow-hidden rounded-xl border border-border bg-slate-950 p-2" : "hidden"}>
          <video ref={videoRef} muted playsInline className="aspect-[4/3] w-full rounded-lg object-cover" aria-label="Camera preview for QR scanning" />
          <p className="px-2 py-3 text-center text-xs font-medium text-white/80">Center the certificate QR code in the camera view.</p>
      </div>
      <canvas ref={canvasRef} className="hidden" aria-hidden />
    </div>
  );
}
