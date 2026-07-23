import { Home, Camera, History, BarChart2 } from "lucide-react";
import { cn } from "../lib/utils";
import { ScreenName } from "../types";

interface BottomNavProps {
  currentScreen: ScreenName;
  onNavigate: (screen: ScreenName) => void;
}

export function BottomNav({ currentScreen, onNavigate }: BottomNavProps) {
  const isNavVisible = ["Home", "Scan", "History", "Stats"].includes(currentScreen);

  if (!isNavVisible) return null;

  const navItems = [
    { name: "Home" as ScreenName, icon: Home, label: "Home" },
    { name: "Scan" as ScreenName, icon: Camera, label: "Scan" },
    { name: "History" as ScreenName, icon: History, label: "History" },
    { name: "Stats" as ScreenName, icon: BarChart2, label: "Stats" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center px-4 py-2 bg-white border-t border-gray-200 shadow-[0px_-4px_12px_rgba(0,0,0,0.05)] rounded-t-xl z-50 md:max-w-md md:left-1/2 md:-translate-x-1/2 pb-safe">
      {navItems.map((item) => {
        const isActive = currentScreen === item.name;
        return (
          <button
            key={item.name}
            onClick={() => onNavigate(item.name)}
            className="flex flex-col items-center justify-center p-2 rounded-lg transition-colors active:scale-90 duration-200 w-16"
          >
            <item.icon
              className={cn(
                "mb-1 w-6 h-6",
                isActive ? "text-[#03615f] fill-[#03615f]" : "text-gray-500"
              )}
              strokeWidth={isActive ? 2 : 1.5}
            />
            <span
              className={cn(
                "text-[10px]",
                isActive ? "text-[#03615f] font-semibold" : "text-gray-500 font-medium"
              )}
            >
              {item.label}
            </span>
            {isActive && (
              <div className="w-1 h-1 bg-[#03615f] rounded-full mt-1 absolute bottom-1" />
            )}
          </button>
        );
      })}
    </nav>
  );
}
