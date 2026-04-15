"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Target, Network, Layers, Activity } from "lucide-react";

const tabs = [
  { label: "Board", icon: LayoutDashboard, href: "/" },
  { label: "Cibles", icon: Target, href: "/targets" },
  { label: "Graphe", icon: Network, href: "/graph" },
  { label: "Pipeline", icon: Layers, href: "/pipeline" },
  { label: "Signaux", icon: Activity, href: "/signals" },
];

export default function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[100] lg:hidden bg-black/80 backdrop-blur-xl border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = pathname === tab.href || (tab.href !== "/" && pathname.startsWith(tab.href));

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${
                isActive ? "text-indigo-400" : "text-gray-600 active:text-gray-400"
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[9px] font-black uppercase tracking-widest">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
