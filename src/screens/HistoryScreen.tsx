import { useState, useMemo } from "react";
import { ArrowLeft, User, Search, Filter, ChevronRight, Camera, X, SlidersHorizontal } from "lucide-react";
import { SnailRecord, ScreenName, SnailGender, PregnantStatus } from "../types";
import { cn } from "../lib/utils";

interface HistoryScreenProps {
  records: SnailRecord[];
  loading: boolean;
  onViewDetail: (id: string) => void;
}

export function HistoryScreen({ records, loading, onViewDetail }: HistoryScreenProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterGender, setFilterGender] = useState<SnailGender | "All">("All");
  const [filterStatus, setFilterStatus] = useState<PregnantStatus | "All">("All");

  // Filter records by search query, gender, and pregnancy status
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // Date search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!r.date.toLowerCase().includes(q)) return false;
      }
      // Gender filter
      if (filterGender !== "All" && r.gender !== filterGender) return false;
      // Status filter
      if (filterStatus !== "All" && r.pregnantStatus !== filterStatus) return false;
      return true;
    });
  }, [records, searchQuery, filterGender, filterStatus]);

  const clearFilters = () => {
    setFilterGender("All");
    setFilterStatus("All");
    setSearchQuery("");
  };

  const hasActiveFilters = filterGender !== "All" || filterStatus !== "All" || searchQuery.trim().length > 0;

  return (
    <div className="w-full h-full overflow-y-auto bg-[#f8f9fa] pb-24">
      <header className="sticky top-0 bg-[#f8f9fa] z-40 flex items-center justify-between px-4 h-16 w-full">
        <button className="text-gray-500 hover:opacity-80 active:scale-95 transition-all w-10 h-10 flex items-center justify-center">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-semibold text-[#03615f] tracking-tight">Snail History</h1>
        <button className="text-gray-500 hover:opacity-80 active:scale-95 transition-all w-10 h-10 flex items-center justify-center">
          <User size={24} />
        </button>
      </header>

      <main className="px-4 pt-4 flex flex-col gap-4">
        {/* Search & Filter Bar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by date..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 pl-10 pr-10 bg-white rounded-lg border border-gray-200 focus:border-[#2d7a78] focus:ring-1 focus:ring-[#2d7a78] text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-all shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "w-11 h-11 rounded-lg border flex items-center justify-center transition-colors flex-shrink-0 active:scale-95 shadow-sm",
              showFilters || filterGender !== "All" || filterStatus !== "All"
                ? "bg-[#2d7a78] text-white border-[#2d7a78]"
                : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
            )}
          >
            <SlidersHorizontal size={20} />
          </button>
        </div>

        {/* Filter Panel */}
        {(showFilters || hasActiveFilters) && (
          <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900">Filters</span>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs font-medium text-[#03615f] hover:underline"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Gender Filter */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Sex</p>
              <div className="flex gap-2">
                {(["All", "Male", "Female"] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setFilterGender(g)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                      filterGender === g
                        ? "bg-[#03615f] text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    )}
                  >
                    {g === "All" ? "All" : g}
                  </button>
                ))}
              </div>
            </div>

            {/* Pregnancy Status Filter */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Pregnancy</p>
              <div className="flex gap-2">
                {(["All", "Pregnant", "Not Pregnant"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                      filterStatus === s
                        ? "bg-[#03615f] text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    )}
                  >
                    {s === "All" ? "All" : s === "Pregnant" ? "Pregnant" : "Non-Pregnant"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Records List */}
        <div className="flex flex-col gap-3 pb-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="w-full bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex items-center gap-4 animate-pulse"
                >
                  <div className="w-12 h-12 rounded-full bg-gray-200 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                    <div className="h-3 bg-gray-200 rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm text-center">
              <Camera size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm font-medium">No records found</p>
              <p className="text-gray-400 text-xs mt-1">
                {hasActiveFilters
                  ? "Try adjusting your search or filters."
                  : "Start by scanning your first snail!"}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="mt-4 text-sm font-medium text-[#03615f] hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-400 font-medium px-1">
                {filteredRecords.length} record{filteredRecords.length !== 1 ? "s" : ""}
              </p>
              {filteredRecords.map((record) => (
                <button
                  key={record.id}
                  onClick={() => onViewDetail(record.id)}
                  className="w-full bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex items-center gap-4 text-left hover:bg-gray-50 transition-colors active:scale-[0.98]"
                >
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
                    {record.imageUrl ? (
                      <img src={record.imageUrl} alt="Snail shell" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="text-gray-400" size={20} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-500 mb-1 truncate">{record.date}</div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {record.gender === "Female" ? (
                        <span className="px-2 py-1 rounded bg-[#527766] text-white text-xs font-medium whitespace-nowrap">
                          Female
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded bg-gray-200 text-gray-700 text-xs font-medium whitespace-nowrap">
                          Male
                        </span>
                      )}

                      {record.pregnantStatus === "Pregnant" ? (
                        <span className="px-2 py-1 rounded bg-[#beead1] text-[#274e3d] text-xs font-medium whitespace-nowrap">
                          Pregnant
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded bg-gray-200 text-gray-700 text-xs font-medium whitespace-nowrap">
                          Non-Pregnant
                        </span>
                      )}

                      <span className="text-xs text-gray-400 ml-auto">
                        {record.confidence}%
                      </span>
                    </div>
                  </div>

                  <ChevronRight className="text-gray-400 flex-shrink-0" size={24} />
                </button>
              ))}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
