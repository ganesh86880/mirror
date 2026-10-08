"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import LeftPanel from "@/components/panels/LeftPanel";
import CenterTopBar from "@/components/panels/CenterTopBar";
import RightPanel from "@/components/panels/RightPanel";
import DecisionLogDrawer, { DecisionLogEntry } from "@/components/panels/DecisionLogDrawer";
import CitizenReportModal from "@/components/modals/CitizenReportModal";
import { IngestReportResponse } from "@/lib/api";

// Dynamic import with SSR disabled for Mapbox GL canvas
const MapContainer = dynamic(() => import("@/components/map/MapContainer"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-tactical-bg text-tactical-muted font-mono text-xs gap-2">
      <div className="w-4 h-4 border-2 border-tactical-green border-t-transparent rounded-full animate-spin" />
      <span>INITIALIZING 3D GEOSPATIAL VIEWPORT...</span>
    </div>
  ),
});

export default function MissionControlDashboard() {
  const [selectedAction, setSelectedAction] = useState<string>("OPTION_B");
  const [sliderSeverity, setSliderSeverity] = useState<number>(60);
  const [globalRisk, setGlobalRisk] = useState<number>(74);
  const [isDispatched, setIsDispatched] = useState<boolean>(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [decisionLogs, setDecisionLogs] = useState<DecisionLogEntry[]>([]);

  // Fire Engine dispatch state
  const [isFireDispatched, setIsFireDispatched] = useState<boolean>(false);

  // Phase 4: Citizen Intake state
  const [isCitizenModalOpen, setIsCitizenModalOpen] = useState<boolean>(false);
  const [alertBanner, setAlertBanner] = useState<string | null>(null);
  const [obstacleMarker, setObstacleMarker] = useState<any>(null);

  // Fire Engine dispatch handler
  const handleDispatchFire = () => {
    if (isFireDispatched) return; // Already dispatched
    setIsFireDispatched(true);

    const now = new Date();
    const timeStr = now.toUTCString().split(" ")[4] + " UTC";

    const logEntry: DecisionLogEntry = {
      id: `LOG-FIRE-${Date.now()}`,
      timestamp: timeStr,
      actionCode: "FIRE-DISPATCH",
      actionTitle: "FE-01 Dispatched to Sector 04 Fire Hazard",
      details:
        "Heavy Pumper FE-01 dispatched at 58 km/h to Sector 04 commercial zone blaze. Fire containment perimeter established.",
      riskBefore: globalRisk,
      riskAfter: Math.max(globalRisk - 8, 20),
      targetFacility: "Sector 04 Fire Hazard Zone",
    };

    setDecisionLogs((prev) => [logEntry, ...prev]);
    setGlobalRisk((prev) => Math.max(prev - 8, 20));
    setIsDrawerOpen(true);

    // Also update the backend database
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/db/dispatch-fire`,
      { method: "POST" }
    ).catch(() => {});
  };

  // Dismiss SOS alert and trigger alternative route search
  const handleDismissAlert = () => {
    setAlertBanner(null);
    setObstacleMarker(null);

    // When SOS is dismissed, search for alternative solutions
    // If currently on a compromised route, switch to bypass
    if (selectedAction === "OPTION_A") {
      setSelectedAction("OPTION_B");
      const now = new Date();
      const timeStr = now.toUTCString().split(" ")[4] + " UTC";

      const logEntry: DecisionLogEntry = {
        id: `LOG-REROUTE-${Date.now()}`,
        timestamp: timeStr,
        actionCode: "AUTO-REROUTE",
        actionTitle: "Auto-Rerouted: Obstacle Cleared, Bypass Maintained",
        details:
          "SOS obstacle report dismissed. System evaluated alternatives and maintained Route 3 Bypass as optimal corridor.",
        riskBefore: globalRisk,
        riskAfter: 34,
        targetFacility: "Route 3 Alternate Pathway",
      };

      setDecisionLogs((prev) => [logEntry, ...prev]);
    }
  };

  // Citizen report ingestion handler
  const handleCitizenReportProcessed = (result: IngestReportResponse) => {
    const now = new Date();
    const timeStr = now.toUTCString().split(" ")[4] + " UTC";

    if (result.incident_marker) {
      setObstacleMarker(result.incident_marker);
    }

    if (result.corridor_compromised) {
      const bannerText =
        result.alert_message ||
        "Corridor Compromised — Re-routing Helpline Vehicles to Alternate Pathway";
      setAlertBanner(bannerText);

      // Automatically invalidate primary route and select Option B (Bypass)
      setSelectedAction("OPTION_B");

      // Log citizen ingestion event in the audit trail
      const incidentInfo = result.parsed_incident;
      const logEntry: DecisionLogEntry = {
        id: `LOG-CITIZEN-${Date.now()}`,
        timestamp: timeStr,
        actionCode: "GEMINI-INTAKE",
        actionTitle: `OBSTACLE DETECTED: ${incidentInfo?.blocked_road_name || "MG Road Junction"}`,
        details: `Gemini extraction verified [${incidentInfo?.incident_type} / Sev: ${incidentInfo?.severity_score}/10]. ${incidentInfo?.summary || "Direct arterial route obstructed."} Fleet auto-rerouted via Route 3 Bypass.`,
        riskBefore: globalRisk,
        riskAfter: 34,
        targetFacility: "Route 3 Alternate Pathway",
      };

      setDecisionLogs((prev) => [logEntry, ...prev]);
      setIsDrawerOpen(true);
    }
  };

  // Commander action approval handler
  const handleApproveDispatch = (actionId: string) => {
    const now = new Date();
    const timeStr = now.toUTCString().split(" ")[4] + " UTC";

    let actionCode = "ACTION-B";
    let actionTitle = "Option B: Bypass to H2 (Gandhi)";
    let details = "Amb-01 rerouted via Route 3 Bypass to Hospital H2. Sector 09 congestion avoided. Hospital H1 surge mitigated (+11% H2 intake).";
    let targetFacility = "Hospital H2 (Gandhi)";
    let newRisk = 34;

    if (actionId === "OPTION_A" || actionId === "ROUTE_A") {
      actionCode = "ACTION-A";
      actionTitle = "Option A: Direct to H1 (Osmania)";
      details = "Amb-01 dispatched through Sector 07/09 arterial bottleneck. Subject to transit congestion.";
      targetFacility = "Hospital H1 (Osmania)";
      newRisk = Math.min(100, Math.round(72 + (sliderSeverity - 60) * 0.533));
    } else if (actionId === "OPTION_C" || actionId === "DELAY_10") {
      actionCode = "ACTION-C";
      actionTitle = "Option C: Hold & Clear";
      details = "Amb-01 held in staging position for 10 minutes. Regional population exposure elevated.";
      targetFacility = "Holding Zone";
      newRisk = 86;
    }

    const newEntry: DecisionLogEntry = {
      id: `LOG-${Date.now()}`,
      timestamp: timeStr,
      actionCode,
      actionTitle,
      details,
      riskBefore: globalRisk,
      riskAfter: newRisk,
      targetFacility,
    };

    setDecisionLogs((prev) => [newEntry, ...prev]);
    setGlobalRisk(newRisk);
    setIsDispatched(true);
    setIsDrawerOpen(true); // Auto-expand drawer to display audit trail
  };

  return (
    <main className="w-screen h-screen flex flex-row overflow-hidden bg-tactical-bg text-tactical-text font-sans">
      {/* 1. Left Panel (20% width): Incident & Fleet Telemetry */}
      <div className="w-[20%] min-w-[280px] h-full flex-shrink-0">
        <LeftPanel
          isDispatched={isDispatched}
          isFireDispatched={isFireDispatched}
          onDispatchFire={handleDispatchFire}
        />
      </div>

      {/* 2. Center Panel (55% width): Tactical 3D Geospatial Twin */}
      <div className="w-[55%] flex-1 h-full flex flex-col relative overflow-hidden border-x border-tactical-border">
        {/* Tactical Top Bar */}
        <CenterTopBar
          globalRisk={globalRisk}
          isDispatched={isDispatched}
          onOpenCitizenModal={() => setIsCitizenModalOpen(true)}
          alertBanner={alertBanner}
          onDismissAlert={handleDismissAlert}
        />

        {/* 3D Mapbox Viewport */}
        <div className="flex-1 w-full relative bg-[#11141A] overflow-hidden">
          <MapContainer
            selectedAction={selectedAction}
            sliderSeverity={sliderSeverity}
            onSliderChange={setSliderSeverity}
            isDispatched={isDispatched}
            isFireDispatched={isFireDispatched}
            obstacleMarker={obstacleMarker}
          />
        </div>

        {/* Operational Decision Audit Log Drawer */}
        <DecisionLogDrawer
          logs={decisionLogs}
          isOpen={isDrawerOpen}
          onToggle={() => setIsDrawerOpen((prev) => !prev)}
        />
      </div>

      {/* 3. Right Panel (25% width): Decision Center */}
      <div className="w-[25%] min-w-[320px] h-full flex-shrink-0">
        <RightPanel
          selectedAction={selectedAction}
          onSelectAction={setSelectedAction}
          sliderSeverity={sliderSeverity}
          onApproveDispatch={handleApproveDispatch}
          isDispatched={isDispatched}
          globalRisk={globalRisk}
        />
      </div>

      {/* Citizen Emergency Feed & SOS Reporter Modal */}
      <CitizenReportModal
        isOpen={isCitizenModalOpen}
        onClose={() => setIsCitizenModalOpen(false)}
        onReportProcessed={handleCitizenReportProcessed}
      />
    </main>
  );
}
