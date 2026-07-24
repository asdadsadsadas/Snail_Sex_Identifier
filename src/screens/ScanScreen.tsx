import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Camera,
  Upload,
  ScanLine,
  Loader2,
  CheckCircle2,
  XCircle,
  Venus,
  Mars,
  Baby,
  Shell,
  Sparkles,
  RefreshCw,
  Save,
  RotateCcw,
} from "lucide-react";
import { classifySnailImage, dataUrlToBlob } from "../lib/api";
import { addSnailLog } from "../lib/firebase";
import { cn } from "../lib/utils";
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
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [classifying, setClassifying] = useState(false);
  const [result, setResult] = useState<ClassificationResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1080 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch {
      setError("Camera access denied. Use gallery upload instead.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setCapturedImage(dataUrl);
    stopCamera();

    // Auto-classify
    classifyImage(dataUrl);
  }, [stopCamera]);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        setCapturedImage(dataUrl);
        classifyImage(dataUrl);
      };
      reader.readAsDataURL(file);

      // Reset input so same file can be selected again
      e.target.value = "";
    },
    []
  );

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

  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
    setResult(null);
    setSaved(false);
    setError(null);
  }, []);

  const saveRecord = useCallback(async () => {
    if (!capturedImage || !result) return;

    setSaving(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      await addSnailLog({
        photoUrl: capturedImage,
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
    retakePhoto();
    startCamera();
  }, [retakePhoto, startCamera]);

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa] overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <ScanLine size={24} className="text-[#03615f]" />
          <h1 className="text-2xl font-bold text-gray-900">Scan Snail</h1>
        </div>
        <p className="text-gray-500 text-sm">
          Capture or upload a snail shell photo
        </p>
      </div>

      {/* Main content */}
      <div className="flex-1 px-6 pb-4 flex flex-col">
        <div className="flex-1 relative rounded-2xl overflow-hidden bg-gray-200 border border-gray-200 min-h-[300px]">
          {/* Camera view */}
          {cameraActive && !capturedImage && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          )}

          {/* Captured image preview */}
          {capturedImage && (
            <img
              src={capturedImage}
              alt="Captured snail"
              className="w-full h-full object-cover"
            />
          )}

          {/* Empty state */}
          {!cameraActive && !capturedImage && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Camera size={48} className="mb-3 text-gray-300" />
              <p className="text-sm font-medium">No photo yet</p>
              <p className="text-xs mt-1">Start camera or upload a photo</p>
            </div>
          )}

          {/* Camera overlay scanning effect */}
          {classifying && (
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
              <div className="bg-white/90 rounded-2xl p-6 flex flex-col items-center gap-3">
                <Loader2 size={36} className="text-[#03615f] animate-spin" />
                <p className="text-sm font-medium text-gray-700">
                  Analyzing snail morphology...
                </p>
                <div className="w-48 h-1 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-[#03615f] rounded-full animate-[scan_2s_linear_infinite]" />
                </div>
              </div>
            </div>
          )}

          {/* Result overlay */}
          <AnimatePresence>
            {result && !classifying && (
              <motion.div
                initial={{ y: 300, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 300, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pt-12 pb-4 px-4"
              >
                <div className="bg-white rounded-2xl p-4 shadow-xl">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {result.sex === "Male" ? (
                        <Mars size={20} className="text-[#3f6653]" />
                      ) : (
                        <Venus size={20} className="text-[#ba1a1a]" />
                      )}
                      <span className="font-bold text-gray-900">
                        {result.sex}
                      </span>
                      <span
                        className={cn(
                          "text-xs font-medium px-2 py-0.5 rounded-full",
                          result.pregnancyStatus === "Pregnant"
                            ? "bg-[#c1ecd4] text-[#274e3d]"
                            : "bg-gray-100 text-gray-500"
                        )}
                      >
                        {result.pregnancyStatus === "Pregnant" && (
                          <Baby size={12} className="inline mr-0.5" />
                        )}
                        {result.pregnancyStatus}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-[#03615f]">
                      {result.confidence.toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {result.morphologicalNotes}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute top-4 left-4 right-4 bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2"
              >
                <XCircle size={18} className="text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Controls */}
        <div className="mt-4 space-y-3">
          {!capturedImage && !classifying && (
            <>
              {cameraActive ? (
                <div className="flex gap-3">
                  <button
                    onClick={capturePhoto}
                    className="flex-1 py-3.5 rounded-2xl bg-[#03615f] text-white font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all shadow-lg shadow-[#03615f]/20"
                  >
                    <Camera size={20} />
                    Capture
                  </button>
                  <button
                    onClick={stopCamera}
                    className="py-3.5 px-5 rounded-2xl bg-gray-100 text-gray-600 font-medium text-sm hover:bg-gray-200 active:scale-[0.98] transition-all"
                  >
                    <XCircle size={20} />
                  </button>
                </div>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={startCamera}
                    className="flex-1 py-3.5 rounded-2xl bg-[#03615f] text-white font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all shadow-lg shadow-[#03615f]/20"
                  >
                    <Camera size={20} />
                    Open Camera
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 py-3.5 rounded-2xl border border-[#03615f] text-[#03615f] font-semibold text-sm flex items-center justify-center gap-2 hover:bg-gray-50 active:scale-[0.98] transition-all"
                  >
                    <Upload size={20} />
                    Upload
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>
              )}
            </>
          )}

          {/* Post-classification actions */}
          {result && !classifying && !saved && (
            <div className="flex gap-3">
              <button
                onClick={saveRecord}
                disabled={saving}
                className="flex-1 py-3.5 rounded-2xl bg-[#03615f] text-white font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-[#03615f]/20"
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
                className="py-3.5 px-5 rounded-2xl bg-gray-100 text-gray-600 font-medium text-sm flex items-center gap-2 hover:bg-gray-200 active:scale-[0.98] transition-all"
              >
                <RotateCcw size={18} />
                Retake
              </button>
            </div>
          )}

          {/* Saved confirmation */}
          {saved && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex gap-3"
            >
              <button
                onClick={() => onNavigate("history")}
                className="flex-1 py-3.5 rounded-2xl bg-[#527766] text-white font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all"
              >
                <CheckCircle2 size={18} />
                View in History
              </button>
              <button
                onClick={doAnother}
                className="flex-1 py-3.5 rounded-2xl bg-[#c0fffc] text-[#03615f] font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all"
              >
                <RefreshCw size={18} />
                Scan Another
              </button>
            </motion.div>
          )}
        </div>
      </div>

      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
