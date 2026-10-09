"use client";

import React, { useEffect, useState } from "react";
import {
  Sliders,
  AlertOctagon,
  Users,
  Clock,
  Building,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Loader2,
} from "lucide-react";
import { simulateAction, SimulationResult } from "@/lib/api";

interface RightPanelProps {
  selectedAction: string;
  onSelectAction: (actionId: string) => void;
  sliderSeverity: number;
  onApproveDispatch: (actionId: string) => void;
  isDispatched: boolean;
  globalRisk: number;
}

export default function RightPanel({
  selectedAction,
  onSelectAction,
  sliderSeverity,
  onApproveDispatch,
  isDispatched,
  globalRisk,
}: RightPanelProps) {
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Fetch simulation data whenever selected action or slider severity changes
  useEffect(() => {
    let isCancelled = false;
    setLoading(true);

    simulateAction(selectedAction, sliderSeverity)
      .then((res) => {
        if (!isCancelled) {
          setSimulationResult(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedAction, sliderSeverity]);

  // Dynamic calculations for Option A based on slider
  const optATransit = Math.round(22 + (sliderSeverity - 60) * 0.4);
  const optARisk = Math.min(100, Math.round(72 + (sliderSeverity - 60) * 0.533));
  const optARiskDelta = optARisk - 74;

  // Option definitions
  const isOptionB = selectedAction === "OPTION_B" || selectedAction === "ROUTE_3";
  const isOptionA = selectedAction === "OPTION_A" || selectedAction === "ROUTE_A";
  const isOptionC = selectedAction === "OPTION_C" || selectedAction === "DELAY_10";

  return (
    <aside className="h-full flex flex-col bg-tactical-panel border-l border-tactical-border select-none text-[12px] overflow-hidden">
      {/* Panel Header */}
      <div className="px-3 py-2 bg-tactical-surface border-b border-tactical-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders className="w-3.5 h-3.5 text-tactical-amber" />
          <span className="font-mono font-bold tracking-wider text-tactical-text uppercase text-[11px]">
            DECISION CENTER // WHAT-IF TWIN
          </span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[10px]">
          {loading ? (
            <span className="text-tactical-amber flex items-center gap-1">
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
              SIMULATING
            </span>
          ) : (
            <span className="text-tactical-green bg-tactical-bg px-1.5 py-0.5 rounded border border-tactical-border">
              ONLINE
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Baseline Metrics Grid */}
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-tactical-muted font-bold block mb-2">
            Baseline Situation Telemetry
          </span>

          <div className="grid grid-cols-2 gap-1.5 font-mono">
            {/* Metric 1: Global Risk */}
            <div className="p-2 bg-tactical-surface border border-tactical-border rounded">
              <div className="text-[10px] text-tactical-muted flex items-center gap-1 mb-0.5">
                <AlertOctagon className="w-3 h-3 text-tactical-crimson" />
                GLOBAL RISK
              </div>
              <div className="text-lg font-bold text-tactical-crimson">
                {globalRisk} <span className="text-[10px] text-tactical-muted font-normal">/ 100</span>
              </div>
              <div className="text-[9px] text-tactical-muted">
                {globalRisk <= 40 ? "STABILIZED // SAFE" : "HIGH SECTOR THREAT"}
              </div>
            </div>

            {/* Metric 2: People at Risk */}
            <div className="p-2 bg-tactical-surface border border-tactical-border rounded">
              <div className="text-[10px] text-tactical-muted flex items-center gap-1 mb-0.5">
                <Users className="w-3 h-3 text-tactical-amber" />
                PEOPLE AT RISK
              </div>
              <div className="text-lg font-bold text-tactical-text">2,481</div>
              <div className="text-[9px] text-tactical-muted">ACROSS 3 SECTORS</div>
            </div>

            {/* Metric 3: Fleet Delayed */}
            <div className="p-2 bg-tactical-surface border border-tactical-border rounded">
              <div className="text-[10px] text-tactical-muted flex items-center gap-1 mb-0.5">
                <Clock className="w-3 h-3 text-tactical-amber" />
                FLEET DELAYED
              </div>
              <div className="text-lg font-bold text-tactical-amber">
                {isDispatched ? "1 Unit" : "2 Units"}
              </div>
              <div className="text-[9px] text-tactical-muted">
                {isDispatched ? "Amb-01 DISPATCHED" : "HOLDING AT SEC 07"}
              </div>
            </div>

            {/* Metric 4: Overloaded Hospitals */}
            <div className="p-2 bg-tactical-surface border border-tactical-border rounded">
              <div className="text-[10px] text-tactical-muted flex items-center gap-1 mb-0.5">
                <Building className="w-3 h-3 text-tactical-crimson" />
                OVERLOAD HOSPITALS
              </div>
              <div className="text-lg font-bold text-tactical-crimson">1 Facility</div>
              <div className="text-[9px] text-tactical-muted">H1 AT 88% OCCUPANCY</div>
            </div>
          </div>
        </div>

        {/* Candidate Actions Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-tactical-muted font-bold">
              Candidate Response Actions
            </span>
            <span className="text-[9px] font-mono text-tactical-green">CONSEQUENCE SIMULATOR</span>
          </div>

          <div className="space-y-2">
            {/* OPTION A: Direct to H1 */}
            <button
              onClick={() => onSelectAction("OPTION_A")}
              className={`w-full text-left p-2.5 rounded border transition-all ${
                isOptionA
                  ? "bg-tactical-surface border-tactical-amber shadow-sm"
                  : "bg-tactical-bg border-tactical-border hover:border-[#484F58]"
              }`}
            >
              <div className="flex items-center justify-between font-mono mb-1">
                <span className="font-bold text-tactical-text text-[11px]">
                  Option A: Direct to H1 (Osmania)
                </span>
                <span className="text-[10px] text-tactical-muted font-mono">ROUTE-1</span>
              </div>

              <div className="grid grid-cols-3 gap-1 font-mono text-[10px] my-1.5 py-1 px-1.5 bg-tactical-bg rounded border border-tactical-border">
                <div>
                  <div className="text-tactical-muted text-[9px]">TRANSIT</div>
                  <div className="font-bold text-tactical-crimson">{optATransit} min</div>
                </div>
                <div>
                  <div className="text-tactical-muted text-[9px]">H1 LOAD</div>
                  <div className="font-bold text-tactical-crimson">+26% (OVERLOAD)</div>
                </div>
                <div>
                  <div className="text-tactical-muted text-[9px]">PROJECTED RISK</div>
                  <div className="font-bold text-tactical-crimson">
                    {optARisk} <span className="text-[9px]">({optARiskDelta >= 0 ? `+${optARiskDelta}` : optARiskDelta})</span>
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-tactical-muted line-clamp-2 leading-tight">
                Direct route crosses Sector 07/09 bottleneck. Delays spike with junction gridlock.
              </div>
            </button>

            {/* OPTION B: Bypass to H2 (Route 3) - HIGHLIGHTED LOWEST RISK */}
            <button
              onClick={() => onSelectAction("OPTION_B")}
              className={`w-full text-left p-2.5 rounded border transition-all ${
                isOptionB
                  ? "bg-tactical-surface border-tactical-green shadow-md ring-1 ring-tactical-green/40"
                  : "bg-tactical-bg border-tactical-border hover:border-[#484F58]"
              }`}
            >
              <div className="flex items-center justify-between font-mono mb-1">
                <span className="font-bold text-tactical-text text-[11px] flex items-center gap-1.5">
                  <span>Option B: Bypass to H2 (Gandhi)</span>
                </span>
                <span className="px-1.5 py-0.2 rounded font-mono text-[9px] font-bold bg-[#2E856E20] border border-[#2E856E60] text-tactical-green flex items-center gap-0.5">
                  <ShieldCheck className="w-2.5 h-2.5" />
                  RECOMMENDED // LOWEST RISK
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1 font-mono text-[10px] my-1.5 py-1 px-1.5 bg-tactical-bg rounded border border-tactical-border">
                <div>
                  <div className="text-tactical-muted text-[9px]">TRANSIT</div>
                  <div className="font-bold text-tactical-green">13 min (drops from 22m)</div>
                </div>
                <div>
                  <div className="text-tactical-muted text-[9px]">H2 INTAKE</div>
                  <div className="font-bold text-tactical-green">+11% (SAFE INTAKE)</div>
                </div>
                <div>
                  <div className="text-tactical-muted text-[9px]">PROJECTED RISK</div>
                  <div className="font-bold text-tactical-green">34 (-40)</div>
                </div>
              </div>

              <div className="text-[10px] text-tactical-muted line-clamp-2 leading-tight">
                Reroutes via Sector 11 corridor. Avoids Sector 09 gridlock and balances hospital load.
              </div>
            </button>

            {/* OPTION C: Hold & Clear */}
            <button
              onClick={() => onSelectAction("OPTION_C")}
              className={`w-full text-left p-2.5 rounded border transition-all ${
                isOptionC
                  ? "bg-tactical-surface border-[#484F58] shadow-sm"
                  : "bg-tactical-bg border-tactical-border hover:border-[#484F58]"
              }`}
            >
              <div className="flex items-center justify-between font-mono mb-1">
                <span className="font-bold text-tactical-text text-[11px]">
                  Option C: Hold & Clear
                </span>
                <span className="text-[10px] text-tactical-muted font-mono">DELAY-10</span>
              </div>

              <div className="grid grid-cols-3 gap-1 font-mono text-[10px] my-1.5 py-1 px-1.5 bg-tactical-bg rounded border border-tactical-border">
                <div>
                  <div className="text-tactical-muted text-[9px]">TRANSIT</div>
                  <div className="font-bold text-tactical-amber">27 min</div>
                </div>
                <div>
                  <div className="text-tactical-muted text-[9px]">EXPOSURE</div>
                  <div className="font-bold text-tactical-crimson">+31% (640 At Risk)</div>
                </div>
                <div>
                  <div className="text-tactical-muted text-[9px]">PROJECTED RISK</div>
                  <div className="font-bold text-tactical-crimson">86 (+12)</div>
                </div>
              </div>

              <div className="text-[10px] text-tactical-muted line-clamp-2 leading-tight">
                Hold dispatch for 10 minutes. High population exposure escalation.
              </div>
            </button>
          </div>
        </div>

        {/* CONSEQUENCE RATIONALE — powered by live backend simulation */}
        <div className="p-3 bg-tactical-surface border border-tactical-border rounded space-y-2 font-mono">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-tactical-muted uppercase font-bold flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-tactical-amber" />
              CONSEQUENCE RATIONALE
            </span>
            <div className="flex items-center gap-1.5">
              {simulationResult && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded border"
                  style={{
                    color: simulationResult.projected_risk > 70 ? "#C53030" : simulationResult.projected_risk < 45 ? "#2E856E" : "#D97706",
                    backgroundColor: simulationResult.projected_risk > 70 ? "#C5303015" : simulationResult.projected_risk < 45 ? "#2E856E15" : "#D9770615",
                    borderColor: simulationResult.projected_risk > 70 ? "#C5303040" : simulationResult.projected_risk < 45 ? "#2E856E40" : "#D9770640",
                  }}
                >
                  RISK: {simulationResult.projected_risk.toFixed(0)} ({simulationResult.risk_difference >= 0 ? "+" : ""}{simulationResult.risk_difference.toFixed(0)})
                </span>
              )}
              <span className="text-[10px] font-bold text-tactical-text">
                {isOptionB ? "ROUTE 3 // BYPASS" : isOptionA ? "ROUTE 1 // DIRECT" : "HOLD // DELAY"}
              </span>
            </div>
          </div>

          <div className="text-[11px] leading-relaxed text-tactical-text p-2 bg-tactical-bg rounded border border-tactical-border">
            {simulationResult?.explanation ? (
              <span className={isOptionB ? "text-[#F0F6FC]" : "text-tactical-muted"}>
                &ldquo;{simulationResult.explanation}&rdquo;
              </span>
            ) : isOptionB ? (
              <span className="text-[#F0F6FC]">
                &ldquo;Bypasses Sector 09 gridlock and routes to Hospital H2, preventing critical saturation at Hospital H1.&rdquo;
              </span>
            ) : isOptionA ? (
              <span className="text-tactical-muted">
                Traverses Sector 07/09 bottleneck. Severe transit gridlock at {sliderSeverity}% delays ambulance to {optATransit}m and overburdens Hospital H1.
              </span>
            ) : (
              <span className="text-tactical-muted">
                Holding vehicle in place causes acute exposure surge (+31%), leaving 640 additional individuals at risk.
              </span>
            )}
          </div>

          {/* Primary Action Button */}
          {isDispatched ? (
            <div
              className={`w-full py-2.5 px-3 rounded font-mono font-bold text-[11px] tracking-wider uppercase border flex items-center justify-center gap-2 ${
                isOptionA
                  ? "bg-[#D9770620] border-tactical-amber text-tactical-amber"
                  : isOptionC
                  ? "bg-[#8B949E20] border-[#8B949E] text-[#8B949E]"
                  : "bg-[#2E856E20] border-tactical-green text-tactical-green"
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isOptionA
                  ? "ROUTE 1 DISPATCHED // AMB-01 EN ROUTE H1"
                  : isOptionC
                  ? "STAGE 2 ACTIVE // AMB-01 HOLDING"
                  : "ROUTE 3 DISPATCHED // AMB-01 EN ROUTE H2"}
              </span>
            </div>
          ) : (
            <button
              onClick={() => onApproveDispatch(selectedAction)}
              className={`w-full py-2.5 px-3 rounded font-mono font-bold text-[11px] tracking-wider uppercase transition-all flex items-center justify-center gap-2 shadow-sm ${
                isOptionB
                  ? "bg-tactical-green text-white hover:bg-[#256d5a] ring-2 ring-tactical-green/50 active:scale-[0.99]"
                  : isOptionA
                  ? "bg-[#D97706] text-white hover:bg-[#B45309] ring-2 ring-[#D97706]/50 active:scale-[0.99]"
                  : "bg-[#4B5563] text-white hover:bg-[#374151] ring-2 ring-gray-400/50 active:scale-[0.99]"
              }`}
            >
              <span>
                {isOptionA
                  ? "[ APPROVE & DISPATCH ROUTE 1 (H1) ]"
                  : isOptionC
                  ? "[ APPROVE STAGED HOLD ]"
                  : "[ APPROVE & DISPATCH ROUTE 3 (H2) ]"}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
