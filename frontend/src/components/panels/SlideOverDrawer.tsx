"use client";

import React from "react";
import {
  X,
  Users,
  Flame,
  Truck,
  Shield,
  User,
  Radio,
  MapPin,
  AlertTriangle,
  Activity,
  CheckCircle,
  Navigation,
  RefreshCw,
  Plus,
} from "lucide-react";
import { DynamicHospital, HazardIncident, UserProfile, UserRole } from "@/lib/api";
import { TrafficHotspot } from "../map/MapContainer";

interface SlideOverDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    lat: number;
    lng: number;
  };
  onSwitchRole: (role: UserRole) => void;
  isHotspotMode: boolean;
  onToggleHotspotMode: () => void;
  hotspots: TrafficHotspot[];
  onClearHotspots: () => void;
  activeUsers: UserProfile[];
  incidents: HazardIncident[];
  hospitals?: DynamicHospital[];
  isGridSimulationActive?: boolean;
  onToggleGridSimulation?: () => void;
  onSelectIncident: (inc: HazardIncident) => void;
  onResolveIncident: (incId: string) => void;
  selectedAction: string;
  onSelectAction: (act: string) => void;
  onOpenReportModal: () => void;
}

export default function SlideOverDrawer({
  isOpen,
  onClose,
  currentUser,
  onSwitchRole,
  isHotspotMode,
  onToggleHotspotMode,
  hotspots,
  onClearHotspots,
  activeUsers,
  incidents,
  hospitals = [],
  isGridSimulationActive = false,
  onToggleGridSimulation,
  onSelectIncident,
  onResolveIncident,
  selectedAction,
  onSelectAction,
  onOpenReportModal,
}: SlideOverDrawerProps) {
  const roles: { role: UserRole; label: string; icon: any; color: string; desc: string }[] = [
    {
      role: "AMBULANCE",
      label: "Ambulance (ALS)",
      icon: Activity,
      color: "#2E856E",
      desc: "Emergency Paramedic / Rapid Evacuation",
    },
    {
      role: "FIRE_ENGINE",
      label: "Fire Rescue",
      icon: Flame,
      color: "#C53030",
      desc: "Heavy Pumper FE-01 / Hazard Containment",
    },
    {
      role: "TRAFFIC_POLICE",
      label: "Traffic Police",
      icon: Shield,
      color: "#2563EB",
      desc: "Corridor Enforcement & Reroute Control",
    },
    {
      role: "PUBLIC",
      label: "Citizen Public",
      icon: User,
      color: "#0284C7",
      desc: "Civilian Eyewitness & SOS Reporter",
    },
  ];

  return (
    <>
      {/* Backdrop overlay for mobile */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
        />
      )}

      {/* Slide-over Drawer Panel */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 w-full sm:w-[360px] bg-[#0D1117]/95 backdrop-blur-xl border-r border-white/10 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out font-mono ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Drawer Header */}
        <div className="px-4 py-3.5 bg-[#161B22]/80 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span className="font-bold text-sm tracking-wide text-white">
              MIRROR MISSION CONTROL
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close drawer"
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs text-gray-300">
          {/* SECTION 1: USER PROFILE & ROLE SWITCHER */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-400" />
                DEMO ROLE SWITCHER
              </span>
              <span className="text-[9px] text-emerald-400 font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                LIVE MULTI-USER
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {roles.map((r) => {
                const Icon = r.icon;
                const isSelected = currentUser.role === r.role;
                return (
                  <button
                    key={r.role}
                    onClick={() => onSwitchRole(r.role)}
                    className={`p-2.5 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col gap-1 ${
                      isSelected
                        ? "bg-white/10 border-white/40 shadow-lg text-white"
                        : "bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Icon className="w-4 h-4" style={{ color: r.color }} />
                      {isSelected && (
                        <span
                          className="w-2 h-2 rounded-full animate-ping"
                          style={{ backgroundColor: r.color }}
                        />
                      )}
                    </div>
                    <span className="font-bold text-[11px] leading-tight text-white">
                      {r.label}
                    </span>
                    <span className="text-[9px] text-gray-400 leading-tight truncate">
                      {r.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* SECTION 1.5: MULTI-USER DEMO SIMULATION TOGGLE */}
          <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-white text-xs block">Simulate Active Emergency Grid</span>
                <span className="text-[9px] text-gray-400 block">Spawn 2 autonomous units (Amb-02 & Patrol)</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isGridSimulationActive}
                onClick={onToggleGridSimulation}
                className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out cursor-pointer ${
                  isGridSimulationActive ? "bg-emerald-500" : "bg-gray-700"
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                    isGridSimulationActive ? "translate-x-6" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
            {isGridSimulationActive && (
              <div className="text-[9px] text-emerald-400 flex items-center gap-1.5 pt-1 border-t border-white/5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>Autonomous responder telemetry active on Mapbox</span>
              </div>
            )}
          </div>

          {/* SECTION 2: HOTSPOT MANAGER */}
          <div className="space-y-2 p-3 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                HOTSPOT MANAGER
              </span>
              {hotspots.length > 0 && (
                <button
                  onClick={onClearHotspots}
                  className="text-[9px] text-gray-400 hover:text-red-400 underline"
                >
                  Clear All
                </button>
              )}
            </div>

            <button
              onClick={onToggleHotspotMode}
              className={`w-full py-2 px-3 rounded-lg border font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                isHotspotMode
                  ? "bg-amber-500/20 text-amber-300 border-amber-500 shadow-lg animate-pulse"
                  : "bg-white/5 hover:bg-white/10 text-gray-200 border-white/10"
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{isHotspotMode ? "CLICK MAP TO PIN HOTSPOT" : "MARK TRAFFIC HOTSPOT"}</span>
            </button>

            {hotspots.length > 0 ? (
              <div className="space-y-1.5 mt-2">
                {hotspots.map((h, idx) => (
                  <div
                    key={h.id}
                    className="p-1.5 rounded bg-black/40 border border-amber-500/30 flex items-center justify-between text-[10px]"
                  >
                    <span className="font-semibold text-amber-400">
                      #{idx + 1} {h.title}
                    </span>
                    <span className="text-[9px] text-gray-400">{h.timestamp}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-gray-400 italic text-center py-1">
                No active traffic hotspots marked.
              </p>
            )}
          </div>

          {/* SECTION 3: ACTIVE FLEET TELEMETRY */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-emerald-400" />
                ACTIVE FLEET TELEMETRY ({activeUsers.length})
              </span>
            </div>

            <div className="space-y-1.5">
              {activeUsers.map((u) => (
                <div
                  key={u.id}
                  className="p-2 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor:
                          u.role === "AMBULANCE"
                            ? "#2E856E"
                            : u.role === "FIRE_ENGINE"
                            ? "#C53030"
                            : "#2563EB",
                      }}
                    />
                    <div>
                      <div className="font-bold text-white text-[11px]">{u.name}</div>
                      <div className="text-[9px] text-gray-400">
                        {u.lat.toFixed(4)}°N, {u.lng.toFixed(4)}°E
                      </div>
                    </div>
                  </div>
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                    ONLINE
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 4: DYNAMIC HAZARD ZONES */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-red-400" />
                LOCALIZED HAZARD ZONES ({incidents.length})
              </span>
              <button
                onClick={onOpenReportModal}
                className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold"
              >
                <Plus className="w-3 h-3" />
                NEW
              </button>
            </div>

            {incidents.length === 0 ? (
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center space-y-2">
                <p className="text-[11px] text-gray-400">No active hazard zones logged.</p>
                <button
                  onClick={onOpenReportModal}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px]"
                >
                  Create Custom Hazard / Drop Pin
                </button>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {incidents.map((inc) => (
                  <div
                    key={inc.id}
                    onClick={() => onSelectIncident(inc)}
                    className="p-2 rounded-lg bg-white/5 border border-white/10 hover:border-white/30 cursor-pointer transition-all space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-[11px] truncate max-w-[190px]">
                        {inc.title}
                      </span>
                      <span
                        className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                          inc.severity === "CRITICAL"
                            ? "bg-red-500/20 text-red-300 border border-red-500/30"
                            : inc.severity === "HIGH"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                        }`}
                      >
                        {inc.severity}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[9px] text-gray-400">
                      <span>Radius: {inc.radius_meters}m</span>
                      {inc.status !== "RESOLVED" ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onResolveIncident(inc.id);
                          }}
                          className="text-emerald-400 hover:text-emerald-300 underline font-semibold"
                        >
                          Mark Resolved
                        </button>
                      ) : (
                        <span className="text-emerald-400">Resolved</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 5: TACTICAL ROUTE CORRIDOR SELECTION */}
          <div className="space-y-2 p-3 rounded-xl bg-white/5 border border-white/10">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Navigation className="w-3.5 h-3.5 text-blue-400" />
              EMERGENCY BYPASS CORRIDOR
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onSelectAction("OPTION_B")}
                className={`p-2 min-h-[44px] rounded-lg border text-left font-bold text-[10px] transition-all ${
                  selectedAction === "OPTION_B"
                    ? "bg-[#2E856E]/20 text-emerald-300 border-[#2E856E]"
                    : "bg-white/5 text-gray-400 border-white/10 hover:text-white"
                }`}
              >
                ROUTE 3 BYPASS (H2)
              </button>
              <button
                onClick={() => onSelectAction("OPTION_A")}
                className={`p-2 min-h-[44px] rounded-lg border text-left font-bold text-[10px] transition-all ${
                  selectedAction === "OPTION_A"
                    ? "bg-[#D97706]/20 text-amber-300 border-[#D97706]"
                    : "bg-white/5 text-gray-400 border-white/10 hover:text-white"
                }`}
              >
                ROUTE 1 DIRECT (H1)
              </button>
            </div>
          </div>

          {/* SECTION 6: DYNAMIC HOSPITAL CAPACITY & TRIAGE */}
          {hospitals && hospitals.length > 0 && (
            <div className="space-y-2 p-3 rounded-xl bg-white/5 border border-white/10">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                HOSPITAL CAPACITY TELEMETRY
              </span>
              <div className="space-y-1.5">
                {hospitals.map((h) => (
                  <div
                    key={h.id}
                    className="p-1.5 rounded-lg bg-black/40 border border-white/5 flex items-center justify-between text-[10px]"
                  >
                    <div>
                      <span className="font-semibold text-white block">{h.name.split(" ")[0]}</span>
                      <span className="text-[9px] text-gray-400">{h.available_beds} beds free</span>
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          h.occupancy_percent > 80
                            ? "bg-red-500/20 text-red-300 border border-red-500/30"
                            : h.occupancy_percent > 60
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        }`}
                      >
                        {h.occupancy_percent}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-3 bg-[#161B22]/80 border-t border-white/10 text-center text-[10px] text-gray-500">
          MIRROR v2.0 • Real-Time Geospatial Twin
        </div>
      </aside>
    </>
  );
}
