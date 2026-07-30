import { useEffect, useState, useMemo, useCallback } from "react";
import { motion } from "motion/react";
import {
  History,
  Search,
  Filter,
  ArrowRight,
  Shell,
  X,
  Calendar,
} from "lucide-react";
import { getAllSnailLogs, type SnailLog } from "../lib/firebase";
import { formatDate, formatConfidence, cn } from "../lib/utils";
import { PullToRefresh } from "../components/PullToRefresh";

interface HistoryScreenProps {
  onNavigate: (screen: string, params?: any) => void;
}

export function HistoryScreen({ onNavigate }: HistoryScreenProps) {
  const [logs, setLogs] = useState<SnailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterGender, setFilterGender] = useState<string>("");
  const [filterPregnancy, setFilterPregnancy] = useState<string>("");

  const loadData = useCallback(async () => {
    try {
      const data = await getAllSnailLogs();
      setLogs(data);
    } catch (err) {
      console.error("Failed to load history", err);
    }
  }, []);

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    await loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    return logs.filter((log) => {
      const matchSearch =
        !search ||
        log.date.toLowerCase().includes(search.toLowerCase()) ||
        log.morphologicalNotes.toLowerCase().includes(search.toLowerCase());
      const matchGender = !filterGender || log.gender === filterGender;
      const matchPregnancy =
        !filterPregnancy || log.pregnantStatus === filterPregnancy;
      return matchSearch && matchGender && matchPregnancy;
    });
  }, [logs, search, filterGender, filterPregnancy]);

  const clearFilters = () => {
    setSearch("");
    setFilterGender("");
    setFilterPregnancy("");
  };

  const hasFilters = search || filterGender || filterPregnancy;

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
          <div className="flex items-center gap-2 mb-1">
            <History size={24} className="text-[#03615f]" />
            <h1 className="text-2xl font-bold text-gray-900">History</h1>
          </div>
          <p className="text-gray-500 text-sm">
            {logs.length} record{logs.length !== 1 ? "s" : ""} in total
          </p>
        </div>

        {/* Search bar */}
        <div className="px-6 mb-3">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Search by date or notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white rounded-xl border border-gray-200 text-sm placeholder:text-gray-400 focus:outline-none focus:border-[#2d7a78] focus:ring-1 focus:ring-[#2d7a78] transition-all"
            />
          </div>
        </div>

        {/* Filter chips */}
        <div className="px-6 mb-4 flex items-center gap-2 flex-wrap">
          <Filter size={16} className="text-gray-400" />
          {["Male", "Female"].map((g) => (
            <button
              key={g}
              onClick={() => setFilterGender(filterGender === g ? "" : g)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                filterGender === g
                  ? "bg-[#03615f] text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              )}
            >
              {g}
            </button>
          ))}
          {["Pregnant", "Not Pregnant"].map((p) => (
            <button
              key={p}
              onClick={() =>
                setFilterPregnancy(filterPregnancy === p ? "" : p)
              }
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                filterPregnancy === p
                  ? "bg-[#527766] text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              )}
            >
              {p}
            </button>
          ))}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="px-3 py-1.5 rounded-full text-xs font-medium text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-all"
            >
              <X size={14} />
              Clear
            </button>
          )}
        </div>

        {/* List */}
        <div className="px-6 space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <Shell size={40} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm font-medium">
                {logs.length === 0
                  ? "No records yet. Start scanning!"
                  : "No records match your filters."}
              </p>
            </div>
          ) : (
            filtered.map((log, i) => (
              <motion.div
                key={log.id}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: i * 0.03, duration: 0.3 }}
                onClick={() => onNavigate("detail", { id: log.id })}
                className="bg-white rounded-2xl p-4 border border-gray-100 flex items-center gap-4 active:scale-[0.98] transition-all cursor-pointer"
              >
                <div className="w-14 h-14 rounded-xl bg-[#c0fffc] flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {log.photoUrl ? (
                    <img
                      src={log.photoUrl}
                      alt="Snail"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Shell size={28} className="text-[#03615f]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
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
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Calendar size={12} />
                    <span>{formatDate(log.date)}</span>
                    <span>·</span>
                    <span>{formatConfidence(log.confidence)}</span>
                  </div>
                </div>
                <ArrowRight size={18} className="text-gray-300 flex-shrink-0" />
              </motion.div>
            ))
          )}
        </div>
      </div>
    </PullToRefresh>
  );
}
