import { Home, Camera, History, BarChart3, Shell } from "lucide-react";
import { cn } from "../lib/utils";

export type NavTab = "home" | "scan" | "history" | "stats";
export type ScreenName = NavTab | "detail";

interface BottomNavProps {
  active: "home" | "scan" | "history" | "stats";
  onNavigate: (screen: ScreenName) => void;
}

const tabs = [
  { key: "home" as const, label: "Home", icon: Home },
  { key: "scan" as const, label: "Scan", icon: Camera },
  { key: "history" as const, label: "History", icon: History },
  { key: "stats" as const, label: "Stats", icon: BarChart3 },
];

export function BottomNav({ active, onNavigate }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 pb-6 pt-2">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onNavigate(tab.key)}
              className={cn(
                "flex flex-col items-center gap-1 py-1 px-4 rounded-xl transition-all duration-200",
                isActive
                  ? "text-[#03615f]"
                  : "text-gray-400 hover:text-gray-600"
              )}
            >
              <div
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200",
                  isActive && "bg-[#c0fffc]"
                )}
              >
                <Icon size={22} />
              </div>
              <span className="text-[10px] font-medium tracking-wider uppercase">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
