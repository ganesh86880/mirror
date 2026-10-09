"use client";

import React, { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { Plus } from "lucide-react";
import TopFloatingHeader from "@/components/panels/TopFloatingHeader";
import SlideOverDrawer from "@/components/panels/SlideOverDrawer";
import EmergencyIntakeModal from "@/components/modals/EmergencyIntakeModal";
import TacticalLifecycleBanner, { ResponderLifecycleState } from "@/components/panels/TacticalLifecycleBanner";
import { TrafficHotspot } from "@/components/map/MapContainer";
import {
  DynamicHospital,
  HazardIncident,
  PRESET_USERS,
  UserProfile,
  UserRole,
  getActiveUsers,
  getDynamicHospitals,
  getHospitalTriageRecommendation,
  getIncidents,
  loginUser,
  updateIncidentStatus,
  updateUserLocation,
} from "@/lib/api";

// Dynamically import full-screen zero-API-key tactical map container with SSR disabled
const MapContainer = dynamic(() => import("@/components/map/LeafletMapContainer"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 w-screen h-screen z-0 bg-[#0D1117] flex flex-col items-center justify-center font-mono text-xs text-gray-400 gap-3">
      <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      <span>INITIALIZING ZERO-API-KEY TACTICAL MAP...</span>
    </div>
  ),
});


export default function MissionControlDashboard() {
  // 1. Multi-User Authentication & Active Role State
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    email: string;
    role: UserRole;
    lat: number;
    lng: number;
    token?: string;
  }>({
    id: "usr-fe-01",
    name: "Fire Rescue Engine FE-01",
    email: "fire@mirror.emergency",
    role: "FIRE_ENGINE",
    lat: 17.388,
    lng: 78.455,
  });

  const [activeUsers, setActiveUsers] = useState<UserProfile[]>([]);
  const [incidents, setIncidents] = useState<HazardIncident[]>([]);
  const [hotspots, setHotspots] = useState<TrafficHotspot[]>([]);
  const [hospitals, setHospitals] = useState<DynamicHospital[]>([]);

  // 2. Interactive Phases 3 & 4 State
  const [activeIncidentTarget, setActiveIncidentTarget] = useState<HazardIncident | null>(null);
  const [isGridSimulationActive, setIsGridSimulationActive] = useState<boolean>(false);
  const [lifecycleState, setLifecycleState] = useState<ResponderLifecycleState>("UNACCEPTED");

  // 3. UI Interactive Overlays State
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [isPinDropMode, setIsPinDropMode] = useState<boolean>(false);
  const [isHotspotMode, setIsHotspotMode] = useState<boolean>(false);
  const [pinCoordinates, setPinCoordinates] = useState<[number, number] | null>(null);
  const [selectedAction, setSelectedAction] = useState<string>("OPTION_B");

  // 4. Initial Data Fetching: Active Responders, Incidents, Hospitals
  const refreshData = useCallback(async () => {
    try {
      const [users, incs, hosps] = await Promise.all([
        getActiveUsers(),
        getIncidents(),
        getDynamicHospitals(),
      ]);
      if (users && users.length > 0) setActiveUsers(users);
      if (incs && incs.length > 0) {
        setIncidents(incs);
        // Default target active critical incident if none selected
        if (!activeIncidentTarget) {
          const activeCrit = incs.find((i) => i.status === "ACTIVE" && i.severity === "CRITICAL") || incs[0];
          setActiveIncidentTarget(activeCrit);
          setLifecycleState(
            activeCrit.status === "RESOLVED"
              ? "RESOLVED"
              : activeCrit.status === "CONTAINED"
              ? "AT_SCENE"
              : activeCrit.status === "RESPONDING"
              ? "NAVIGATING"
              : "UNACCEPTED"
          );
        }
      }
      if (hosps) setHospitals(hosps);
    } catch (err) {
      console.warn("Failed to refresh live telemetry", err);
    }
  }, [activeIncidentTarget]);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 6000);
    return () => clearInterval(interval);
  }, [refreshData]);

  // 5. Role Switcher for Hackathon Multi-User Demo
  const handleSwitchRole = async (targetRole: UserRole) => {
    const preset = PRESET_USERS[targetRole];
    if (!preset) return;

    // Authenticate with backend or use preset
    const loginResult = await loginUser(preset.email);
    if (loginResult && loginResult.user) {
      setCurrentUser({
        id: loginResult.user.id,
        name: loginResult.user.name,
        email: loginResult.user.email,
        role: loginResult.user.role,
        lat: loginResult.user.lat,
        lng: loginResult.user.lng,
        token: loginResult.access_token,
      });
    } else {
      // Fallback
      setCurrentUser({
        id: `usr-${targetRole.toLowerCase()}`,
        name: preset.name,
        email: preset.email,
        role: targetRole,
        lat: preset.lat,
        lng: preset.lng,
      });
    }

    // Update coordinates in backend database
    updateUserLocation(preset.lat, preset.lng, undefined, currentUser.id).catch(() => {});
    refreshData();
  };

  // 6. Map Click Handler (Pin Drop / Hotspot Marking)
  const handleMapClick = (coords: [number, number]) => {
    const [lng, lat] = coords;

    if (isPinDropMode) {
      setPinCoordinates([lng, lat]);
      setIsPinDropMode(false);
      setIsReportModalOpen(true);
      return;
    }

    if (isHotspotMode) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const newHotspot: TrafficHotspot = {
        id: `HOT-${Date.now()}`,
        lat,
        lng,
        title: `Congestion Node (${lat.toFixed(3)}°, ${lng.toFixed(3)}°)`,
        timestamp: timeStr,
      };
      setHotspots((prev) => [newHotspot, ...prev]);
      setIsHotspotMode(false);
      return;
    }
  };

  // 7. Hazard Zone Created from Modal
  // 7. Hazard Zone Created from Modal
  const handleIncidentCreated = (newIncident: HazardIncident) => {
    setIncidents((prev) => [newIncident, ...prev.filter((i) => i.id !== newIncident.id)]);
    handleSelectIncident(newIncident);
    setIsReportModalOpen(false);
    setPinCoordinates(null);
  };

  // 8. Select Incident & Update Responder Dispatch State
  const handleSelectIncident = (inc: HazardIncident) => {
    setActiveIncidentTarget(inc);
    if (inc.status === "RESOLVED") {
      setLifecycleState("RESOLVED");
    } else if (inc.status === "CONTAINED") {
      setLifecycleState("AT_SCENE");
    } else if (inc.status === "RESPONDING") {
      setLifecycleState("NAVIGATING");
    } else {
      setLifecycleState("UNACCEPTED");
    }
  };

  // 9. Accept & Navigate Workflow Transition (Phase 3 & 4)
  const handleAcceptAndNavigate = async () => {
    if (!activeIncidentTarget) return;
    setLifecycleState("NAVIGATING");
    // Lock bypass corridor (Route 3 / Option B in #2E856E)
    setSelectedAction("OPTION_B");
    // Update incident status to RESPONDING
    await updateIncidentStatus(activeIncidentTarget.id, "RESPONDING");
    const respondingIncident = {
      ...activeIncidentTarget,
      status: "RESPONDING" as const,
    };
    setActiveIncidentTarget(respondingIncident);
    setIncidents((prev) =>
      prev.map((i) => (i.id === activeIncidentTarget.id ? respondingIncident : i))
    );
  };

  // 10. Arrival Lifecycle: Arrived at Scene Transition
  const handleArrivedAtScene = async () => {
    if (!activeIncidentTarget) return;
    setLifecycleState("AT_SCENE");

    if (currentUser.role === "FIRE_ENGINE") {
      // Fire Engine: transition incident to CONTAINED (shrinks red zone by 50% and turns orange)
      const updated = await updateIncidentStatus(activeIncidentTarget.id, "CONTAINED");
      const containedIncident = {
        ...activeIncidentTarget,
        status: "CONTAINED" as const,
        severity: "HIGH" as const,
        radius_meters: Math.round(activeIncidentTarget.radius_meters * 0.5),
      };
      setActiveIncidentTarget(containedIncident);
      setIncidents((prev) =>
        prev.map((i) => (i.id === activeIncidentTarget.id ? containedIncident : i))
      );
    } else {
      // Ambulance: switches navigation target to Hospital H2 (Gandhi) via bypass
      setSelectedAction("OPTION_B");
      const updated = await updateIncidentStatus(activeIncidentTarget.id, "RESPONDING");
      const respondingIncident = {
        ...activeIncidentTarget,
        status: "RESPONDING" as const,
        title: `Transit to H2 Gandhi (Patient from ${activeIncidentTarget.title})`,
      };
      setActiveIncidentTarget(respondingIncident);
      setIncidents((prev) =>
        prev.map((i) => (i.id === activeIncidentTarget.id ? respondingIncident : i))
      );
    }
  };

  // 11. Arrival Lifecycle: Case Resolved Transition
  const handleCaseResolved = async () => {
    if (!activeIncidentTarget) return;
    setLifecycleState("RESOLVED");

    const updated = await updateIncidentStatus(activeIncidentTarget.id, "RESOLVED");
    const resolvedIncident = {
      ...activeIncidentTarget,
      status: "RESOLVED" as const,
      severity: "SAFE" as const,
    };
    setIncidents((prev) =>
      prev.map((i) => (i.id === activeIncidentTarget.id ? resolvedIncident : i))
    );
    setActiveIncidentTarget(resolvedIncident);

    // Reset vehicle status to Available
    setCurrentUser((prev) => ({
      ...prev,
      name: prev.name.replace(" (BUSY)", "").replace(" (DISPATCHED)", ""),
    }));
  };

  // Calculate Hospital Triage recommendation
  const triageInfo = hospitals.length > 0 ? getHospitalTriageRecommendation(hospitals) : null;

  return (
    <main className="relative w-screen h-screen overflow-hidden select-none bg-[#0D1117] font-sans">
      {/* 1. Full-Screen Tactical Map Viewport */}
      <MapContainer
        currentUser={currentUser}
        activeUsers={activeUsers}
        incidents={incidents}
        hotspots={hotspots}
        selectedAction={selectedAction}
        isPinDropMode={isPinDropMode}
        isHotspotMode={isHotspotMode}
        activeIncidentTarget={activeIncidentTarget}
        isGridSimulationActive={isGridSimulationActive}
        onMapClick={handleMapClick}
        onSelectIncident={handleSelectIncident}
      />

      {/* 2. Top Floating Glassmorphism Header Bar */}
      <TopFloatingHeader
        currentRole={currentUser.role}
        userName={currentUser.name}
        activeHazardsCount={incidents.filter((i) => i.status === "ACTIVE").length}
        onToggleDrawer={() => setIsDrawerOpen((prev) => !prev)}
        onOpenReportModal={() => setIsReportModalOpen(true)}
      />

      {/* 3. Collapsible Slide-Over Drawer */}
      <SlideOverDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        currentUser={currentUser}
        onSwitchRole={handleSwitchRole}
        isHotspotMode={isHotspotMode}
        onToggleHotspotMode={() => {
          setIsHotspotMode((prev) => !prev);
          setIsPinDropMode(false);
        }}
        hotspots={hotspots}
        onClearHotspots={() => setHotspots([])}
        activeUsers={activeUsers}
        incidents={incidents}
        hospitals={hospitals}
        isGridSimulationActive={isGridSimulationActive}
        onToggleGridSimulation={() => setIsGridSimulationActive((prev) => !prev)}
        onSelectIncident={(inc) => {
          handleSelectIncident(inc);
          setIsDrawerOpen(false);
        }}
        onResolveIncident={(incId) => {
          updateIncidentStatus(incId, "RESOLVED");
          setIncidents((prev) =>
            prev.map((i) => (i.id === incId ? { ...i, status: "RESOLVED" } : i))
          );
        }}
        selectedAction={selectedAction}
        onSelectAction={setSelectedAction}
        onOpenReportModal={() => {
          setIsDrawerOpen(false);
          setIsReportModalOpen(true);
        }}
      />

      {/* 4. Arrival Lifecycle Action Banner (Phase 3 & 4) */}
      {activeIncidentTarget && (
        <TacticalLifecycleBanner
          activeIncident={activeIncidentTarget}
          userRole={currentUser.role}
          lifecycleState={lifecycleState}
          triageText={triageInfo?.recommendationText}
          onAcceptAndNavigate={handleAcceptAndNavigate}
          onArrivedAtScene={handleArrivedAtScene}
          onCaseResolved={handleCaseResolved}
          onDismiss={() => {
            setActiveIncidentTarget(null);
            setLifecycleState("UNACCEPTED");
          }}
        />
      )}

      {/* 5. Floating Action Button (FAB) on Bottom Right */}
      <button
        onClick={() => setIsReportModalOpen(true)}
        aria-label="Create Custom Incident or Voice Note"
        className="fixed bottom-6 right-6 z-30 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-95 text-white shadow-2xl hover:shadow-blue-500/40 flex items-center justify-center transition-all group"
      >
        <Plus className="w-6 h-6 transition-transform group-hover:rotate-90 duration-200" />
      </button>

      {/* 6. Multimodal Incident Intake & Custom Pin Dropper Modal */}
      <EmergencyIntakeModal
        isOpen={isReportModalOpen}
        onClose={() => {
          setIsReportModalOpen(false);
          setPinCoordinates(null);
        }}
        onIncidentCreated={handleIncidentCreated}
        pinCoordinates={pinCoordinates}
        onStartPinDrop={() => {
          setIsPinDropMode(true);
          setIsHotspotMode(false);
        }}
      />
    </main>
  );
}
