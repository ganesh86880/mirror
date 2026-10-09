"use client";

import React from "react";
import { Menu, ShieldAlert, Plus, Radio, Compass } from "lucide-react";
import { UserRole } from "@/lib/api";

interface TopFloatingHeaderProps {
  currentRole: UserRole;
  userName: string;
  activeHazardsCount: number;
  onToggleDrawer: () => void;
  onOpenReportModal: () => void;
}

export default function TopFloatingHeader({
  currentRole,
  userName,
  activeHazardsCount,
  onToggleDrawer,
  onOpenReportModal,
}: TopFloatingHeaderProps) {
  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case "AMBULANCE":
        return {
          bg: "bg-[#2E856E]/20 text-[#3FB950] border-[#2E856E]/40",
          dot: "bg-[#2E856E]",
          label: "AMBULANCE",
        };
      case "FIRE_ENGINE":
        return {
          bg: "bg-[#C53030]/20 text-[#F85149] border-[#C53030]/40",
          dot: "bg-[#C53030]",
          label: "FIRE ENGINE",
        };
      case "TRAFFIC_POLICE":
        return {
          bg: "bg-[#2563EB]/20 text-[#58A6FF] border-[#2563EB]/40",
          dot: "bg-[#2563EB]",
          label: "TRAFFIC POLICE",
        };
      case "PUBLIC":
      default:
        return {
          bg: "bg-[#0969DA]/20 text-[#79C0FF] border-[#0969DA]/40",
          dot: "bg-[#0969DA]",
          label: "PUBLIC / CITIZEN",
        };
    }
  };

  const badge = getRoleBadge(currentRole);

  return (
    <header className="fixed top-3 left-3 right-3 sm:top-4 sm:left-4 sm:right-4 z-30 pointer-events-none">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl bg-[#0D1117]/85 backdrop-blur-md border border-white/10 shadow-2xl pointer-events-auto">
        {/* Left: Hamburger menu + Title */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <button
            onClick={onToggleDrawer}
            aria-label="Open Mission Drawer"
            className="p-1.5 sm:p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 hover:text-white transition-all active:scale-95"
          >
            <Menu className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          <div className="flex items-center gap-2">
            <div className="relative flex items-center justify-center">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping absolute opacity-75" />
              <span className="w-2 h-2 rounded-full bg-emerald-500 relative" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-bold text-xs sm:text-sm tracking-wider text-white">
                  MIRROR
                </span>
                <span className="hidden sm:inline font-mono text-[10px] text-gray-400">
                  {"// DIGITAL TWIN"}
                </span>
              </div>
              <span className="hidden md:block text-[9px] font-mono text-gray-400">
                HYDERABAD TACTICAL MATRIX
              </span>
            </div>
          </div>
        </div>

        {/* Center/Right: Role badge, Hazards count, Fast Report button */}
        <div className="flex items-center gap-2 sm:gap-3 font-mono">
          {/* Active Role Badge */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] sm:text-xs font-semibold ${badge.bg}`}
          >
            <span className={`w-2 h-2 rounded-full ${badge.dot} animate-pulse`} />
            <span>{badge.label}</span>
          </div>

          {/* Active Hazard Zones Badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] text-gray-300">
            <ShieldAlert className="w-3 h-3 text-amber-400" />
            <span>
              {activeHazardsCount} {activeHazardsCount === 1 ? "HAZARD" : "HAZARDS"}
            </span>
          </div>

          {/* Quick Report Button */}
          <button
            onClick={onOpenReportModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg hover:shadow-blue-500/25 transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">REPORT</span>
          </button>
        </div>
      </div>
    </header>
  );
}
