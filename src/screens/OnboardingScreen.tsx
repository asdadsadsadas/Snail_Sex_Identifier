import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Camera,
  ScanLine,
  BrainCircuit,
  ChevronRight,
  CheckCircle2,
  Shield,
  Shell,
  Sparkles,
} from "lucide-react";
import { cn } from "../lib/utils";

interface OnboardingScreenProps {
  onComplete: () => void;
}

const slides = [
  {
    title: "Welcome to Snail Sexing AI",
    subtitle: "AI-powered snail classification for researchers and hobbyists",
    icon: Shell,
    gradient: "from-[#03615f] to-[#2d7a78]",
  },
  {
    title: "How It Works",
    subtitle: "Three simple steps to classify your snails",
    icon: ScanLine,
    gradient: "from-[#2d7a78] to-[#3f6653]",
    steps: [
      { icon: Camera, label: "Capture", desc: "Take a photo of the snail shell" },
      { icon: BrainCircuit, label: "Analyze", desc: "AI model predicts sex & pregnancy" },
      { icon: CheckCircle2, label: "Results", desc: "Review & save to your log" },
    ],
  },
  {
    title: "Camera Access Needed",
    subtitle: "Allow camera access to photograph snail shells for AI analysis",
    icon: Camera,
    gradient: "from-[#3f6653] to-[#03615f]",
    requestPermission: true,
  },
];

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(0);
  const [cameraGranted, setCameraGranted] = useState<boolean | null>(null);
  const [requestingCamera, setRequestingCamera] = useState(false);

  const goNext = useCallback(() => {
    if (currentSlide < slides.length - 1) {
      setDirection(1);
      setCurrentSlide((s) => s + 1);
    } else {
      onComplete();
    }
  }, [currentSlide, onComplete]);

  const goSkip = useCallback(() => {
    onComplete();
  }, [onComplete]);

  const requestCameraPermission = useCallback(async () => {
    setRequestingCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      stream.getTracks().forEach((t) => t.stop());
      setCameraGranted(true);
    } catch {
      setCameraGranted(false);
    } finally {
      setRequestingCamera(false);
    }
  }, []);

  const slide = slides[currentSlide];
  const isLastSlide = currentSlide === slides.length - 1;
  const SlideIcon = slide.icon;

  // ── Slide Variants ─────────────────────────────────────────────
  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 300 : -300, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -300 : 300, opacity: 0 }),
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#f8f9fa] overflow-hidden">
      {/* Top skip button */}
      <div className="absolute top-0 right-0 z-50 px-6 pt-6">
        {!isLastSlide && (
          <button
            onClick={goSkip}
            className="text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors px-3 py-1.5 rounded-full hover:bg-gray-100"
          >
            Skip
          </button>
        )}
      </div>

      {/* Slide content area */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentSlide}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute inset-0 flex flex-col"
          >
            {/* Background gradient & icon area */}
            <div
              className={cn(
                "flex-[0.5] min-h-[280px] bg-gradient-to-br flex items-center justify-center relative overflow-hidden",
                slide.gradient
              )}
            >
              {/* Decorative circles */}
              <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/5" />
              <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-white/5" />
              <div className="absolute top-1/3 left-1/4 w-32 h-32 rounded-full bg-white/5" />

              {/* Animated icon */}
              <motion.div
                initial={{ scale: 0.6, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 200,
                  damping: 15,
                  delay: 0.1,
                }}
              >
                <div className="w-28 h-28 rounded-3xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-xl">
                  <SlideIcon size={56} className="text-white" />
                </div>
              </motion.div>

              {/* Sparkle decorations */}
              <Sparkles
                size={24}
                className="absolute top-12 right-12 text-white/30 animate-pulse"
              />
              <Sparkles
                size={16}
                className="absolute bottom-12 left-12 text-white/20 animate-pulse"
                style={{ animationDelay: "1s" }}
              />
            </div>

            {/* Text content */}
            <div className="flex-[0.5] px-8 pt-10 pb-6 flex flex-col">
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                <h2 className="text-3xl font-bold text-gray-900 mb-3 leading-tight">
                  {slide.title}
                </h2>
                <p className="text-gray-500 text-base leading-relaxed">
                  {slide.subtitle}
                </p>
              </motion.div>

              {/* Steps (only on slide 2) */}
              {slide.steps && (
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                  className="mt-8 space-y-4"
                >
                  {slide.steps.map((step, i) => (
                    <motion.div
                      key={step.label}
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 0.4 + i * 0.15, duration: 0.4 }}
                      className="flex items-start gap-4"
                    >
                      <div className="w-10 h-10 rounded-xl bg-[#c0fffc] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <step.icon size={20} className="text-[#03615f]" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{step.label}</p>
                        <p className="text-gray-500 text-sm mt-0.5">{step.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}

              {/* Camera permission section (only on slide 3) */}
              {slide.requestPermission && (
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                  className="mt-8 space-y-4"
                >
                  <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <Shield size={20} className="text-[#03615f]" />
                      <span className="font-semibold text-gray-900 text-sm">Camera Permission</span>
                    </div>
                    <p className="text-sm text-gray-500 leading-relaxed mb-4">
                      Snail Sexing AI needs camera access to photograph snail shells for AI-powered
                      classification. Your photos are processed securely and stored in the cloud.
                    </p>

                    {cameraGranted === null ? (
                      <button
                        onClick={requestCameraPermission}
                        disabled={requestingCamera}
                        className="w-full py-3 px-4 rounded-xl bg-[#2d7a78] text-white font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
                      >
                        {requestingCamera ? (
                          <>
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Requesting...
                          </>
                        ) : (
                          <>
                            <Camera size={18} />
                            Grant Camera Access
                          </>
                        )}
                      </button>
                    ) : cameraGranted ? (
                      <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-xl px-4 py-3">
                        <CheckCircle2 size={18} className="text-green-600" />
                        <span className="text-sm font-medium">Camera access granted!</span>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-amber-700 bg-amber-50 rounded-xl px-4 py-3">
                          <Camera size={18} />
                          <span className="text-sm font-medium">Camera access denied</span>
                        </div>
                        <p className="text-xs text-gray-400 leading-relaxed">
                          You can still use the gallery to upload photos. To enable camera later,
                          go to your browser settings.
                        </p>
                        <button
                          onClick={requestCameraPermission}
                          className="w-full py-2.5 px-4 rounded-xl border border-[#03615f] text-[#03615f] font-medium text-sm hover:bg-gray-50 active:scale-[0.98] transition-all"
                        >
                          Try Again
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                    <p className="text-xs text-blue-700 leading-relaxed">
                      <span className="font-semibold">🔒 Privacy first:</span> All photos are
                      processed locally for AI inference and stored securely. We never share your
                      data with third parties.
                    </p>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom controls */}
      <div className="px-8 pb-10 pt-4 flex flex-col gap-5">
        {/* Dot indicators */}
        <div className="flex justify-center items-center gap-2.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                setDirection(i > currentSlide ? 1 : -1);
                setCurrentSlide(i);
              }}
              className={cn(
                "rounded-full transition-all duration-300",
                i === currentSlide
                  ? "w-8 h-2.5 bg-[#03615f]"
                  : "w-2.5 h-2.5 bg-gray-300 hover:bg-gray-400"
              )}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>

        {/* Next / Get Started button */}
        <button
          onClick={goNext}
          className="w-full py-4 rounded-2xl bg-[#03615f] text-white font-semibold text-base flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all shadow-lg shadow-[#03615f]/20"
        >
          {isLastSlide ? (
            <>
              <Sparkles size={20} />
              Get Started
            </>
          ) : (
            <>
              Next
              <ChevronRight size={20} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
