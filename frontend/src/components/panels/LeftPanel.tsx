"use client";

import React from "react";
import { AlertCircle, Flame, Waves, AlertTriangle, Radio, Truck, Activity } from "lucide-react";

interface LeftPanelProps {
  isDispatched?: boolean;
  isFireDispatched?: boolean;
  onDispatchFire?: () => void;
}

export default function LeftPanel({
  isDispatched = false,
  isFireDispatched = false,
  onDispatchFire,
}: LeftPanelProps) {
  const incidents = [
    {
      id: "INC-04",
      sector: "SECTOR 04",
      title: "Structural Fire Hazard",
      severity: "CRITICAL",
      icon: Flame,
      color: "#C53030",
      desc: "Commercial zone blaze spreading toward primary arterial.",
    },
    {
      id: "INC-07",
      sector: "SECTOR 07",
      title: "Water Inundation Surge",
      severity: "HIGH",
      icon: Waves,
      color: "#1D4E89",
      desc: "Sub-corridor submerged. Depth 3.5m, impassable for light units.",
    },
    {
      id: "INC-09",
      sector: "SECTOR 09",
      title: "Junction Gridlock",
      severity: "HIGH",
      icon: AlertTriangle,
      color: "#D97706",
      desc: "Multi-vehicle stall bottlenecking central corridor access.",
    },
  ];

  const units = [
    {
      id: "Amb-01",
      type: "ALS AMBULANCE",
      status: isDispatched ? "REROUTED // H2" : "TRANSIT",
      statusColor: "#2E856E",
      speed: isDispatched ? "52 km/h" : "42 km/h",
      destination: isDispatched ? "H2 Gandhi (Bypass)" : "H1 Osmania",
    },
    {
      id: "Amb-02",
      type: "ALS AMBULANCE",
      status: "DELAYED",
      statusColor: "#D97706",
      speed: "0 km/h",
      destination: "Held at Sec 07",
    },
    {
      id: "FE-01",
      type: "HEAVY PUMPER",
      status: isFireDispatched ? "DISPATCHED // EN ROUTE" : "STANDBY",
      statusColor: isFireDispatched ? "#C53030" : "#8B949E",
      speed: isFireDispatched ? "58 km/h" : "0 km/h",
      destination: isFireDispatched ? "Sec 04 Fire Hazard" : "Sec 04 Perimeter",
    },
  ];

  const hospitals = [
    {
      id: "H1",
      name: "Osmania General",
      occupancy: isDispatched ? 84 : 88,
      beds: isDispatched ? "420 / 500" : "440 / 500",
      color: isDispatched ? "#D97706" : "#C53030",
      note: isDispatched ? "RELIEVED BY BYPASS" : "SURGE RISK",
    },
    {
      id: "H2",
      name: "Gandhi Hospital",
      occupancy: isDispatched ? 65 : 54,
      beds: isDispatched ? "260 / 400" : "216 / 400",
      color: isDispatched ? "#2E856E" : "#D97706",
      note: isDispatched ? "+11% SAFE INTAKE" : "NOMINAL",
    },
    {
      id: "H3",
      name: "NIMS Hospital",
      occupancy: 41,
      beds: "123 / 300",
      color: "#2E856E",
      note: "AVAILABLE",
    },
  ];

  return (
    <aside className="h-full flex flex-col bg-tactical-panel border-r border-tactical-border select-none text-[12px] overflow-hidden">
      {/* Panel Header */}
      <div className="px-3 py-2 bg-tactical-surface border-b border-tactical-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-tactical-green animate-pulse" />
          <span className="font-mono font-bold tracking-wider text-tactical-text uppercase text-[11px]">
            TELEMETRY // INCIDENTS & FLEET
          </span>
        </div>
        <span className="font-mono text-[10px] text-tactical-muted bg-tactical-bg px-1.5 py-0.5 rounded border border-tactical-border">
          SYNC LIVE
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Section 1: Active Incidents */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-tactical-muted font-bold flex items-center gap-1">
              <AlertCircle className="w-3 h-3 text-tactical-crimson" />
              Active Incidents (3)
            </span>
            <span className="text-[9px] font-mono text-tactical-crimson bg-[#C5303020] border border-[#C5303040] px-1 py-0.2 rounded font-bold">
              SYS THREAT CRITICAL
            </span>
          </div>

          <div className="space-y-1.5">
            {incidents.map((inc) => {
              const Icon = inc.icon;
              return (
                <div
                  key={inc.id}
                  className="p-2 bg-tactical-surface border border-tactical-border rounded hover:border-[#484F58] transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-tactical-text">
                      <Icon className="w-3 h-3" style={{ color: inc.color }} />
                      <span>{inc.sector}</span>
                    </div>
                    <span
                      className="px-1.5 py-0.2 rounded font-mono text-[9px] font-bold border"
                      style={{
                        backgroundColor: `${inc.color}15`,
                        borderColor: `${inc.color}40`,
                        color: inc.color,
                      }}
                    >
                      {inc.severity}
                    </span>
                  </div>
                  <div className="text-[11px] font-medium text-tactical-text mb-0.5">{inc.title}</div>
                  <div className="text-[10px] text-tactical-muted line-clamp-2 leading-tight">{inc.desc}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 2: Fleet Units Telemetry */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-tactical-muted font-bold flex items-center gap-1">
              <Truck className="w-3 h-3 text-tactical-green" />
              Emergency Units (3 Monitored)
            </span>
            <span className="text-[9px] font-mono text-tactical-muted">GPS 100% LOCK</span>
          </div>

          <div className="space-y-1.5">
            {units.map((u) => (
              <div
                key={u.id}
                className="p-2 bg-tactical-surface border border-tactical-border rounded flex flex-col gap-1"
              >
                <div className="flex items-center justify-between font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-tactical-text text-[11px]">{u.id}</span>
                    <span className="text-[9px] text-tactical-muted">[{u.type}]</span>
                  </div>
                  <span
                    className="px-1.5 py-0.2 rounded text-[9px] font-bold border"
                    style={{
                      backgroundColor: `${u.statusColor}15`,
                      borderColor: `${u.statusColor}40`,
                      color: u.statusColor,
                    }}
                  >
                    {u.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-tactical-muted font-mono">
                  <span>Dest: {u.destination}</span>
                  <span className="text-tactical-text">{u.speed}</span>
                </div>
                {u.id === "FE-01" && (
                  <button
                    onClick={onDispatchFire}
                    className={`mt-1 py-1 px-2 rounded text-[10px] font-mono font-bold transition-all flex items-center justify-center gap-1.5 border ${
                      isFireDispatched
                        ? "bg-[#C5303020] text-tactical-crimson border-tactical-crimson/50"
                        : "bg-tactical-bg text-tactical-amber border-tactical-amber/50 hover:bg-tactical-amber hover:text-black"
                    }`}
                  >
                    <span>{isFireDispatched ? "FE-01 EN ROUTE SEC 04" : "[ DISPATCH FE-01 TO FIRE ]"}</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: Hospital Bed Occupancy Mini-Meters */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-tactical-muted font-bold flex items-center gap-1">
              <Activity className="w-3 h-3 text-tactical-amber" />
              Hospital Intake Capacity
            </span>
            <span className="text-[9px] font-mono text-tactical-muted">
              {isDispatched ? "LOAD BALANCED" : "1 OVERLOAD"}
            </span>
          </div>

          <div className="space-y-2">
            {hospitals.map((h) => (
              <div key={h.id} className="p-2 bg-tactical-surface border border-tactical-border rounded">
                <div className="flex items-center justify-between font-mono mb-1 text-[11px]">
                  <span className="font-bold text-tactical-text">
                    {h.id}: {h.name}
                  </span>
                  <span className="font-bold" style={{ color: h.color }}>
                    {h.occupancy}%
                  </span>
                </div>

                {/* Tactical Progress Meter */}
                <div className="w-full h-1.5 bg-tactical-bg rounded-full overflow-hidden border border-tactical-border">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${h.occupancy}%`, backgroundColor: h.color }}
                  />
                </div>

                <div className="flex justify-between items-center text-[9px] font-mono text-tactical-muted mt-1">
                  <span>Capacity: {h.beds}</span>
                  <span style={{ color: h.color }}>{h.note}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
