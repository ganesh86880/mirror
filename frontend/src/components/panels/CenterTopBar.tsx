"use client";

import React, { useEffect, useState } from "react";
import { Clock, ShieldAlert, Cpu, Crosshair, AlertTriangle, Radio, X } from "lucide-react";

interface CenterTopBarProps {
  globalRisk?: number;
  isDispatched?: boolean;
  onOpenCitizenModal?: () => void;
  alertBanner?: string | null;
  onDismissAlert?: () => void;
}

export default function CenterTopBar({
  globalRisk = 74,
  isDispatched = false,
  onOpenCitizenModal,
  alertBanner = null,
  onDismissAlert,
}: CenterTopBarProps) {
  const [utcTime, setUtcTime] = useState<string>("00:00:00 UTC");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTime(now.toUTCString().split(" ")[4] + " UTC");
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const isLowRisk = globalRisk <= 40;

  return (
    <div className="flex flex-col select-none font-mono shrink-0 z-20">
      {/* Top Header Bar */}
      <header className="h-10 bg-tactical-surface border-b border-tactical-border px-3 flex items-center justify-between text-[11px]">
        {/* Left: Mission & Sector Indicator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold text-tactical-text tracking-wide">
            <Crosshair className="w-3.5 h-3.5 text-tactical-green" />
            <span>MIRROR // MISSION CONTROL</span>
          </div>
          <span className="text-tactical-border">|</span>
          <span className="text-tactical-muted">
            SCENARIO: <span className="text-tactical-text font-semibold">S-27 (AMBULANCE CORRIDOR)</span>
          </span>
        </div>

        {/* Center: Live Tactical Telemetry */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <ShieldAlert className={`w-3.5 h-3.5 ${isLowRisk ? "text-tactical-green" : "text-tactical-amber"}`} />
            <span className="text-tactical-muted">THREAT LEVEL:</span>
            <span className={`font-bold ${isLowRisk ? "text-tactical-green" : "text-tactical-amber"}`}>
              {isLowRisk ? "NOMINAL" : "ELEVATED"} [{globalRisk}/100]
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-tactical-green" />
            <span className="text-tactical-muted">ACTIVE UNITS:</span>
            <span className="text-tactical-text font-bold">
              {isDispatched ? "3 / 5 (1 REROUTED)" : "3 / 5 DEPLOYED"}
            </span>
          </div>
        </div>

        {/* Right: Citizen Mode Trigger, UTC Clock & Status */}
        <div className="flex items-center gap-2.5">
          {/* Citizen SOS Feed Trigger Button */}
          {onOpenCitizenModal && (
            <button
              onClick={onOpenCitizenModal}
              className="px-2.5 py-1 rounded text-[10px] font-bold bg-[#C5303020] border border-tactical-crimson text-tactical-crimson hover:bg-tactical-crimson hover:text-white transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <Radio className="w-3 h-3 animate-pulse" />
              <span>CITIZEN SOS REPORTER</span>
            </button>
          )}

          <div className="flex items-center gap-1.5 text-tactical-text bg-tactical-bg px-2 py-0.5 rounded border border-tactical-border">
            <Clock className="w-3 h-3 text-tactical-muted" />
            <span className="font-bold">{utcTime}</span>
          </div>

          <div className="flex items-center gap-1.5 text-tactical-green text-[10px]">
            <span className="w-2 h-2 rounded-full bg-tactical-green animate-pulse" />
            <span>ONLINE</span>
          </div>
        </div>
      </header>

      {/* Critical Operational Alert Banner */}
      {alertBanner && (
        <div className="bg-[#C53030] text-white px-3 py-1 text-[11px] font-bold flex items-center justify-between shadow-md animate-pulse">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>ALERT: {alertBanner}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] bg-black/40 px-1.5 py-0.5 rounded border border-white/20 hidden sm:inline">
              OBSTACLE ACTIVE // ROUTE 3 AVAILABLE
            </span>
            {onDismissAlert && (
              <button
                onClick={onDismissAlert}
                title="Dismiss obstacle & evaluate alternatives"
                className="flex items-center gap-1 bg-white/20 hover:bg-white text-white hover:text-[#C53030] px-2 py-0.5 rounded text-[10px] transition-colors border border-white/30"
              >
                <span>CLEAR / DISMISS</span>
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
