"use client";

import React from "react";
import { CheckCircle2, Flame, ShieldAlert, Navigation, ArrowRight, X, HeartPulse } from "lucide-react";
import { HazardIncident, UserRole } from "@/lib/api";

export type ResponderLifecycleState = "UNACCEPTED" | "NAVIGATING" | "AT_SCENE" | "RESOLVED";

interface TacticalLifecycleBannerProps {
  activeIncident: HazardIncident;
  userRole: UserRole;
  lifecycleState: ResponderLifecycleState;
  triageText?: string;
  isDualDispatch?: boolean;
  onAcceptAndNavigate: (isDual?: boolean) => void;
  onArrivedAtScene: () => void;
  onCaseResolved: () => void;
  onDismiss: () => void;
}

export default function TacticalLifecycleBanner({
  activeIncident,
  userRole,
  lifecycleState,
  triageText,
  isDualDispatch = false,
  onAcceptAndNavigate,
  onArrivedAtScene,
  onCaseResolved,
  onDismiss,
}: TacticalLifecycleBannerProps) {
  const isFire = userRole === "FIRE_ENGINE";
  const isResolved = lifecycleState === "RESOLVED" || activeIncident.status === "RESOLVED";
  const isAtScene = lifecycleState === "AT_SCENE" || activeIncident.status === "CONTAINED";
  const isNavigating = lifecycleState === "NAVIGATING" || activeIncident.status === "RESPONDING";
  const isUnaccepted = lifecycleState === "UNACCEPTED" && !isNavigating && !isAtScene && !isResolved;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 w-[94%] max-w-lg pointer-events-auto">
      <div className="bg-[#0D1117]/95 backdrop-blur-xl border border-white/15 rounded-2xl p-3.5 sm:p-4 shadow-2xl font-mono space-y-2.5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isResolved
                  ? "bg-[#2E856E]"
                  : isAtScene
                  ? "bg-amber-500 animate-pulse"
                  : isNavigating
                  ? "bg-[#2E856E] animate-pulse"
                  : "bg-red-500 animate-ping"
              }`}
            />
            <div>
              <span className="font-bold text-xs sm:text-sm text-white block truncate max-w-[280px]">
                {activeIncident.title}
              </span>
              <span className="text-[10px] text-gray-400 block">
                STATUS: {activeIncident.status} • RADIUS: {activeIncident.radius_meters}m
                {isNavigating && (
                  <span className="text-[#2E856E] font-semibold ml-1.5">
                    • {isDualDispatch ? "DUAL FLEET IN MOTION (🚒+🚑)" : "NAVIGATING (ROUTE LOCKED)"}
                  </span>
                )}
                {isAtScene && (
                  <span className="text-amber-400 font-semibold ml-1.5">
                    • {isFire ? "AT SCENE (CONTAINED 50%)" : "AT SCENE (REROUTE H2)"}
                  </span>
                )}
                {isResolved && (
                  <span className="text-[#2E856E] font-semibold ml-1.5">• ALL-CLEAR (SAFE)</span>
                )}
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

        {/* 3-Stage Responder Action Workflow */}
        <div className="pt-1">
          {/* STAGE 1: UNACCEPTED -> Dual Dispatch & Single Unit */}
          {isUnaccepted && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={() => onAcceptAndNavigate(true)}
                className="w-full min-h-[44px] px-3 py-2.5 rounded-xl border border-red-500 bg-red-600 hover:bg-red-500 active:scale-[0.98] text-white text-[11px] font-bold tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-red-600/30 transition-all"
              >
                <span>🚒 + 🚑 SEND BOTH TO SCENE</span>
              </button>
              <button
                onClick={() => onAcceptAndNavigate(false)}
                className="w-full min-h-[44px] px-3 py-2.5 rounded-xl border border-[#2E856E] bg-[#2E856E] hover:bg-[#256f5c] active:scale-[0.98] text-white text-[11px] font-bold tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-[#2E856E]/30 transition-all"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>DISPATCH {userRole.replace("_", " ")}</span>
              </button>
            </div>
          )}

          {/* STAGE 2: NAVIGATING -> [ ARRIVED AT SCENE ] */}
          {isNavigating && (
            <button
              onClick={onArrivedAtScene}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-blue-400 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white text-xs font-bold tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all"
            >
              <Navigation className="w-4 h-4" />
              <span>[ ARRIVED AT SCENE ]</span>
            </button>
          )}

          {/* STAGE 3: AT_SCENE -> [ SOLVE & CLEAR HAZARD FROM MAP ] */}
          {isAtScene && (
            <button
              onClick={onCaseResolved}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-emerald-500 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white text-xs font-bold tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>[ SOLVE &amp; CLEAR HAZARD FROM MAP ]</span>
            </button>
          )}

          {/* STAGE 4: RESOLVED -> [ CASE RESOLVED (SAFE) ] */}
          {isResolved && (
            <div className="flex items-center gap-2">
              <div className="flex-1 min-h-[44px] px-3 py-2 rounded-xl border border-[#2E856E]/30 bg-[#2E856E]/20 text-[#2E856E] text-xs font-bold flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>CASE RESOLVED • CORRIDOR SAFE (#2E856E)</span>
              </div>
              <button
                onClick={onDismiss}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-gray-300 text-xs font-semibold transition-colors"
              >
                DISMISS
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
