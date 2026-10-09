"use client";

import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { HazardIncident, UserProfile, UserRole } from "@/lib/api";

const HYDERABAD_CENTER: [number, number] = [17.396, 78.466]; // [lat, lng] for Leaflet

export interface TrafficHotspot {
  id: string;
  lat: number;
  lng: number;
  title: string;
  timestamp: string;
}

// Visual encoding helper for hazard zones
export function getZoneVisuals(incident: HazardIncident): {
  fillColor: string;
  fillOpacity: number;
  borderColor: string;
} {
  if (incident.status === "RESOLVED" || incident.severity === "SAFE") {
    return { fillColor: "#2E856E", fillOpacity: 0.3, borderColor: "#2E856E" };
  }
  if (incident.status === "CONTAINED") {
    return { fillColor: "#D97706", fillOpacity: 0.35, borderColor: "#D97706" };
  }
  if (incident.severity === "CRITICAL" || incident.incident_type === "FIRE" || incident.incident_type === "SOS") {
    return { fillColor: "#C53030", fillOpacity: 0.35, borderColor: "#E63946" };
  }
  if (incident.incident_type === "FLOOD") {
    return { fillColor: "#1D4E89", fillOpacity: 0.4, borderColor: "#1D4E89" };
  }
  return { fillColor: "#D97706", fillOpacity: 0.35, borderColor: "#D97706" };
}

export function getUserRoleColor(role: UserRole): string {
  switch (role) {
    case "AMBULANCE":
      return "#2E856E"; // Emerald
    case "FIRE_ENGINE":
      return "#C53030"; // Crimson
    case "TRAFFIC_POLICE":
    case "PUBLIC":
    default:
      return "#2563EB"; // Blue
  }
}

interface LeafletMapContainerProps {
  currentUser: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    lat: number;
    lng: number;
  };
  activeUsers?: UserProfile[];
  incidents?: HazardIncident[];
  hotspots?: TrafficHotspot[];
  selectedAction?: string;
  isPinDropMode?: boolean;
  isHotspotMode?: boolean;
  activeIncidentTarget?: HazardIncident | null;
  lifecycleState?: string;
  isDualDispatch?: boolean;
  isGridSimulationActive?: boolean;
  onMapClick?: (coords: [number, number]) => void;
  onSelectIncident?: (incident: HazardIncident) => void;
}

export default function LeafletMapContainer({
  currentUser,
  activeUsers = [],
  incidents = [],
  hotspots = [],
  selectedAction = "OPTION_B",
  isPinDropMode = false,
  isHotspotMode = false,
  activeIncidentTarget = null,
  lifecycleState = "UNACCEPTED",
  isDualDispatch = false,
  isGridSimulationActive = false,
  onMapClick,
  onSelectIncident,
}: LeafletMapContainerProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState<boolean>(false);

  // Layer groups for clean, declarative updates
  const hazardLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const responderLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const corridorLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const hotspotLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const simLayerGroupRef = useRef<L.LayerGroup | null>(null);

  // User active marker ref
  const userMarkerRef = useRef<L.Marker | null>(null);

  // Simulation fleet autonomous coordinates state
  const [simAmbCoords, setSimAmbCoords] = useState<[number, number]>([17.391, 78.472]);
  const [simPoliceCoords, setSimPoliceCoords] = useState<[number, number]>([17.382, 78.495]);
  const simAmbMarkerRef = useRef<L.Marker | null>(null);
  const simPoliceMarkerRef = useRef<L.Marker | null>(null);

  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const [isDarkStyle, setIsDarkStyle] = useState<boolean>(true);

  // 1. Initialize Leaflet Map (Zero API Key, OpenStreetMap)
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Create Leaflet map instance
    const map = L.map(mapContainerRef.current, {
      center: HYDERABAD_CENTER,
      zoom: 14,
      zoomControl: false,
      attributionControl: true,
    });

    // Add standard OpenStreetMap tiles (100% Free, NO Token, NO Watermarks)
    const osmLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      subdomains: ["a", "b", "c"],
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      className: isDarkStyle ? "tactical-dark-tiles" : "standard-osm-tiles",
    });
    osmLayer.addTo(map);
    tileLayerRef.current = osmLayer;

    // Zoom controls on top right
    L.control.zoom({ position: "topright" }).addTo(map);

    // Initialize layer groups
    hazardLayerGroupRef.current = L.layerGroup().addTo(map);
    responderLayerGroupRef.current = L.layerGroup().addTo(map);
    corridorLayerGroupRef.current = L.layerGroup().addTo(map);
    hotspotLayerGroupRef.current = L.layerGroup().addTo(map);
    simLayerGroupRef.current = L.layerGroup().addTo(map);

    mapRef.current = map;
    setMapLoaded(true);

    // Invalidate size across multiple intervals to ensure perfect canvas fill
    const t1 = setTimeout(() => map.invalidateSize(), 100);
    const t2 = setTimeout(() => map.invalidateSize(), 300);
    const t3 = setTimeout(() => map.invalidateSize(), 800);

    const handleResize = () => {
      map.invalidateSize();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Sync dark style toggle with tile layer container class
  useEffect(() => {
    if (!tileLayerRef.current) return;
    const container = tileLayerRef.current.getContainer();
    if (container) {
      if (isDarkStyle) {
        container.className = "leaflet-tile-pane tactical-dark-tiles";
      } else {
        container.className = "leaflet-tile-pane standard-osm-tiles";
      }
    }
  }, [isDarkStyle]);


  // 2. Map Click Handler for Pin Drop / Hotspot Marking
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      if (onMapClick) {
        // Return [lng, lat] for downstream compatibility
        onMapClick([e.latlng.lng, e.latlng.lat]);
      }
    };

    map.on("click", handleMapClick);
    return () => {
      map.off("click", handleMapClick);
    };
  }, [onMapClick]);

  // 3. Cursor update based on active mode
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;
    if (isPinDropMode || isHotspotMode) {
      container.style.cursor = "crosshair";
    } else {
      container.style.cursor = "";
    }
  }, [isPinDropMode, isHotspotMode]);

  // 4. Render Dynamic Hazard Zones (Polygons + Center Badges)
  useEffect(() => {
    const group = hazardLayerGroupRef.current;
    if (!group || !mapLoaded) return;

    group.clearLayers();

    const allIncidents = [...incidents];
    if (activeIncidentTarget && !allIncidents.some((i) => i.id === activeIncidentTarget.id)) {
      allIncidents.unshift(activeIncidentTarget);
    }

    // Completely filter out resolved hazards so solved incidents vanish from map
    const activeIncidents = allIncidents.filter((inc) => inc.status !== "RESOLVED");

    activeIncidents.forEach((inc) => {
      const lat = inc.lat || 17.396;
      const lng = inc.lng || 78.466;
      const effectiveRadius = inc.status === "CONTAINED" ? Math.round(inc.radius_meters * 0.5) : inc.radius_meters;
      const visuals = getZoneVisuals(inc);

      // Hazard boundary circle
      const circle = L.circle([lat, lng], {
        radius: effectiveRadius,
        color: visuals.borderColor,
        weight: 2,
        opacity: 0.9,
        fillColor: visuals.fillColor,
        fillOpacity: visuals.fillOpacity,
      });
      group.addLayer(circle);

      // Incident Center Tactical Badge Icon
      const badgeIcon = L.divIcon({
        className: "custom-hazard-marker",
        html: `
          <div class="cursor-pointer group flex flex-col items-center select-none" style="transform: translate(-50%, -50%);">
            <div class="px-2.5 py-1 rounded-full border text-[10px] font-mono font-bold uppercase tracking-wider shadow-xl flex items-center gap-1.5 transition-transform transform group-hover:scale-110"
                 style="background-color: ${visuals.fillColor}F0; border-color: ${visuals.borderColor}; color: #FFFFFF;">
              <span>${inc.incident_type}</span>
              <span class="opacity-80 text-[8px]">${inc.status === "CONTAINED" ? "50%" : inc.radius_meters + "m"}</span>
            </div>
            <div class="w-2 h-2 rounded-full mt-0.5" style="background-color: ${visuals.borderColor};"></div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const marker = L.marker([lat, lng], { icon: badgeIcon });
      marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        if (onSelectIncident) onSelectIncident(inc);
      });
      group.addLayer(marker);
    });
  }, [incidents, activeIncidentTarget, mapLoaded, onSelectIncident]);

  // 5. Render Active User Vehicle Dot & Pulse Radar
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const lat = currentUser.lat || 17.388;
    const lng = currentUser.lng || 78.455;
    const userColor = getUserRoleColor(currentUser.role);

    const vehicleIcon = L.divIcon({
      className: "custom-user-vehicle",
      html: `
        <div class="relative flex items-center justify-center cursor-pointer select-none" style="transform: translate(-50%, -50%);">
          <div class="user-ping absolute w-9 h-9 rounded-full opacity-75 animate-ping" style="background-color: ${userColor};"></div>
          <div class="user-radar absolute w-6 h-6 rounded-full border-2 animate-pulse" style="border-color: ${userColor};"></div>
          <div class="user-dot relative w-4 h-4 rounded-full border-2 border-white shadow-2xl" style="background-color: ${userColor};"></div>
          <div class="absolute -bottom-5 px-2 py-0.5 rounded-full bg-black/90 text-[8px] font-mono text-white whitespace-nowrap border border-white/20 shadow-md">
            ${currentUser.role} (ACTIVE)
          </div>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });

    if (!userMarkerRef.current) {
      userMarkerRef.current = L.marker([lat, lng], { icon: vehicleIcon, zIndexOffset: 1000 }).addTo(map);
    } else {
      userMarkerRef.current.setLatLng([lat, lng]);
      userMarkerRef.current.setIcon(vehicleIcon);
    }
  }, [currentUser, mapLoaded]);

  // 6. Render Other Active Responders
  useEffect(() => {
    const group = responderLayerGroupRef.current;
    if (!group || !mapLoaded) return;

    group.clearLayers();

    const otherResponders = activeUsers.filter((u) => u.id !== currentUser.id);
    otherResponders.forEach((u) => {
      const color = getUserRoleColor(u.role);
      const icon = L.divIcon({
        className: "custom-responder-marker",
        html: `
          <div class="flex flex-col items-center group cursor-pointer select-none" style="transform: translate(-50%, -50%);">
            <div class="w-3.5 h-3.5 rounded-full border-2 border-white shadow-lg" style="background-color: ${color};"></div>
            <div class="px-1.5 py-0.5 rounded bg-black/85 text-[8px] font-mono text-gray-200 mt-0.5 border border-white/10 whitespace-nowrap">
              ${u.name.split(" ")[0]}
            </div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const marker = L.marker([u.lat, u.lng], { icon });
      group.addLayer(marker);
    });
  }, [activeUsers, currentUser.id, mapLoaded]);

  // 7. Tactical Navigation Route Corridors
  useEffect(() => {
    const group = corridorLayerGroupRef.current;
    if (!group || !mapLoaded) return;

    group.clearLayers();

    if (!activeIncidentTarget) return;

    const vehiclePos: [number, number] = [currentUser.lat || 17.388, currentUser.lng || 78.455]; // [lat, lng]
    const hazardPos: [number, number] = [activeIncidentTarget.lat || 17.396, activeIncidentTarget.lng || 78.466];

    // Ambulance reroute to hospital on CONTAINED
    if (activeIncidentTarget.status === "CONTAINED" && currentUser.role === "AMBULANCE") {
      const hospitalPos: [number, number] = [17.424, 78.503];
      const bypassHospCoords: [number, number][] = [
        hazardPos,
        [17.406, 78.478],
        [17.416, 78.491],
        hospitalPos,
      ];

      // Outer glow/casing line
      const casing = L.polyline(bypassHospCoords, {
        color: "#0D281E",
        weight: 8,
        opacity: 0.6,
        lineCap: "round",
        lineJoin: "round",
      });
      // Inner tactical green bypass line
      const line = L.polyline(bypassHospCoords, {
        color: "#2E856E",
        weight: 4.5,
        opacity: 0.95,
        lineCap: "round",
        lineJoin: "round",
      });
      group.addLayer(casing);
      group.addLayer(line);
      return;
    }

    const isNavigating =
      lifecycleState === "NAVIGATING" ||
      lifecycleState === "AT_SCENE" ||
      activeIncidentTarget.status === "RESPONDING" ||
      activeIncidentTarget.status === "CONTAINED";

    // Scenario A: Ambulance reroute to hospital on CONTAINED
    if (activeIncidentTarget.status === "CONTAINED" && currentUser.role === "AMBULANCE") {
      const hospitalPos: [number, number] = [17.424, 78.503];
      const bypassHospCoords: [number, number][] = [
        vehiclePos,
        [17.406, 78.478],
        [17.416, 78.491],
        hospitalPos,
      ];

      const casing = L.polyline(bypassHospCoords, {
        color: "#0D281E",
        weight: 8,
        opacity: 0.6,
        lineCap: "round",
        lineJoin: "round",
      });
      const line = L.polyline(bypassHospCoords, {
        color: "#2E856E",
        weight: 4.5,
        opacity: 0.95,
        lineCap: "round",
        lineJoin: "round",
      });
      group.addLayer(casing);
      group.addLayer(line);
      return;
    }

    // Scenario B: BEFORE NAVIGATING (UNACCEPTED / PREVIEWING):
    // Show candidate paths so the user/responder can compare choices!
    const bMid1Lat = vehiclePos[0] + (hazardPos[0] - vehiclePos[0]) * 0.33 + 0.002;
    const bMid1Lng = vehiclePos[1] + (hazardPos[1] - vehiclePos[1]) * 0.33 - 0.002;
    const bMid2Lat = vehiclePos[0] + (hazardPos[0] - vehiclePos[0]) * 0.66 - 0.001;
    const bMid2Lng = vehiclePos[1] + (hazardPos[1] - vehiclePos[1]) * 0.66 + 0.002;

    const cMid1Lat = vehiclePos[0] + (hazardPos[0] - vehiclePos[0]) * 0.33 - 0.001;
    const cMid1Lng = vehiclePos[1] + (hazardPos[1] - vehiclePos[1]) * 0.33 + 0.001;
    const cMid2Lat = vehiclePos[0] + (hazardPos[0] - vehiclePos[0]) * 0.66 + 0.001;
    const cMid2Lng = vehiclePos[1] + (hazardPos[1] - vehiclePos[1]) * 0.66 - 0.001;

    if (!isNavigating) {
      // 1. Tactical Green Bypass Route (Option B)
      const bypassCoords: [number, number][] = [
        vehiclePos,
        [bMid1Lat, bMid1Lng],
        [bMid2Lat, bMid2Lng],
        hazardPos,
      ];
      const bypassLine = L.polyline(bypassCoords, {
        color: "#10B981",
        weight: 4.5,
        opacity: selectedAction === "OPTION_B" ? 0.95 : 0.4,
        lineCap: "round",
        lineJoin: "round",
      });
      group.addLayer(bypassLine);

      // 2. Direct Congested Route (Option A, Amber Dashed)
      const congestedCoords: [number, number][] = [
        vehiclePos,
        [cMid1Lat, cMid1Lng],
        [cMid2Lat, cMid2Lng],
        hazardPos,
      ];
      const directLine = L.polyline(congestedCoords, {
        color: "#D97706",
        weight: 3.5,
        opacity: selectedAction === "OPTION_A" ? 0.95 : 0.4,
        dashArray: "6, 8",
        lineCap: "round",
        lineJoin: "round",
      });
      group.addLayer(directLine);
      return;
    }

    // Scenario C: WHILE NAVIGATING:
    // User selected a path: Strictly 1 SINGLE clean line connecting vehicle to target!
    const isDirect = selectedAction === "OPTION_A";
    const navPath: [number, number][] = isDirect
      ? [vehiclePos, [cMid1Lat, cMid1Lng], [cMid2Lat, cMid2Lng], hazardPos]
      : [vehiclePos, [bMid1Lat, bMid1Lng], [bMid2Lat, bMid2Lng], hazardPos];

    const singleActiveLine = L.polyline(navPath, {
      color: isDirect ? "#D97706" : "#10B981",
      weight: 5,
      opacity: 0.95,
      dashArray: isDirect ? "8, 8" : undefined,
      lineCap: "round",
      lineJoin: "round",
    });
    group.addLayer(singleActiveLine);

    // If Dual Dispatch active, simultaneously display partner unit route leading to the scene
    if (isDualDispatch) {
      const partnerRole = currentUser.role === "FIRE_ENGINE" ? "AMBULANCE" : "FIRE_ENGINE";
      const partner = activeUsers.find((u) => u.role === partnerRole);
      if (partner) {
        const pPos: [number, number] = [partner.lat, partner.lng];
        const pMid1Lat = pPos[0] + (hazardPos[0] - pPos[0]) * 0.33;
        const pMid1Lng = pPos[1] + (hazardPos[1] - pPos[1]) * 0.33;
        const pMid2Lat = pPos[0] + (hazardPos[0] - pPos[0]) * 0.66;
        const pMid2Lng = pPos[1] + (hazardPos[1] - pPos[1]) * 0.66;
        const partnerNavPath: [number, number][] = [
          pPos,
          [pMid1Lat, pMid1Lng],
          [pMid2Lat, pMid2Lng],
          hazardPos,
        ];
        const partnerLine = L.polyline(partnerNavPath, {
          color: partnerRole === "FIRE_ENGINE" ? "#DC2626" : "#10B981",
          weight: 4.5,
          opacity: 0.9,
          dashArray: "6, 6",
          lineCap: "round",
          lineJoin: "round",
        });
        group.addLayer(partnerLine);
      }
    }
  }, [activeIncidentTarget, currentUser, activeUsers, isDualDispatch, mapLoaded, lifecycleState, selectedAction]);

  // 7b. Smoothly fly/pan to Active Incident Target whenever created or selected
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !activeIncidentTarget) return;
    const lat = activeIncidentTarget.lat || 17.396;
    const lng = activeIncidentTarget.lng || 78.466;
    map.flyTo([lat, lng], 15, {
      animate: true,
      duration: 1.2,
    });
  }, [activeIncidentTarget?.id, activeIncidentTarget?.lat, activeIncidentTarget?.lng, mapLoaded]);


  // 8. Marked Traffic Hotspots
  useEffect(() => {
    const group = hotspotLayerGroupRef.current;
    if (!group || !mapLoaded) return;

    group.clearLayers();

    hotspots.forEach((h) => {
      const icon = L.divIcon({
        className: "custom-hotspot-marker",
        html: `
          <div class="flex flex-col items-center cursor-pointer select-none" style="transform: translate(-50%, -100%);">
            <div class="px-2 py-0.5 rounded bg-[#D97706] text-white text-[9px] font-mono font-bold shadow-lg border border-amber-300 flex items-center gap-1">
              <span>⚠</span>
              <span>HOTSPOT</span>
            </div>
            <div class="w-1 h-2 bg-[#D97706]"></div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const marker = L.marker([h.lat, h.lng], { icon });
      group.addLayer(marker);
    });
  }, [hotspots, mapLoaded]);

  // 9. Autonomous Responder Simulation Fleet Animation
  useEffect(() => {
    const group = simLayerGroupRef.current;
    if (!group || !mapLoaded) return;

    if (!isGridSimulationActive) {
      group.clearLayers();
      simAmbMarkerRef.current = null;
      simPoliceMarkerRef.current = null;
      return;
    }

    if (!simAmbMarkerRef.current) {
      const ambIcon = L.divIcon({
        className: "custom-sim-amb",
        html: `
          <div class="flex flex-col items-center" style="transform: translate(-50%, -50%);">
            <div class="w-3.5 h-3.5 rounded-full border border-white/80 bg-[#2E856E] shadow-xl animate-pulse"></div>
            <div class="px-1 py-0.2 rounded bg-black/90 text-[7px] font-mono text-emerald-400 mt-0.5 whitespace-nowrap">SIM-AMB-02</div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      simAmbMarkerRef.current = L.marker(simAmbCoords, { icon: ambIcon });
      group.addLayer(simAmbMarkerRef.current);
    }

    if (!simPoliceMarkerRef.current) {
      const polIcon = L.divIcon({
        className: "custom-sim-police",
        html: `
          <div class="flex flex-col items-center" style="transform: translate(-50%, -50%);">
            <div class="w-3.5 h-3.5 rounded-full border border-white/80 bg-[#2563EB] shadow-xl animate-pulse"></div>
            <div class="px-1 py-0.2 rounded bg-black/90 text-[7px] font-mono text-blue-400 mt-0.5 whitespace-nowrap">SIM-PATROL-09</div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      simPoliceMarkerRef.current = L.marker(simPoliceCoords, { icon: polIcon });
      group.addLayer(simPoliceMarkerRef.current);
    }

    const ambWaypoints: [number, number][] = [
      [17.391, 78.472],
      [17.394, 78.478],
      [17.399, 78.485],
      [17.408, 78.492],
      [17.399, 78.485],
      [17.394, 78.478],
    ];

    const policeWaypoints: [number, number][] = [
      [17.382, 78.495],
      [17.388, 78.49],
      [17.395, 78.483],
      [17.389, 78.477],
      [17.395, 78.483],
      [17.388, 78.49],
    ];

    let step = 0;
    const interval = setInterval(() => {
      step = (step + 1) % ambWaypoints.length;
      const ambNext = ambWaypoints[step];
      const polNext = policeWaypoints[step % policeWaypoints.length];

      setSimAmbCoords(ambNext);
      setSimPoliceCoords(polNext);

      if (simAmbMarkerRef.current) simAmbMarkerRef.current.setLatLng(ambNext);
      if (simPoliceMarkerRef.current) simPoliceMarkerRef.current.setLatLng(polNext);
    }, 2200);

    return () => clearInterval(interval);
  }, [isGridSimulationActive, mapLoaded, simAmbCoords, simPoliceCoords]);

  return (
    <div className="w-full h-full min-h-screen fixed inset-0 z-0 overflow-hidden bg-[#11141A]">
      {/* Zero-API-Key Tactical Leaflet OpenStreetMap Container */}
      <div
        ref={mapContainerRef}
        className="w-full h-full relative z-10"
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%" }}
      />

      {/* Map Style Switcher (Tactical Dark vs Standard Street OSM) */}
      <div className="absolute bottom-6 left-6 z-20 pointer-events-auto">
        <button
          onClick={() => setIsDarkStyle(!isDarkStyle)}
          className="bg-[#0D1117]/90 hover:bg-[#161B22] border border-white/20 px-3 py-1.5 rounded-full text-[10px] font-mono text-gray-300 hover:text-white shadow-xl backdrop-blur-md flex items-center gap-1.5 transition-all"
        >
          <span>{isDarkStyle ? "🌙 TACTICAL DARK" : "☀️ STREET OSM"}</span>
        </button>
      </div>

      {/* Crosshair indicator banner when Pin Drop or Hotspot mode is active */}
      {(isPinDropMode || isHotspotMode) && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="bg-black/90 backdrop-blur-md border border-amber-500/50 text-amber-400 font-mono text-xs px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 animate-bounce">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>{isPinDropMode ? "TAP ANYWHERE ON MAP TO SET HAZARD LOCATION" : "TAP TO MARK TRAFFIC HOTSPOT"}</span>
          </div>
        </div>
      )}
    </div>
  );

}
