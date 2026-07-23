/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from "react";
import { ScreenName, SnailRecord } from "./types";
import { HomeScreen } from "./screens/HomeScreen";
import { ScanScreen } from "./screens/ScanScreen";
import { HistoryScreen } from "./screens/HistoryScreen";
import { StatsScreen } from "./screens/StatsScreen";
import { DetailScreen } from "./screens/DetailScreen";
import { OnboardingScreen } from "./screens/OnboardingScreen";
import { BottomNav } from "./components/BottomNav";
import {
  getAllSnailLogs,
  getRecentSnailLogs,
  getSnailCounts,
} from "./lib/firebase";
import type { SnailLog } from "./lib/firebase";

const ONBOARDING_KEY = "snail_sexing_onboarding_done";

/** Temporary helper: convert a Firestore SnailLog into the UI SnailRecord shape. */
function logToRecord(log: SnailLog): SnailRecord {
  return {
    id: log.id,
    date: log.date,
    gender: log.gender,
    pregnantStatus: log.pregnantStatus,
    confidence: log.confidence,
    imageUrl: log.photoUrl ?? undefined,
    shellLength: log.shellLength ?? undefined,
    shellWidth: log.shellWidth ?? undefined,
    operculum: log.operculum ?? undefined,
    tentacles: log.tentacles ?? undefined,
    morphologicalNotes: log.morphologicalNotes,
  };
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenName>("Home");
  const [records, setRecords] = useState<SnailRecord[]>([]);
  const [recentRecords, setRecentRecords] = useState<SnailRecord[]>([]);
  const [counts, setCounts] = useState({ total: 0, male: 0, female: 0, pregnant: 0 });
  const [activeDetailId, setActiveDetailId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem(ONBOARDING_KEY);
  });

  /** Load/refresh data from Firestore. */
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [allLogs, recentLogs, countsData] = await Promise.all([
        getAllSnailLogs(),
        getRecentSnailLogs(3),
        getSnailCounts(),
      ]);
      setRecords(allLogs.map(logToRecord));
      setRecentRecords(recentLogs.map(logToRecord));
      setCounts(countsData);
    } catch (err) {
      console.warn("Firestore unavailable – using empty state.", err);
      setRecords([]);
      setRecentRecords([]);
      setCounts({ total: 0, male: 0, female: 0, pregnant: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount and whenever refreshKey changes.
  useEffect(() => {
    loadData();
  }, [loadData, refreshKey]);

  const handleNavigate = (screen: ScreenName) => {
    setCurrentScreen(screen);
    if (screen !== "Detail") {
      setActiveDetailId(null);
    }
  };

  const handleViewDetail = (id: string) => {
    setActiveDetailId(id);
    setCurrentScreen("Detail");
  };

  const handleBackFromDetail = () => {
    setCurrentScreen("History");
    setActiveDetailId(null);
  };

  /** Called after a scan is saved – refreshes all data. */
  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
  };

  /** Called after a detail edit or delete – navigates back and refreshes. */
  const handleDetailChange = () => {
    handleRefresh();
    setActiveDetailId(null);
    setCurrentScreen("History");
  };

  const handleOnboardingComplete = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setShowOnboarding(false);
  };

  // Find the active record for the Detail screen (could have changed in Firestore)
  const activeRecord = activeDetailId
    ? records.find((r) => r.id === activeDetailId) ?? null
    : null;

  // Show onboarding on first launch
  if (showOnboarding) {
    return (
      <div className="w-full h-screen bg-black flex justify-center items-center overflow-hidden">
        <div className="w-full h-full max-w-md bg-white shadow-2xl relative flex flex-col md:rounded-3xl md:h-[90vh] md:border md:border-gray-200 overflow-hidden">
          <OnboardingScreen onComplete={handleOnboardingComplete} />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-black flex justify-center items-center overflow-hidden">
      <div className="w-full h-full max-w-md bg-white shadow-2xl relative flex flex-col md:rounded-3xl md:h-[90vh] md:border md:border-gray-200 overflow-hidden">
        {currentScreen === "Home" && (
          <HomeScreen
            counts={counts}
            recentRecords={recentRecords}
            loading={loading}
            onNavigate={handleNavigate}
            onViewDetail={handleViewDetail}
          />
        )}

        {currentScreen === "Scan" && (
          <ScanScreen
            onNavigate={handleNavigate}
            onSaved={handleRefresh}
          />
        )}

        {currentScreen === "History" && (
          <HistoryScreen
            records={records}
            loading={loading}
            onViewDetail={handleViewDetail}
          />
        )}

        {currentScreen === "Stats" && (
          <StatsScreen
            records={records}
            counts={counts}
          />
        )}

        {currentScreen === "Detail" && activeRecord && (
          <DetailScreen
            record={activeRecord}
            onBack={handleBackFromDetail}
            onChanged={handleDetailChange}
          />
        )}

        <BottomNav
          currentScreen={currentScreen}
          onNavigate={handleNavigate}
        />
      </div>
    </div>
  );
}
