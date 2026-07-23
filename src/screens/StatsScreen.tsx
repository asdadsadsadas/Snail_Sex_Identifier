import { useMemo } from "react";
import { ArrowLeft, User, QrCode, BrainCircuit, Activity, MoreVertical } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { SnailRecord } from "../types";

interface StatsScreenProps {
  records: SnailRecord[];
  counts: { total: number; male: number; female: number; pregnant: number };
}

export function StatsScreen({ records, counts }: StatsScreenProps) {
  const { total, male, female, pregnant } = counts;

  // Calculate average confidence
  const avgConfidence = records.length > 0
    ? (records.reduce((acc, r) => acc + r.confidence, 0) / records.length).toFixed(1)
    : "0";

  // Pie chart data – real male vs female distribution
  const pieData = [
    { name: "Female", value: female, color: "#03615f" },
    { name: "Male", value: male, color: "#beead1" },
  ];

  // Bar chart – pregnancy rate over time, bucketed by month
  const barData = useMemo(() => {
    // Build month buckets from real records
    const monthMap = new Map<string, { pregnant: number; total: number }>();

    for (const r of records) {
      // Parse the date string (e.g., "Oct 24, 2023, 10:15 AM")
      const parsed = new Date(r.date);
      if (isNaN(parsed.getTime())) continue;

      const key = parsed.toLocaleString("en-US", { month: "short", year: "numeric" });
      const bucket = monthMap.get(key) ?? { pregnant: 0, total: 0 };
      bucket.total += 1;
      if (r.pregnantStatus === "Pregnant") bucket.pregnant += 1;
      monthMap.set(key, bucket);
    }

    // Convert to array and sort chronologically
    const sorted = Array.from(monthMap.entries())
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .slice(-6); // last 6 months

    // If we have no real data yet, show empty months
    if (sorted.length === 0) {
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
      return months.map((m) => ({ month: m, cases: 0 }));
    }

    return sorted.map(([month, bucket]) => ({
      month: month,
      cases: bucket.pregnant,
    }));
  }, [records]);

  const femalePercentage = total > 0 ? Math.round((female / total) * 100) : 0;
  const pregnancyRate = female > 0 ? Math.round((pregnant / female) * 100) : 0;

  return (
    <div className="w-full h-full overflow-y-auto bg-[#f8f9fa] pb-24">
      <header className="sticky top-0 bg-[#f8f9fa] z-40 flex items-center justify-between px-4 h-16 w-full shadow-sm transition-shadow">
        <div className="flex items-center gap-4">
          <button className="text-[#03615f] hover:opacity-80 active:scale-95 transition-all p-2 -ml-2 rounded-full">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-semibold text-[#03615f] tracking-tight">Insights & Statistics</h1>
        </div>
        <button className="text-[#03615f] hover:opacity-80 active:scale-95 transition-all p-2 -mr-2 rounded-full">
          <User size={24} />
        </button>
      </header>

      <main className="px-4 pt-6 pb-8 space-y-6">
        {/* Top Cards */}
        <section className="grid grid-cols-2 gap-3">
          <div className="bg-white/90 backdrop-blur-md rounded-2xl p-4 border border-gray-200 shadow-sm flex flex-col justify-between h-32">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">Total Scans</span>
              <QrCode size={20} className="text-[#3a5e4e]" />
            </div>
            <div>
              <span className="text-3xl font-bold text-gray-900 block">{total}</span>
              <span className="text-xs text-[#03615f] font-medium">
                {female}♀ {male}♂
              </span>
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-md rounded-2xl p-4 border border-gray-200 shadow-sm flex flex-col justify-between h-32">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">Avg Confidence</span>
              <BrainCircuit size={20} className="text-[#3a5e4e]" />
            </div>
            <div>
              <span className="text-3xl font-bold text-gray-900 block">{avgConfidence}%</span>
              <span className="text-xs text-gray-500">Model v2.1</span>
            </div>
          </div>

          <div className="bg-[#2d7a78] text-white rounded-2xl p-4 col-span-2 relative overflow-hidden h-32 flex flex-col justify-between">
            <div className="absolute -right-4 -top-4 opacity-10">
              <Activity size={120} />
            </div>
            <div className="relative z-10 h-full flex flex-col justify-between">
              <div>
                <span className="text-sm opacity-80">System Status</span>
                <h3 className="text-xl font-semibold mt-1">AI Inference Optimal</h3>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#c1ecd4] animate-pulse"></span>
                <span className="text-xs font-medium">Processing &lt; 200ms per image</span>
              </div>
            </div>
          </div>
        </section>

        {/* Charts */}
        <section className="space-y-4">
          {/* Pie Chart – Population Distribution */}
          <div className="bg-white/90 backdrop-blur-md rounded-2xl p-4 md:p-6 flex flex-col border border-gray-200 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Population Distribution</h3>
            <p className="text-sm text-gray-500 mb-4">Current active breeding pool ratio.</p>

            <div className="relative flex-grow flex items-center justify-center h-52 w-full">
              {total === 0 ? (
                <div className="text-center text-gray-400">
                  <p className="text-sm font-medium">No data yet</p>
                  <p className="text-xs mt-1">Start scanning to see distribution</p>
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius="60%"
                        outerRadius="90%"
                        paddingAngle={0}
                        dataKey="value"
                        stroke="none"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.value > 0 ? entry.color : "#e5e7eb"} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          borderRadius: "8px",
                          border: "none",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                        }}
                        itemStyle={{ color: "#111" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none flex-col">
                    <span className="text-2xl font-bold text-gray-900">{femalePercentage}%</span>
                    <span className="text-xs text-gray-500 font-medium">Female</span>
                  </div>
                </>
              )}
            </div>

            <div className="mt-4 flex justify-center gap-4">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#03615f]"></span>
                <span className="text-xs text-gray-500 font-medium">Female ({female})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#beead1]"></span>
                <span className="text-xs text-gray-500 font-medium">Male ({male})</span>
              </div>
            </div>
          </div>

          {/* Bar Chart – Pregnancy Trends */}
          <div className="bg-white/90 backdrop-blur-md rounded-2xl p-4 flex flex-col border border-gray-200 shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Pregnancy Trends</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Confirmed gestations over time.{" "}
                  {total > 0 && (
                    <span className="text-[#03615f] font-medium">
                      {pregnancyRate}% pregnancy rate
                    </span>
                  )}
                </p>
              </div>
              <button className="p-2 rounded-full hover:bg-gray-50 transition-colors">
                <MoreVertical size={20} className="text-gray-400" />
              </button>
            </div>

            <div className="w-full h-64">
              {records.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-sm text-gray-400">Scan snails to see pregnancy trends</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "#6b7280" }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "#6b7280" }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      cursor={{ fill: "#f3f4f6" }}
                      contentStyle={{
                        borderRadius: "8px",
                        border: "none",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                      }}
                    />
                    <Bar dataKey="cases" fill="#03615f" radius={[6, 6, 0, 0]} barSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
