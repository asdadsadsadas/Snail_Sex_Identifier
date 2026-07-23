import { useState, useRef, useCallback, useEffect, type ChangeEvent } from "react";
import { ArrowLeft, User, Image as ImageIcon, Zap, CheckCircle2, Save, RotateCcw, Loader2, Camera as CameraIcon } from "lucide-react";
import { ScreenName, SnailGender, PregnantStatus } from "../types";
import { cn } from "../lib/utils";
import { classifySnailImage, dataUrlToBlob } from "../lib/api";
import { addSnailLog } from "../lib/firebase";

interface ScanScreenProps {
  onNavigate: (screen: ScreenName) => void;
  onSaved: () => void;
}

type ScanPhase = "idle" | "camera" | "classifying" | "result";

export function ScanScreen({ onNavigate, onSaved }: ScanScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [result, setResult] = useState<{
    sex: SnailGender;
    pregnancyStatus: PregnantStatus;
    confidence: number;
    morphologicalNotes: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);

  // ── Camera Lifecycle ──────────────────────────────────────────

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
      setPhase("camera");
    } catch (err) {
      console.error("Camera access denied:", err);
      setError("Camera access was denied. Please allow camera permissions or use the gallery instead.");
      setPhase("idle");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // ── Capture from Camera ───────────────────────────────────────

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setCapturedImage(dataUrl);

    // Stop camera
    stopCamera();

    // Send for classification
    runClassification(dataUrl);
  }, [stopCamera]);

  // ── Gallery Image ──────────────────────────────────────────────

  const handleGalleryPick = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setCapturedImage(dataUrl);
      runClassification(dataUrl);
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be picked again
    e.target.value = "";
  }, []);

  // ── Classification ─────────────────────────────────────────────

  const runClassification = useCallback(async (imageDataUrl: string) => {
    setPhase("classifying");
    setError(null);

    try {
      const blob = dataUrlToBlob(imageDataUrl);
      const prediction = await classifySnailImage(blob);
      setResult(prediction);
      setPhase("result");
    } catch (err) {
      console.error("Classification failed:", err);
      setError("Classification failed. Please try again.");
      setPhase("idle");
      setCapturedImage(null);
    }
  }, []);

  // ── Save to Firestore ─────────────────────────────────────────
  // Photos are stored as base64 data URLs directly in Firestore documents
  // (no extra Storage service needed).

  const handleSave = useCallback(async () => {
    if (!capturedImage || !result) return;

    try {
      // Write document to Firestore with the photo embedded as base64
      await addSnailLog({
        photoUrl: capturedImage,
        date: new Date().toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "numeric",
          hour12: true,
        }),
        gender: result.sex,
        pregnantStatus: result.pregnancyStatus,
        confidence: result.confidence,
        shellLength: null,
        shellWidth: null,
        operculum: null,
        tentacles: null,
        morphologicalNotes: result.morphologicalNotes,
      });

      // Reset and go home
      resetAll();
      onSaved();
    } catch (err) {
      console.error("Save failed:", err);
      setError("Failed to save to Firestore. Please try again.");
    }
  }, [capturedImage, result, onSaved]);

  // ── Retake / Reset ─────────────────────────────────────────────

  const resetAll = useCallback(() => {
    stopCamera();
    setPhase("idle");
    setCapturedImage(null);
    setResult(null);
    setError(null);
  }, [stopCamera]);

  const handleRetake = useCallback(() => {
    resetAll();
  }, [resetAll]);

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="w-full h-full bg-[#2e3132] text-white overflow-hidden relative flex flex-col">
      {/* Header */}
      <header className="absolute top-0 w-full z-40 flex items-center justify-between px-4 h-16">
        <button
          onClick={() => {
            stopCamera();
            onNavigate("Home");
          }}
          className="text-white hover:opacity-80 active:scale-95 transition-all p-2 rounded-full"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-semibold text-white tracking-tight">Snail Sexing AI</h1>
        <button className="text-white hover:opacity-80 active:scale-95 transition-all p-2 rounded-full">
          <User size={24} />
        </button>
      </header>

      {/* Hidden Inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleGalleryPick}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleGalleryPick}
      />

      <main className="flex-grow relative w-full h-full">
        {/* Camera Feed / Captured Image */}
        {phase === "camera" && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover absolute inset-0"
          />
        )}

        {capturedImage && phase === "classifying" && (
          <img
            src={capturedImage}
            alt="Captured snail"
            className="w-full h-full object-cover absolute inset-0 opacity-80"
          />
        )}

        {capturedImage && phase === "result" && (
          <img
            src={capturedImage}
            alt="Captured snail"
            className="w-full h-full object-cover absolute inset-0"
          />
        )}

        {phase === "idle" && (
          <>
            <img
              src="https://images.unsplash.com/photo-1533726749969-2708303f25c7?auto=format&fit=crop&q=80&w=800"
              alt="Snail placeholder"
              className="w-full h-full object-cover absolute inset-0 opacity-80"
            />
            {/* Framing Guide */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4/5 h-1/2 border-2 border-dashed border-white/50 rounded-3xl pointer-events-none shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]">
              <div className="absolute top-[-2px] left-[-2px] w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg" />
              <div className="absolute top-[-2px] right-[-2px] w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg" />
              <div className="absolute bottom-[-2px] left-[-2px] w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg" />
              <div className="absolute bottom-[-2px] right-[-2px] w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg" />
              <p className="absolute -bottom-8 left-0 w-full text-center text-white text-xs font-medium opacity-75">
                Align shell within frame
              </p>
            </div>
          </>
        )}

        {/* Classifying Overlay */}
        {phase === "classifying" && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center z-30">
            <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 flex flex-col items-center gap-4 border border-white/20">
              <Loader2 size={48} className="text-[#8ad3d0] animate-spin" />
              <p className="text-lg font-semibold text-white">Analyzing shell...</p>
              <p className="text-sm text-white/60">Running YOLO classification model</p>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="absolute top-20 left-4 right-4 z-30 bg-red-500/90 backdrop-blur-md rounded-xl p-4 text-white text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
          </div>
        )}

        {/* Bottom Controls – only when idle or camera active */}
        {(phase === "idle" || phase === "camera") && (
          <div className="absolute bottom-0 w-full p-8 flex justify-between items-center bg-gradient-to-t from-black/80 to-transparent pb-32">
            <button
              onClick={() => galleryInputRef.current?.click()}
              className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/30 transition-colors border border-white/20"
              title="Open gallery"
            >
              <ImageIcon size={24} />
            </button>

            {phase === "idle" ? (
              <button
                onClick={startCamera}
                className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center p-1 transition-all duration-200 group active:scale-95"
                title="Open camera"
              >
                <div className="w-full h-full bg-white rounded-full group-hover:bg-[#a6f0ed] transition-colors flex items-center justify-center">
                  <CameraIcon size={28} className="text-[#2e3132]" />
                </div>
              </button>
            ) : (
              <button
                onClick={capturePhoto}
                className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center p-1 transition-all duration-200 group active:scale-95"
                title="Capture photo"
              >
                <div className="w-full h-full bg-white rounded-full group-hover:bg-[#a6f0ed] transition-colors" />
              </button>
            )}

            <button className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/30 transition-colors border border-white/20">
              <Zap size={24} />
            </button>
          </div>
        )}
      </main>

      {/* Hidden Canvas for snapshot */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Result Overlay */}
      {phase === "result" && result && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end pointer-events-none">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto animate-in fade-in duration-300" />

          <div className="bg-[#f8f9fa] w-full rounded-t-3xl shadow-2xl flex flex-col pointer-events-auto relative z-10 pb-8 pt-2 px-6 animate-in slide-in-from-bottom duration-300 ease-out max-h-[75vh] overflow-y-auto">
            <div className="w-full flex justify-center py-2 mb-4">
              <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
            </div>

            <div className="flex flex-col gap-5">
              {/* Header */}
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-widest mb-1">
                  Analysis Complete
                </p>
                <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                  {result.sex}
                  <span className="inline-flex items-center justify-center bg-[#c1ecd4] text-[#002114] px-2 py-1 rounded-md text-sm font-semibold ml-2">
                    <CheckCircle2 size={16} className="mr-1 fill-current" />
                    {result.confidence}%
                  </span>
                </h2>
              </div>

              {/* Pregnancy Status */}
              <div className="bg-white rounded-xl p-4 border border-gray-200 flex items-center gap-4 shadow-sm">
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white shadow-inner",
                    result.pregnancyStatus === "Pregnant" ? "bg-[#2d7a78]" : "bg-gray-400"
                  )}
                >
                  {result.pregnancyStatus === "Pregnant" ? (
                    <Zap size={20} />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
                <div>
                  <p className="text-lg font-semibold text-gray-900">{result.pregnancyStatus}</p>
                  <p className="text-sm text-gray-500">
                    {result.pregnancyStatus === "Pregnant"
                      ? "High confidence of viable offspring."
                      : "No indications of pregnancy detected."}
                  </p>
                </div>
              </div>

              {/* Morphological Notes */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Morphological Features</h3>
                <p className="text-sm text-gray-600 bg-white rounded-xl p-4 border border-gray-200 leading-relaxed">
                  {result.morphologicalNotes}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-4 pt-2">
                <button
                  onClick={handleRetake}
                  className="flex-1 py-3 px-4 rounded-xl border border-[#03615f] text-[#03615f] font-medium text-sm text-center active:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                >
                  <RotateCcw size={16} />
                  Retake Photo
                </button>
                <button
                  onClick={handleSave}
                  className="flex-[2] py-3 px-4 rounded-xl bg-[#2d7a78] text-white font-semibold text-sm text-center active:opacity-90 shadow-lg transition-opacity flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  Save to Log
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes scan {
          0% { top: 0; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
