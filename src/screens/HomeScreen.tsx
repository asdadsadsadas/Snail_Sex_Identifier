import { useEffect, useState, useCallback } from "react";
import { motion } from "motion/react";
import {
  Shell,
  Venus,
  Mars,
  Baby,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { getSnailCounts, getRecentSnailLogs, type SnailLog } from "../lib/firebase";
import { formatDate, formatConfidence } from "../lib/utils";
import { cn } from "../lib/utils";
import { PullToRefresh } from "../components/PullToRefresh";

interface HomeScreenProps {
  onNavigate: (screen: string, params?: any) => void;
}

export function HomeScreen({ onNavigate }: HomeScreenProps) {
  const [counts, setCounts] = useState({ total: 0, male: 0, female: 0, pregnant: 0 });
  const [recent, setRecent] = useState<SnailLog[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [c, r] = await Promise.all([
        getSnailCounts(),
        getRecentSnailLogs(3),
      ]);
      setCounts(c);
      setRecent(r);
    } catch (err) {
      console.error("Failed to load home data", err);
    }
  }, []);

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    await loadData();
  }, [loadData]);

  const statCards = [
    {
      label: "Total",
      value: counts.total,
      icon: Shell,
      color: "bg-[#c0fffc]",
      textColor: "text-[#03615f]",
    },
    {
      label: "Male",
      value: counts.male,
      icon: Mars,
      color: "bg-[#beead1]",
      textColor: "text-[#3f6653]",
    },
    {
      label: "Female",
      value: counts.female,
      icon: Venus,
      color: "bg-[#ffdad6]",
      textColor: "text-[#ba1a1a]",
    },
    {
      label: "Pregnant",
      value: counts.pregnant,
      icon: Baby,
      color: "bg-[#c1ecd4]",
      textColor: "text-[#274e3d]",
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-[#03615f] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={handleRefresh} className="h-full bg-[#f8f9fa]">
      <div className="pb-32">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Shell size={24} className="text-[#03615f]" />
              <h1 className="text-2xl font-bold text-gray-900">
                Snail Dashboard
              </h1>
            </div>
            <p className="text-gray-500 text-sm">
              Live classification overview
            </p>
          </motion.div>
        </div>

        {/* Stats grid */}
        <div className="px-6 grid grid-cols-2 gap-3 mb-6">
          {statCards.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: i * 0.1, duration: 0.4 }}
                className={cn(
                  "rounded-2xl p-4 flex items-center gap-3",
                  stat.color
                )}
              >
                <Icon size={32} className={stat.textColor} />
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  <p className={cn("text-sm font-medium", stat.textColor)}>
                    {stat.label}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Recent logs */}
        <div className="px-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900">Recent Logs</h2>
            <button
              onClick={() => onNavigate("history")}
              className="text-sm font-medium text-[#03615f] flex items-center gap-1 hover:opacity-80 transition-opacity"
            >
              View All
              <ArrowRight size={16} />
            </button>
          </div>

          <div className="space-y-3">
            {recent.length === 0 ? (
              <div className="text-center py-8">
                <Sparkles size={32} className="text-gray-300 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">No records yet. Start scanning!</p>
              </div>
            ) : (
              recent.map((log, i) => (
                <motion.div
                  key={log.id}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: i * 0.1, duration: 0.3 }}
                  onClick={() => onNavigate("detail", { id: log.id })}
                  className="bg-white rounded-2xl p-4 border border-gray-100 flex items-center gap-4 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-xl bg-[#c0fffc] flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {log.photoUrl ? (
                      <img
                        src={log.photoUrl}
                        alt="Snail"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Shell size={24} className="text-[#03615f]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-gray-900 text-sm">
                        {log.gender}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] font-medium px-2 py-0.5 rounded-full",
                          log.gender === "Male"
                            ? "bg-[#beead1] text-[#3f6653]"
                            : "bg-[#ffdad6] text-[#ba1a1a]"
                        )}
                      >
                        {log.pregnantStatus}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 truncate">
                      {formatDate(log.date)} · {formatConfidence(log.confidence)} confidence
                    </p>
                  </div>
                  <ArrowRight size={18} className="text-gray-300 flex-shrink-0" />
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>
    </PullToRefresh>
  );
}
