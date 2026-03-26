"use client";

interface TabItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
}

interface TabSwitcherProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (key: string) => void;
  className?: string;
}

export default function TabSwitcher({
  tabs,
  activeTab,
  onTabChange,
  className = "",
}: TabSwitcherProps) {
  return (
    <div
      className={`flex gap-1 bg-zinc-900/80 rounded-xl p-1 w-fit border border-zinc-800/50 ${className}`}
    >
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            activeTab === tab.key
              ? "bg-zinc-800 text-zinc-100 shadow-sm"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          {tab.icon && (
            <span className={activeTab === tab.key ? "text-indigo-400" : ""}>
              {tab.icon}
            </span>
          )}
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={`text-xs px-1.5 py-0.5 rounded-full transition-colors ${
                activeTab === tab.key
                  ? "bg-indigo-500/20 text-indigo-300"
                  : "bg-zinc-800 text-zinc-500"
              }`}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
