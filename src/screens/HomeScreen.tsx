import { ArrowLeft, User, Database, Camera, ChevronRight, RefreshCw } from "lucide-react";
import { ScreenName, SnailRecord } from "../types";

interface HomeScreenProps {
  onNavigate: (screen: ScreenName) => void;
  onViewDetail: (id: string) => void;
  counts: { total: number; male: number; female: number; pregnant: number };
  recentRecords: SnailRecord[];
  loading: boolean;
}

export function HomeScreen({ onNavigate, onViewDetail, counts, recentRecords, loading }: HomeScreenProps) {
  const { total, male, female, pregnant } = counts;

  return (
    <div className="w-full h-full overflow-y-auto bg-gray-50 pb-24">
      <header className="sticky top-0 bg-gray-50 z-40 flex items-center justify-between px-4 h-16 w-full">
        <button className="text-[#03615f] hover:opacity-80 active:scale-95 transition-all p-2 rounded-full">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-semibold text-[#03615f] tracking-tight">Snail Sexing AI</h1>
        <button className="text-[#03615f] hover:opacity-80 active:scale-95 transition-all p-2 rounded-full">
          <User size={24} />
        </button>
      </header>

      <main className="px-4 pt-4 space-y-6">
        {/* Greeting */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900">Good morning, Researcher</h2>
          <p className="text-sm text-gray-500 mt-1">Here is your logging overview.</p>
        </section>

        {/* Total Snails Logged */}
        <section>
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">
                Total Snails Logged
              </p>
              {loading ? (
                <div className="h-10 w-16 bg-gray-200 animate-pulse rounded-lg mt-1" />
              ) : (
                <p className="text-4xl font-bold text-gray-900">{total}</p>
              )}
            </div>
            <div className="w-12 h-12 rounded-full bg-[#2d7a78] flex items-center justify-center text-white shadow-inner">
              <Database size={24} />
            </div>
          </div>
        </section>

        {/* Male vs Female & Pregnant Count */}
        <section className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm text-center flex flex-col justify-center">
            <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">Male vs Female</p>
            {loading ? (
              <div className="h-8 w-20 bg-gray-200 animate-pulse rounded mx-auto" />
            ) : (
              <div className="flex justify-center items-end space-x-1">
                <span className="text-2xl font-semibold text-[#03615f]">{male}</span>
                <span className="text-sm text-gray-300 mb-1">/</span>
                <span className="text-2xl font-semibold text-[#3f6653]">{female}</span>
              </div>
            )}
          </div>
          <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm text-center flex flex-col justify-center">
            <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">Pregnant Count</p>
            {loading ? (
              <div className="h-8 w-12 bg-gray-200 animate-pulse rounded mx-auto" />
            ) : (
              <span className="text-2xl font-semibold text-gray-900">{pregnant}</span>
            )}
          </div>
        </section>

        {/* Scan New Snail Button */}
        <section className="flex justify-center py-2">
          <button
            onClick={() => onNavigate("Scan")}
            className="bg-[#2d7a78] text-white text-lg font-semibold py-4 px-8 rounded-full shadow-lg hover:opacity-90 active:scale-95 transition-all duration-200 flex items-center space-x-3 w-full justify-center"
          >
            <Camera size={24} className="fill-white" />
            <span>Scan New Snail</span>
          </button>
        </section>

        {/* Recent Logs */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Logs</h3>
            <button
              onClick={() => onNavigate("History")}
              className="text-sm font-medium text-[#03615f] hover:opacity-80 transition-opacity flex items-center gap-1"
            >
              View All
              <ChevronRight size={16} />
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-3xl p-3 border border-gray-100 shadow-sm flex items-center space-x-4 animate-pulse">
                  <div className="w-16 h-16 rounded-2xl bg-gray-200 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentRecords.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm text-center">
              <Camera size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm">No snails logged yet.</p>
              <p className="text-gray-400 text-xs mt-1">Tap "Scan New Snail" to get started!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentRecords.map((record) => (
                <button
                  key={record.id}
                  onClick={() => onViewDetail(record.id)}
                  className="w-full bg-white rounded-3xl p-3 border border-gray-100 shadow-sm flex items-center space-x-4 text-left hover:bg-gray-50 active:scale-[0.98] transition-all"
                >
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                    {record.imageUrl ? (
                      <img src={record.imageUrl} alt="Snail scan" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="text-gray-400" />
                    )}
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="text-sm font-medium text-gray-900 mb-1 truncate">{record.date}</p>
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-[#c0fffc] text-[#00504e] text-xs font-medium">
                        {record.gender}
                      </span>
                      {record.pregnantStatus === "Pregnant" ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-[#2d7a78] text-white text-xs font-semibold">
                          Pregnant
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-gray-600 text-xs font-medium">
                          Not Pregnant
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="p-2 text-gray-400">
                    <ChevronRight size={20} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
