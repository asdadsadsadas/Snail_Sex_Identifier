import { useState, useRef, useCallback, useEffect, type ChangeEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Camera,
  ScanLine,
  Loader2,
  CheckCircle2,
  XCircle,
  Venus,
  Mars,
  Baby,
  RefreshCw,
  Save,
  RotateCcw,
  ImagePlus,
  CameraOff,
} from "lucide-react";
import { classifySnailImage, dataUrlToBlob } from "../lib/api";
import { addSnailLog } from "../lib/firebase";
import { cn, compressImage } from "../lib/utils";
import type { ClassificationResult } from "../lib/api";

interface ScanScreenProps {
  onNavigate: (screen: string) => void;
}

export function ScanScreen({ onNavigate }: ScanScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraDenied, setCameraDenied] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [classifying, setClassifying] = useState(false);
  const [result, setResult] = useState<ClassificationResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);

  // ── Camera management ──────────────────────────────────────────

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setTorchOn(false);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setCameraStarting(true);
      setError(null);
      setCameraDenied(false);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch (err) {
      console.error("Camera start failed:", err);
      setCameraDenied(true);
      setError("Camera unavailable. Use gallery upload instead.");
    } finally {
      setCameraStarting(false);
    }
  }, []);

  // Stop camera on unmount
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  // ── Torch / Flash ──────────────────────────────────────────────

  const toggleTorch = useCallback(async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    try {
      await (track as any).applyConstraints({
        advanced: [{ torch: !torchOn }],
      });
      setTorchOn(!torchOn);
    } catch {
      // Torch not supported on this device — ignore silently
    }
  }, [torchOn]);

  // ── Classification ──────────────────────────────────────────────

  const classifyImage = useCallback(async (dataUrl: string) => {
    setClassifying(true);
    setResult(null);
    setSaved(false);
    setError(null);

    try {
      const blob = dataUrlToBlob(dataUrl);
      const classification = await classifySnailImage(blob);
      setResult(classification);
    } catch (err) {
      setError("Classification failed. Please try again.");
      console.error(err);
    } finally {
      setClassifying(false);
    }
  }, []);

  // ── Capture ─────────────────────────────────────────────────────

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const maxDim = 720;
    const scale = Math.min(maxDim / video.videoWidth, maxDim / video.videoHeight, 1);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    setCapturedImage(dataUrl);
    stopCamera();

    classifyImage(dataUrl);
  }, [stopCamera, classifyImage]);

  // ── Upload ──────────────────────────────────────────────────────

  const handleFileUpload = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (ev) => {
        const dataUrl = ev.target?.result as string;
        const compressed = await compressImage(dataUrl, 720, 0.8);
        setCapturedImage(compressed);
        stopCamera();
        classifyImage(compressed);
      };
      reader.readAsDataURL(file);

      e.target.value = "";
    },
    [stopCamera, classifyImage]
  );

  // ── Retake / Reset ──────────────────────────────────────────────

  const goToWelcome = useCallback(() => {
    stopCamera();
    setCapturedImage(null);
    setResult(null);
    setSaved(false);
    setError(null);
    setCameraDenied(false);
    setCameraStarting(false);
  }, [stopCamera]);

  const retakePhoto = useCallback(() => {
    goToWelcome();
  }, [goToWelcome]);

  // ── Save ────────────────────────────────────────────────────────

  const saveRecord = useCallback(async () => {
    if (!capturedImage || !result) return;

    setSaving(true);
    try {
      const compressedPhoto = await compressImage(capturedImage);
      const today = new Date().toISOString().split("T")[0];
      await addSnailLog({
        photoUrl: compressedPhoto,
        date: today,
        gender: result.sex,
        pregnantStatus: result.pregnancyStatus,
        confidence: result.confidence,
        shellLength: null,
        shellWidth: null,
        operculum: null,
        tentacles: null,
        morphologicalNotes: result.morphologicalNotes,
      });
      setSaved(true);
    } catch (err) {
      setError("Failed to save record. Please try again.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }, [capturedImage, result]);

  const doAnother = useCallback(() => {
    goToWelcome();
  }, [goToWelcome]);

  // ── Derived state ───────────────────────────────────────────────

  const showWelcome = !cameraActive && !cameraStarting && !capturedImage && !classifying && !cameraDenied;
  const showLiveCamera = cameraActive && !capturedImage && !classifying;
  const showCapturedImage = !!capturedImage;
  const showCameraFallback = cameraDenied && !cameraStarting && !capturedImage;

  return (
    <div className="flex flex-col h-full bg-black">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="relative z-20 px-6 pt-6 pb-2">
        <div className="flex items-center gap-2">
          <ScanLine size={22} className="text-white" />
          <h1 className="text-xl font-bold text-white">Scan Snail</h1>
        </div>
      </div>

      {/* ── Camera / Preview Area ──────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden">
        {/* ── Welcome screen (default state) ──────────────────── */}
        {showWelcome && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 via-gray-900 to-[#0d1f1e] px-8">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="text-center"
            >
              <div className="w-24 h-24 rounded-full bg-[#03615f]/20 flex items-center justify-center mx-auto mb-6 ring-4 ring-[#03615f]/10">
                <ScanLine size={44} className="text-[#c0fffc]" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Scan a Snail
              </h2>
              <p className="text-gray-400 text-sm mb-8 leading-relaxed max-w-xs mx-auto">
                Position the snail shell in the center and tap the shutter to
                classify its sex and pregnancy status.
              </p>

              <div className="flex flex-col gap-3 w-full max-w-xs mx-auto">
                <button
                  onClick={startCamera}
                  className="w-full py-4 rounded-2xl bg-[#03615f] text-white font-semibold text-base flex items-center justify-center gap-2.5 hover:opacity-90 active:scale-[0.98] transition-all shadow-lg shadow-[#03615f]/30"
                >
                  <Camera size={20} />
                  Start Camera
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-4 rounded-2xl border border-gray-700 text-gray-300 font-medium text-base flex items-center justify-center gap-2.5 hover:bg-gray-800 active:scale-[0.98] transition-all"
                >
                  <ImagePlus size={20} />
                  Upload from Gallery
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* ─️ Camera starting indicator ──────────────────────── */}
        {cameraStarting && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-[#03615f]/10 flex items-center justify-center mx-auto mb-4">
                <Camera size={32} className="text-[#c0fffc] animate-pulse" />
              </div>
              <p className="text-white/70 text-sm font-medium">Starting camera...</p>
            </div>
          </div>
        )}

        {/* ── Live camera feed ────────────────────────────────── */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className={cn(
            "absolute inset-0 w-full h-full object-cover transition-opacity duration-300",
            showLiveCamera ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
        />

        {/* ── Viewfinder overlay (on live camera) ─────────────── */}
        {showLiveCamera && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="relative w-[75%] aspect-[4/3] rounded-2xl"
                style={{
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.35)",
                }}
              >
                <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white/80 rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white/80 rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white/80 rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white/80 rounded-br-lg" />
              </div>
            </div>
          </div>
        )}

        {/* ── Camera denied fallback ──────────────────────────── */}
        {showCameraFallback && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 px-8 z-10">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center w-full max-w-xs"
            >
              <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-4">
                <CameraOff size={36} className="text-gray-500" />
              </div>
              <h3 className="text-white font-semibold text-lg mb-2">Camera Unavailable</h3>
              <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                Camera access was denied or unavailable. You can still upload a
                photo from your gallery.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={startCamera}
                  className="w-full py-3.5 rounded-2xl bg-white text-gray-900 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-gray-100 active:scale-[0.98] transition-all"
                >
                  <Camera size={18} />
                  Try Again
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-3.5 rounded-2xl border border-gray-600 text-gray-300 font-medium text-sm flex items-center justify-center gap-2 hover:bg-gray-800 active:scale-[0.98] transition-all"
                >
                  <ImagePlus size={18} />
                  Upload from Gallery
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* ── Captured image preview ──────────────────────────── */}
        {showCapturedImage && (
          <img
            src={capturedImage!}
            alt="Captured snail"
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {/* ── Scanning animation overlay ──────────────────────── */}
        {classifying && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-30">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-gray-900/90 backdrop-blur-sm rounded-2xl p-6 flex flex-col items-center gap-3 border border-white/10"
            >
              <div className="relative">
                <Loader2 size={36} className="text-[#c0fffc] animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <ScanLine size={16} className="text-[#03615f]" />
                </div>
              </div>
              <p className="text-sm font-medium text-white">
                Analyzing snail morphology...
              </p>
              <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-[#c0fffc] rounded-full"
                  animate={{ x: ["-100%", "200%"] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>
            </motion.div>
          </div>
        )}

        {/* ── Result overlay (slides up from bottom) ──────────── */}
        <AnimatePresence>
          {result && !classifying && showCapturedImage && (
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 400, damping: 35 }}
              className="absolute bottom-0 left-0 right-0 z-30"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />
              <div className="relative px-4 pb-4 pt-16">
                <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-4 shadow-2xl">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {result.sex === "Male" ? (
                        <div className="w-8 h-8 rounded-xl bg-[#beead1] flex items-center justify-center">
                          <Mars size={18} className="text-[#3f6653]" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-xl bg-[#ffdad6] flex items-center justify-center">
                          <Venus size={18} className="text-[#ba1a1a]" />
                        </div>
                      )}
                      <div>
                        <span className="font-bold text-gray-900 text-sm">
                          {result.sex}
                        </span>
                        <span
                          className={cn(
                            "ml-2 text-[10px] font-medium px-2 py-0.5 rounded-full",
                            result.pregnancyStatus === "Pregnant"
                              ? "bg-[#c1ecd4] text-[#274e3d]"
                              : "bg-gray-100 text-gray-500"
                          )}
                        >
                          {result.pregnancyStatus === "Pregnant" && (
                            <Baby size={10} className="inline mr-0.5" />
                          )}
                          {result.pregnancyStatus}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Confidence</p>
                      <span className="text-sm font-bold text-[#03615f]">
                        {result.confidence.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {result.morphologicalNotes}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Error toast ─────────────────────────────────────── */}
        <AnimatePresence>
          {error && !cameraDenied && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-4 left-4 right-4 z-40"
            >
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2 shadow-lg">
                <XCircle size={18} className="text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Bottom Controls ─────────────────────────────────────── */}
      {(showLiveCamera || result || saved) && (
        <div className="relative z-20 px-6 py-4 pb-24">
          {/* ── Live camera controls ───────────────────────────── */}
          {showLiveCamera && (
            <div className="flex items-center justify-center gap-6">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 active:scale-90 transition-all border border-white/30"
                title="Upload from gallery"
              >
                <ImagePlus size={20} className="text-white" />
              </button>
              <button
                onClick={capturePhoto}
                className="w-20 h-20 rounded-full bg-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl ring-4 ring-white/30"
              >
                <div className="w-16 h-16 rounded-full border-2 border-gray-900" />
              </button>
              <button
                onClick={toggleTorch}
                className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 active:scale-90 transition-all border border-white/30"
                title={torchOn ? "Turn off flash" : "Turn on flash"}
              >
                <span className={cn("text-lg", torchOn ? "text-yellow-300" : "text-white")}>
                  {torchOn ? "⚡" : "☀️"}
                </span>
              </button>
            </div>
          )}

          {/* ── Post-classification: Save / Retake ─────────────── */}
          {result && !classifying && !saved && showCapturedImage && (
            <div className="flex gap-3">
              <button
                onClick={saveRecord}
                disabled={saving}
                className="flex-1 py-3.5 rounded-2xl bg-white text-gray-900 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-gray-100 active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg"
              >
                {saving ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    Save to Log
                  </>
                )}
              </button>
              <button
                onClick={retakePhoto}
                className="py-3.5 px-5 rounded-2xl bg-white/20 backdrop-blur-sm text-white font-medium text-sm flex items-center gap-2 hover:bg-white/30 active:scale-[0.98] transition-all border border-white/30"
              >
                <RotateCcw size={18} />
                Retake
              </button>
            </div>
          )}

          {/* ── Saved confirmation ─────────────────────────────── */}
          {saved && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex gap-3"
            >
              <button
                onClick={() => onNavigate("history")}
                className="flex-1 py-3.5 rounded-2xl bg-white text-gray-900 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-gray-100 active:scale-[0.98] transition-all shadow-lg"
              >
                <CheckCircle2 size={18} />
                View in History
              </button>
              <button
                onClick={doAnother}
                className="flex-1 py-3.5 rounded-2xl bg-[#c0fffc] text-[#03615f] font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all shadow-lg"
              >
                <RefreshCw size={18} />
                Scan Another
              </button>
            </motion.div>
          )}
        </div>
      )}

      {/* Hidden file input & canvas */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
