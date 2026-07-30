import { useRef, useCallback, useEffect, useState, type ReactNode } from "react";
import { motion, useMotionValue, useTransform, animate } from "motion/react";
import { ArrowDown, Loader2 } from "lucide-react";
import { cn } from "../lib/utils";

interface PullToRefreshProps {
  /** Async function to call when the user pulls past the threshold. */
  onRefresh: () => Promise<void>;
  children: ReactNode;
  className?: string;
}

type PullState = "idle" | "pulling" | "ready" | "refreshing";

const THRESHOLD = 80;
const MAX_PULL = 120;

/**
 * A touch‑gesture pull‑to‑refresh wrapper.
 *
 * - Wraps a scrollable area and intercepts overscroll at the top.
 * - Shows a pull indicator (arrow → spinner) as the user drags down.
 * - Fires `onRefresh` when the drag is released past the threshold.
 * - Uses `motion` for silky spring animations.
 */
export function PullToRefresh({ onRefresh, children, className }: PullToRefreshProps) {
  const pullY = useMotionValue(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const startY = useRef(0);
  const isPulling = useRef(false);
  const stateRef = useRef<PullState>("idle");

  // React state so the indicator label re-renders during the gesture
  const [indicatorLabel, setIndicatorLabel] = useState<PullState>("idle");

  // ── Gesture helpers ──────────────────────────────────────────

  const resetPull = useCallback(() => {
    animate(pullY, 0, { type: "spring", stiffness: 350, damping: 30 });
    stateRef.current = "idle";
    setIndicatorLabel("idle");
  }, [pullY]);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const el = containerRef.current;
    if (!el || stateRef.current === "refreshing") return;

    // Only activate if scrolled to the very top
    if (el.scrollTop > 0) return;

    startY.current = e.touches[0]!.clientY;
    isPulling.current = true;
  }, []);

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isPulling.current || stateRef.current === "refreshing") return;

      const currentY = e.touches[0]!.clientY;
      const delta = currentY - startY.current;

      if (delta <= 0) {
        // Finger moved up – stop pulling
        if (pullY.get() > 0) resetPull();
        isPulling.current = false;
        return;
      }

      // Prevent browser refresh / rubber‑band
      e.preventDefault();

      // Dampen & clamp the pull distance
      const clamped = Math.min(delta * 0.5, MAX_PULL);
      pullY.set(clamped);

      const nextState: PullState = clamped >= THRESHOLD ? "ready" : "pulling";
      if (nextState !== stateRef.current) {
        stateRef.current = nextState;
        setIndicatorLabel(nextState);
      }
    },
    [pullY, resetPull],
  );

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current) return;
    isPulling.current = false;

    const currentPull = pullY.get();

    if (currentPull >= THRESHOLD && stateRef.current !== "refreshing") {
      stateRef.current = "refreshing";
      setIndicatorLabel("refreshing");
      // Hold at threshold while refreshing
      animate(pullY, THRESHOLD, { type: "spring", stiffness: 350, damping: 30 });

      try {
        await onRefresh();
      } finally {
        stateRef.current = "idle";
        setIndicatorLabel("idle");
        animate(pullY, 0, { type: "spring", stiffness: 350, damping: 30 });
      }
    } else {
      resetPull();
    }
  }, [pullY, onRefresh, resetPull]);

  // ── Attach / detach listeners ───────────────────────────────

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd);

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  // ── Derived motion values ───────────────────────────────────

  const indicatorOpacity = useTransform(pullY, [0, THRESHOLD], [0, 1]);
  const arrowRotate = useTransform(pullY, [0, THRESHOLD], [0, 180]);

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/* ── Pull indicator ───────────────────────────────── */}
      <motion.div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: MAX_PULL,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: indicatorOpacity,
          pointerEvents: "none",
          zIndex: 10,
        }}
      >
        {indicatorLabel === "refreshing" ? (
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full border-2 border-[#03615f] border-t-transparent animate-spin" />
            <span className="text-sm font-medium text-[#03615f]">Refreshing…</span>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <motion.div style={{ rotate: arrowRotate }} className="flex-shrink-0">
              <ArrowDown size={20} className="text-[#03615f]" />
            </motion.div>
            <span className="text-sm font-medium text-[#03615f]">
              {indicatorLabel === "ready" ? "Release to refresh" : "Pull to refresh"}
            </span>
          </div>
        )}
      </motion.div>

      {/* ── Scrollable content ───────────────────────────── */}
      <motion.div
        ref={containerRef}
        style={{ y: pullY }}
        className="h-full overflow-y-auto"
      >
        {children}
      </motion.div>
    </div>
  );
}
