import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  BarChart3,
  PieChart,
  Venus,
  Mars,
  Baby,
  TrendingUp,
  Shell,
} from "lucide-react";
import { getAllSnailLogs, type SnailLog } from "../lib/firebase";
import { cn } from "../lib/utils";
import {
  PieChart as RePieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const PIE_COLORS = ["#2d7a78", "#d48888"];
const BAR_COLORS = ["#c1ecd4", "#8ad3d0", "#beead1"];

export function StatsScreen() {
  const [logs, setLogs] = useState<SnailLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getAllSnailLogs();
        setLogs(data);
      } catch (err) {
        console.error("Failed to load stats data", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const maleCount = logs.filter((l) => l.gender === "Male").length;
  const femaleCount = logs.filter((l) => l.gender === "Female").length;
  const pregnantCount = logs.filter((l) => l.pregnantStatus === "Pregnant").length;

  const genderData = [
    { name: "Male", value: maleCount },
    { name: "Female", value: femaleCount },
  ];

  // Monthly pregnancy trends
  const monthMap = new Map<string, { pregnant: number; total: number }>();
  logs.forEach((log) => {
    const month = log.date.slice(0, 7); // "YYYY-MM"
    const entry = monthMap.get(month) || { pregnant: 0, total: 0 };
    entry.total++;
    if (log.pregnantStatus === "Pregnant") entry.pregnant++;
    monthMap.set(month, entry);
  });

  const pregnancyTrends = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, data]) => ({
      month: new Date(month + "-01").toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      }),
      Pregnant: data.pregnant,
      "Not Pregnant": data.total - data.pregnant,
    }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-[#03615f] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa] overflow-y-auto pb-32">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 size={24} className="text-[#03615f]" />
          <h1 className="text-2xl font-bold text-gray-900">Statistics</h1>
        </div>
        <p className="text-gray-500 text-sm">
          {logs.length} total record{logs.length !== 1 ? "s" : ""}
        </p>
      </div>

      {logs.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <TrendingUp size={48} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">
              No data yet. Start scanning snails!
            </p>
          </div>
        </div>
      ) : (
        <div className="px-6 space-y-6">
          {/* Gender ratio pie chart */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-white rounded-2xl p-5 border border-gray-100"
          >
            <div className="flex items-center gap-2 mb-4">
              <PieChart size={20} className="text-[#03615f]" />
              <h2 className="text-base font-bold text-gray-900">
                Sex Ratio
              </h2>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <RePieChart>
                <Pie
                  data={genderData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {genderData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  iconSize={10}
                  formatter={(value: string) => (
                    <span className="text-sm text-gray-600">{value}</span>
                  )}
                />
              </RePieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-6 mt-2">
              <div className="flex items-center gap-2">
                <Mars size={16} className="text-[#2d7a78]" />
                <span className="text-sm text-gray-600">
                  Male: <strong>{maleCount}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Venus size={16} className="text-[#d48888]" />
                <span className="text-sm text-gray-600">
                  Female: <strong>{femaleCount}</strong>
                </span>
              </div>
            </div>
          </motion.div>

          {/* Pregnancy trends bar chart */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl p-5 border border-gray-100"
          >
            <div className="flex items-center gap-2 mb-4">
              <Baby size={20} className="text-[#03615f]" />
              <h2 className="text-base font-bold text-gray-900">
                Pregnancy Trends
              </h2>
            </div>
            {pregnancyTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={pregnancyTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "none",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    iconSize={10}
                    formatter={(value: string) => (
                      <span className="text-sm text-gray-600">{value}</span>
                    )}
                  />
                  <Bar
                    dataKey="Pregnant"
                    stackId="a"
                    fill="#527766"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="Not Pregnant"
                    stackId="a"
                    fill="#c1ecd4"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">
                Insufficient data for trends
              </p>
            )}
          </motion.div>

          {/* Summary cards */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-2 gap-3 pb-4"
          >
            <div className="bg-[#beead1] rounded-2xl p-4">
              <Mars size={24} className="text-[#3f6653] mb-2" />
              <p className="text-2xl font-bold text-gray-900">{maleCount}</p>
              <p className="text-sm font-medium text-[#3f6653]">Male</p>
            </div>
            <div className="bg-[#ffdad6] rounded-2xl p-4">
              <Venus size={24} className="text-[#ba1a1a] mb-2" />
              <p className="text-2xl font-bold text-gray-900">{femaleCount}</p>
              <p className="text-sm font-medium text-[#ba1a1a]">Female</p>
            </div>
            <div className="bg-[#c1ecd4] rounded-2xl p-4">
              <Baby size={24} className="text-[#274e3d] mb-2" />
              <p className="text-2xl font-bold text-gray-900">{pregnantCount}</p>
              <p className="text-sm font-medium text-[#274e3d]">Pregnant</p>
            </div>
            <div className="bg-[#c0fffc] rounded-2xl p-4">
              <Shell size={24} className="text-[#03615f] mb-2" />
              <p className="text-2xl font-bold text-gray-900">{logs.length}</p>
              <p className="text-sm font-medium text-[#03615f]">Total</p>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
