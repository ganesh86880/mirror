"use client";

import React from "react";
import { CheckCircle2, Flame, ShieldAlert, Navigation, ArrowRight, X, HeartPulse } from "lucide-react";
import { HazardIncident, UserRole } from "@/lib/api";

interface TacticalLifecycleBannerProps {
  activeIncident: HazardIncident;
  userRole: UserRole;
  triageText?: string;
  onArrivedAtScene: () => void;
  onCaseResolved: () => void;
  onDismiss: () => void;
}

export default function TacticalLifecycleBanner({
  activeIncident,
  userRole,
  triageText,
  onArrivedAtScene,
  onCaseResolved,
  onDismiss,
}: TacticalLifecycleBannerProps) {
  const isFire = userRole === "FIRE_ENGINE";
  const isContained = activeIncident.status === "CONTAINED";
  const isResolved = activeIncident.status === "RESOLVED";

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 w-[94%] max-w-lg pointer-events-auto">
      <div className="bg-[#0D1117]/90 backdrop-blur-xl border border-white/15 rounded-2xl p-3.5 sm:p-4 shadow-2xl font-mono space-y-2.5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isResolved
                  ? "bg-emerald-500"
                  : isContained
                  ? "bg-amber-500 animate-pulse"
                  : "bg-red-500 animate-ping"
              }`}
            />
            <div>
              <span className="font-bold text-xs sm:text-sm text-white block truncate max-w-[280px]">
                {activeIncident.title}
              </span>
              <span className="text-[10px] text-gray-400 block">
                STATUS: {activeIncident.status} • RADIUS: {activeIncident.radius_meters}m
              </span>
            </div>
          </div>

          <button
            onClick={onDismiss}
            aria-label="Dismiss banner"
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Triage / Reroute recommendation if present */}
        {triageText && (
          <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-300 flex items-center gap-1.5">
            <HeartPulse className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
            <span className="leading-tight">{triageText}</span>
          </div>
        )}

        {/* Interactive Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          {/* ARRIVED AT SCENE button */}
          <button
            onClick={onArrivedAtScene}
            disabled={isResolved || isContained}
            className={`min-h-[44px] px-3 py-2 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all shadow ${
              isResolved || isContained
                ? "bg-white/5 text-gray-500 border-white/5 cursor-not-allowed"
                : isFire
                ? "bg-amber-600 hover:bg-amber-500 text-white border-amber-400 shadow-amber-500/20 active:scale-95"
                : "bg-blue-600 hover:bg-blue-500 text-white border-blue-400 shadow-blue-500/20 active:scale-95"
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>
              {isContained
                ? "CONTAINED (50% SHRUNK)"
                : isFire
                ? "ARRIVED (CONTAIN)"
                : "ARRIVED (REROUTE H2)"}
            </span>
          </button>

          {/* CASE RESOLVED button */}
          <button
            onClick={onCaseResolved}
            disabled={isResolved}
            className={`min-h-[44px] px-3 py-2 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all shadow ${
              isResolved
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 cursor-not-allowed"
                : "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 shadow-emerald-500/20 active:scale-95"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{isResolved ? "CASE RESOLVED (SAFE)" : "CASE RESOLVED"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
