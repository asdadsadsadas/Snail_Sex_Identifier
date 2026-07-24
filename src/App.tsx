import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { OnboardingScreen } from "./screens/OnboardingScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { ScanScreen } from "./screens/ScanScreen";
import { HistoryScreen } from "./screens/HistoryScreen";
import { StatsScreen } from "./screens/StatsScreen";
import { DetailScreen } from "./screens/DetailScreen";
import { BottomNav, type ScreenName } from "./components/BottomNav";

const ONBOARDING_KEY = "snail_sexing_onboarding_done";

type AppScreen =
  | { name: "home" }
  | { name: "scan" }
  | { name: "history" }
  | { name: "stats" }
  | { name: "detail"; params: { id: string } };

export default function App() {
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [currentScreen, setCurrentScreen] = useState<AppScreen>({
    name: "home",
  });

  useEffect(() => {
    const done = localStorage.getItem(ONBOARDING_KEY) === "true";
    setOnboardingDone(done);
  }, []);

  const handleOnboardingComplete = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setOnboardingDone(true);
  };

  const handleNavigate = (screen: ScreenName, params?: { id: string }) => {
    if (screen === "detail" && params) {
      setCurrentScreen({ name: "detail", params });
    } else if (screen === "home") {
      setCurrentScreen({ name: "home" });
    } else if (screen === "scan") {
      setCurrentScreen({ name: "scan" });
    } else if (screen === "history") {
      setCurrentScreen({ name: "history" });
    } else if (screen === "stats") {
      setCurrentScreen({ name: "stats" });
    }
  };

  // Still loading onboarding state
  if (onboardingDone === null) {
    return null;
  }

  // Show onboarding
  if (!onboardingDone) {
    return (
      <div className="h-full w-full">
        <OnboardingScreen onComplete={handleOnboardingComplete} />
      </div>
    );
  }

  const showBottomNav =
    currentScreen.name !== "detail";

  return (
    <div className="h-full w-full max-w-md mx-auto md:border md:border-gray-200 md:rounded-3xl md:h-[90vh] md:mt-4 overflow-hidden bg-[#f8f9fa] relative">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentScreen.name === "detail" ? `detail-${currentScreen.params.id}` : currentScreen.name}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="h-full"
        >
          {currentScreen.name === "home" && (
            <HomeScreen onNavigate={handleNavigate} />
          )}
          {currentScreen.name === "scan" && (
            <ScanScreen onNavigate={handleNavigate} />
          )}
          {currentScreen.name === "history" && (
            <HistoryScreen onNavigate={handleNavigate} />
          )}
          {currentScreen.name === "stats" && <StatsScreen />}
          {currentScreen.name === "detail" && (
            <DetailScreen
              params={currentScreen.params}
              onNavigate={handleNavigate}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {showBottomNav && (
        <BottomNav
          active={
            currentScreen.name === "home"
              ? "home"
              : currentScreen.name === "scan"
              ? "scan"
              : currentScreen.name === "history"
              ? "history"
              : "stats"
          }
          onNavigate={handleNavigate}
        />
      )}
    </div>
  );
}
