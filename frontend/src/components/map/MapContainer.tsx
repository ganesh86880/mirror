"use client";

import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { HazardIncident, UserProfile, UserRole } from "@/lib/api";

const HYDERABAD_CENTER: [number, number] = [78.466, 17.396];

// Watermark-free OpenStreetMap raster tile style definition as safety net
export const OSM_DARK_STYLE: any = {
  version: 8,
  sources: {
    "osm-tiles": {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "&copy; OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "osm-tiles-layer",
      type: "raster",
      source: "osm-tiles",
      minzoom: 0,
      maxzoom: 19,
      paint: {
        "raster-opacity": 0.85,
        "raster-brightness-max": 0.55,
        "raster-contrast": 0.25,
      },
    },
  ],
};
export const CARTO_DARK_STYLE = OSM_DARK_STYLE;


// Generate precise geodesic circular polygon in meters
function createCirclePolygon(center: [number, number], radiusInMeters: number, points = 36): number[][] {
  const [lng, lat] = center;
  const coords: number[][] = [];
  const km = radiusInMeters / 1000;
  const distanceX = km / (111.32 * Math.cos((lat * Math.PI) / 180));
  const distanceY = km / 110.574;

  for (let i = 0; i <= points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);
    coords.push([lng + x, lat + y]);
  }
  return coords;
}

// Visual encoding helper for hazard zones
export function getZoneVisuals(incident: HazardIncident): {
  fillColor: string;
  fillOpacity: number;
  borderColor: string;
} {
  if (incident.status === "RESOLVED" || incident.severity === "SAFE") {
    // Green Zone: Resolved areas / Designated relief points (30% opacity)
    return { fillColor: "#2E856E", fillOpacity: 0.30, borderColor: "#2E856E" };
  }
  if (incident.status === "CONTAINED") {
    // Contained incident (Arrival lifecycle): Zone shrinks 50% & turns orange
    return { fillColor: "#D97706", fillOpacity: 0.35, borderColor: "#D97706" };
  }
  if (incident.severity === "CRITICAL" || incident.incident_type === "FIRE" || incident.incident_type === "SOS") {
    // Red Zone: Matte Crimson #C53030 with crisp border #E63946
    return { fillColor: "#C53030", fillOpacity: 0.35, borderColor: "#E63946" };
  }
  if (incident.incident_type === "FLOOD") {
    // Blue Zone: Localized waterlogging / flash floods (40% opacity)
    return { fillColor: "#1D4E89", fillOpacity: 0.40, borderColor: "#1D4E89" };
  }
  // Orange Zone: High severity (Major road blocks, structural risk) (35% opacity)
  return { fillColor: "#D97706", fillOpacity: 0.35, borderColor: "#D97706" };
}

export function getUserRoleColor(role: UserRole): string {
  switch (role) {
    case "AMBULANCE":
      return "#2E856E"; // Pulsing Green Marker
    case "FIRE_ENGINE":
      return "#C53030"; // Pulsing Red Marker
    case "TRAFFIC_POLICE":
    case "PUBLIC":
    default:
      return "#2563EB"; // Pulsing Blue Marker
  }
}

export interface TrafficHotspot {
  id: string;
  lat: number;
  lng: number;
  title: string;
  timestamp: string;
}

interface MapContainerProps {
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
  isGridSimulationActive?: boolean;
  onMapClick?: (coords: [number, number]) => void;
  onSelectIncident?: (incident: HazardIncident) => void;
}

export default function MapContainer({
  currentUser,
  activeUsers = [],
  incidents = [],
  hotspots = [],
  selectedAction = "OPTION_B",
  isPinDropMode = false,
  isHotspotMode = false,
  activeIncidentTarget = null,
  isGridSimulationActive = false,
  onMapClick,
  onSelectIncident,
}: MapContainerProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState<boolean>(false);
  const mapLoadedRef = useRef<boolean>(false);

  // Simulation fleet autonomous coordinates state
  const [simAmbCoords, setSimAmbCoords] = useState<[number, number]>([78.4720, 17.3910]);
  const [simPoliceCoords, setSimPoliceCoords] = useState<[number, number]>([78.4950, 17.3820]);
  const simAmbMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const simPoliceMarkerRef = useRef<mapboxgl.Marker | null>(null);

  // Markers refs
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const responderMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const incidentMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const hotspotMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());

  // 1. Initialize Mapbox Map with official Mapbox Dark style
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const userToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim();
    const token =
      userToken && userToken.startsWith("pk.")
        ? userToken
        : "pk.eyJ1IjoiZ2FuZXNoLTExOTkiLCJhIjoiY211enRndHBlMDRqYjJ5cjQ4cXN2NXNjcCJ9.snCUr8XupyRVjh47bDC2vA";

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: HYDERABAD_CENTER,
      zoom: 14,
      pitch: 45,
      bearing: -12,
      antialias: true,
    });

    mapRef.current = map;

    // Setup sources and layers when style loads
    const setupLayers = () => {
      setMapLoaded(true);
      mapLoadedRef.current = true;
      map.resize();

      // Hazard Zones GeoJSON Source & Layers
      if (!map.getSource("hazard-zone-source")) {
        map.addSource("hazard-zone-source", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
      }

      if (!map.getLayer("hazard-zone-fill")) {
        map.addLayer({
          id: "hazard-zone-fill",
          type: "fill",
          source: "hazard-zone-source",
          paint: {
            "fill-color": ["get", "fillColor"],
            "fill-opacity": ["get", "fillOpacity"],
          },
        });
      }

      if (!map.getLayer("hazard-zone-line")) {
        map.addLayer({
          id: "hazard-zone-line",
          type: "line",
          source: "hazard-zone-source",
          paint: {
            "line-color": ["get", "borderColor"],
            "line-width": 2,
            "line-opacity": 0.95,
          },
        });
      }

      // Active Incident Corridor Route Source & Layers
      if (!map.getSource("active-incident-corridor")) {
        map.addSource("active-incident-corridor", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
      }

      if (!map.getLayer("active-incident-bypass-casing")) {
        map.addLayer({
          id: "active-incident-bypass-casing",
          type: "line",
          source: "active-incident-corridor",
          filter: ["==", "type", "TACTICAL_BYPASS"],
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#0D281E", "line-width": 8, "line-opacity": 0.6 },
        });
      }

      if (!map.getLayer("active-incident-bypass")) {
        map.addLayer({
          id: "active-incident-bypass",
          type: "line",
          source: "active-incident-corridor",
          filter: ["==", "type", "TACTICAL_BYPASS"],
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#2E856E", "line-width": 4.5, "line-opacity": 0.95 },
        });
      }

      if (!map.getLayer("active-incident-direct")) {
        map.addLayer({
          id: "active-incident-direct",
          type: "line",
          source: "active-incident-corridor",
          filter: ["==", "type", "DIRECT_CONGESTED"],
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#D97706",
            "line-width": 3.5,
            "line-dasharray": [2, 2],
            "line-opacity": 0.85,
          },
        });
      }
    };

    map.on("load", setupLayers);
    map.on("style.load", setupLayers);

    // Resilient fallback: only switch if Mapbox encounters an explicit authentication rejection (401/403)
    let fallbackTriggered = false;
    const triggerOsmFallback = () => {
      if (fallbackTriggered) return;
      fallbackTriggered = true;
      console.warn("Mapbox authentication rejected (401/403). Switching to watermark-free OSM tiles.");
      try {
        map.setStyle(OSM_DARK_STYLE);
      } catch (e) {
        console.warn("setStyle error:", e);
      }
    };

    map.on("error", (e: any) => {
      const status = e?.error?.status;
      if (status === 401 || status === 403) {
        triggerOsmFallback();
      }
    });

    // Dynamic resize handler
    const handleResize = () => {
      if (mapRef.current) mapRef.current.resize();
    };
    window.addEventListener("resize", handleResize);

    const t1 = setTimeout(() => {
      if (mapRef.current) mapRef.current.resize();
    }, 150);
    const t2 = setTimeout(() => {
      if (mapRef.current) mapRef.current.resize();
    }, 500);

    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(t1);
      clearTimeout(t2);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 2. Map click handler for pin drop / hotspot mode
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleClick = (e: mapboxgl.MapMouseEvent) => {
      if (onMapClick) onMapClick([e.lngLat.lng, e.lngLat.lat]);
    };

    map.on("click", handleClick);
    return () => {
      map.off("click", handleClick);
    };
  }, [onMapClick]);

  // Update cursor based on mode
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const canvas = map.getCanvas();
    if (isPinDropMode || isHotspotMode) {
      canvas.style.cursor = "crosshair";
    } else {
      canvas.style.cursor = "";
    }
  }, [isPinDropMode, isHotspotMode]);

  // 3. Update Dynamic Hazard Zones GeoJSON on canvas
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const source = map.getSource("hazard-zone-source") as mapboxgl.GeoJSONSource;
    if (!source) return;

    // Build features for all incidents, ensuring active target is prominent
    const allIncidents = [...incidents];
    if (activeIncidentTarget && !allIncidents.some((i) => i.id === activeIncidentTarget.id)) {
      allIncidents.unshift(activeIncidentTarget);
    }

    const features: GeoJSON.Feature[] = allIncidents.map((inc) => {
      const center: [number, number] = [inc.lng || 78.466, inc.lat || 17.396];
      const effectiveRadius = inc.status === "CONTAINED" ? Math.round(inc.radius_meters * 0.5) : inc.radius_meters;
      const circleCoords = createCirclePolygon(center, effectiveRadius, 36);
      const visuals = getZoneVisuals(inc);

      return {
        type: "Feature",
        properties: {
          id: inc.id,
          title: inc.title,
          incident_type: inc.incident_type,
          severity: inc.severity,
          status: inc.status,
          fillColor: visuals.fillColor,
          fillOpacity: visuals.fillOpacity,
          borderColor: visuals.borderColor,
          radius_meters: effectiveRadius,
        },
        geometry: {
          type: "Polygon",
          coordinates: [circleCoords],
        },
      };
    });

    source.setData({
      type: "FeatureCollection",
      features,
    });

    // Update incident center HTML markers
    const currentMarkerMap = incidentMarkersRef.current;
    const incomingIds = new Set(allIncidents.map((i) => i.id));

    currentMarkerMap.forEach((marker, id) => {
      if (!incomingIds.has(id)) {
        marker.remove();
        currentMarkerMap.delete(id);
      }
    });

    allIncidents.forEach((inc) => {
      const visuals = getZoneVisuals(inc);
      let marker = currentMarkerMap.get(inc.id);

      if (!marker) {
        const el = document.createElement("div");
        el.className = "cursor-pointer group flex flex-col items-center select-none";
        el.innerHTML = `
          <div class="px-2.5 py-1 rounded-full border text-[10px] font-mono font-bold uppercase tracking-wider shadow-xl flex items-center gap-1.5 transition-transform transform group-hover:scale-110"
               style="background-color: ${visuals.fillColor}F0; border-color: ${visuals.borderColor}; color: #FFFFFF;">
            <span>${inc.incident_type}</span>
            <span class="opacity-80 text-[8px]">${inc.status === "CONTAINED" ? "50%" : inc.radius_meters + "m"}</span>
          </div>
          <div class="w-2 h-2 rounded-full mt-0.5" style="background-color: ${visuals.borderColor};"></div>
        `;

        el.addEventListener("click", (e) => {
          e.stopPropagation();
          if (onSelectIncident) onSelectIncident(inc);
        });

        marker = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([inc.lng, inc.lat])
          .addTo(map);

        currentMarkerMap.set(inc.id, marker);
      } else {
        marker.setLngLat([inc.lng, inc.lat]);
      }
    });
  }, [incidents, activeIncidentTarget, mapLoaded, onSelectIncident]);

  // 4. Render Active Vehicle Location Dot
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const userColor = getUserRoleColor(currentUser.role);
    const vehicleCoords: [number, number] = [currentUser.lng || 78.455, currentUser.lat || 17.388];

    if (!userMarkerRef.current) {
      const el = document.createElement("div");
      el.className = "relative flex items-center justify-center cursor-pointer pointer-events-auto select-none";
      el.innerHTML = `
        <div class="user-ping absolute w-9 h-9 rounded-full opacity-75 animate-ping" style="background-color: ${userColor};"></div>
        <div class="user-radar absolute w-6 h-6 rounded-full border-2 animate-pulse" style="border-color: ${userColor};"></div>
        <div class="user-dot relative w-4 h-4 rounded-full border-2 border-white shadow-2xl" style="background-color: ${userColor};"></div>
        <div class="absolute -bottom-5 px-2 py-0.5 rounded-full bg-black/90 text-[8px] font-mono text-white whitespace-nowrap border border-white/20 shadow-md">
          ${currentUser.role} (ACTIVE)
        </div>
      `;

      const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat(vehicleCoords)
        .addTo(map);

      userMarkerRef.current = marker;
    } else {
      userMarkerRef.current.setLngLat(vehicleCoords);
      const el = userMarkerRef.current.getElement();
      const dot = el.querySelector(".user-dot") as HTMLElement;
      const ping = el.querySelector(".user-ping") as HTMLElement;
      const radar = el.querySelector(".user-radar") as HTMLElement;
      const label = el.querySelector("div:last-child") as HTMLElement;

      if (dot) dot.style.backgroundColor = userColor;
      if (ping) ping.style.backgroundColor = userColor;
      if (radar) radar.style.borderColor = userColor;
      if (label) label.textContent = `${currentUser.role} (ACTIVE)`;
    }
  }, [currentUser, mapLoaded]);

  // 5. Render Other Active Responders
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const markerMap = responderMarkersRef.current;
    const otherResponders = activeUsers.filter((u) => u.id !== currentUser.id);
    const incomingIds = new Set(otherResponders.map((u) => u.id));

    markerMap.forEach((marker, id) => {
      if (!incomingIds.has(id)) {
        marker.remove();
        markerMap.delete(id);
      }
    });

    otherResponders.forEach((u) => {
      const color = getUserRoleColor(u.role);
      let marker = markerMap.get(u.id);

      if (!marker) {
        const el = document.createElement("div");
        el.className = "flex flex-col items-center group cursor-pointer select-none";
        el.innerHTML = `
          <div class="w-3.5 h-3.5 rounded-full border-2 border-white shadow-lg" style="background-color: ${color};"></div>
          <div class="px-1.5 py-0.5 rounded bg-black/85 text-[8px] font-mono text-gray-200 mt-0.5 border border-white/10 whitespace-nowrap">
            ${u.name.split(" ")[0]}
          </div>
        `;
        marker = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([u.lng, u.lat])
          .addTo(map);
        markerMap.set(u.id, marker);
      } else {
        marker.setLngLat([u.lng, u.lat]);
      }
    });
  }, [activeUsers, currentUser.id, mapLoaded]);

  // 6. Dynamic Route Simulation Polyline
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const source = map.getSource("active-incident-corridor") as mapboxgl.GeoJSONSource;
    if (!source) return;

    if (!activeIncidentTarget) {
      source.setData({ type: "FeatureCollection", features: [] });
      return;
    }

    const vehiclePos: [number, number] = [currentUser.lng || 78.455, currentUser.lat || 17.388];
    const hazardPos: [number, number] = [activeIncidentTarget.lng || 78.466, activeIncidentTarget.lat || 17.396];

    // If Ambulance is rerouting to Gandhi Hospital after stabilizing
    if (activeIncidentTarget.status === "CONTAINED" && currentUser.role === "AMBULANCE") {
      const hospitalPos: [number, number] = [78.503, 17.424];
      const bypassHospCoords: [number, number][] = [
        hazardPos,
        [78.478, 17.406],
        [78.491, 17.416],
        hospitalPos,
      ];

      source.setData({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { type: "TACTICAL_BYPASS", color: "#2E856E" },
            geometry: { type: "LineString", coordinates: bypassHospCoords },
          },
        ],
      });
      return;
    }

    // Standard Active Navigation from vehicle [78.455, 17.388] to hazard [78.466, 17.396]
    // 1. Tactical Green bypass segment (#2E856E, line-width 4.5)
    const bypassCoords: [number, number][] = [
      vehiclePos,
      [78.458, 17.393],
      [78.462, 17.395],
      hazardPos,
    ];

    // 2. Congested road segment crossing Sector 09 in Warning Amber (#D97706, dashed)
    const congestedCoords: [number, number][] = [
      vehiclePos,
      [78.460, 17.389],
      [78.464, 17.392],
      hazardPos,
    ];

    source.setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { type: "TACTICAL_BYPASS", color: "#2E856E" },
          geometry: { type: "LineString", coordinates: bypassCoords },
        },
        {
          type: "Feature",
          properties: { type: "DIRECT_CONGESTED", color: "#D97706" },
          geometry: { type: "LineString", coordinates: congestedCoords },
        },
      ],
    });
  }, [activeIncidentTarget, currentUser, mapLoaded]);

  // 7. Marked Traffic Hotspots
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const markerMap = hotspotMarkersRef.current;
    const incomingIds = new Set(hotspots.map((h) => h.id));

    markerMap.forEach((marker, id) => {
      if (!incomingIds.has(id)) {
        marker.remove();
        markerMap.delete(id);
      }
    });

    hotspots.forEach((h) => {
      let marker = markerMap.get(h.id);
      if (!marker) {
        const el = document.createElement("div");
        el.className = "flex flex-col items-center cursor-pointer select-none";
        el.innerHTML = `
          <div class="px-2 py-0.5 rounded bg-[#D97706] text-white text-[9px] font-mono font-bold shadow-lg border border-amber-300 flex items-center gap-1">
            <span>⚠</span>
            <span>HOTSPOT</span>
          </div>
          <div class="w-1 h-2 bg-[#D97706]"></div>
        `;
        marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([h.lng, h.lat])
          .addTo(map);
        markerMap.set(h.id, marker);
      } else {
        marker.setLngLat([h.lng, h.lat]);
      }
    });
  }, [hotspots, mapLoaded]);

  // 8. Autonomous Responder Simulation Grid Animation
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (!isGridSimulationActive) {
      if (simAmbMarkerRef.current) {
        simAmbMarkerRef.current.remove();
        simAmbMarkerRef.current = null;
      }
      if (simPoliceMarkerRef.current) {
        simPoliceMarkerRef.current.remove();
        simPoliceMarkerRef.current = null;
      }
      return;
    }

    if (!simAmbMarkerRef.current) {
      const el = document.createElement("div");
      el.innerHTML = `
        <div class="w-3.5 h-3.5 rounded-full border border-white/80 bg-[#2E856E] shadow-xl animate-pulse"></div>
        <div class="px-1 py-0.2 rounded bg-black/90 text-[7px] font-mono text-emerald-400 mt-0.5 whitespace-nowrap">SIM-AMB-02</div>
      `;
      simAmbMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat(simAmbCoords)
        .addTo(map);
    }

    if (!simPoliceMarkerRef.current) {
      const el = document.createElement("div");
      el.innerHTML = `
        <div class="w-3.5 h-3.5 rounded-full border border-white/80 bg-[#2563EB] shadow-xl animate-pulse"></div>
        <div class="px-1 py-0.2 rounded bg-black/90 text-[7px] font-mono text-blue-400 mt-0.5 whitespace-nowrap">SIM-PATROL-09</div>
      `;
      simPoliceMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat(simPoliceCoords)
        .addTo(map);
    }

    const ambWaypoints: [number, number][] = [
      [78.4720, 17.3910],
      [78.4780, 17.3940],
      [78.4850, 17.3990],
      [78.4920, 17.4080],
      [78.4850, 17.3990],
      [78.4780, 17.3940],
    ];

    const policeWaypoints: [number, number][] = [
      [78.4950, 17.3820],
      [78.4900, 17.3880],
      [78.4830, 17.3950],
      [78.4770, 17.3890],
      [78.4830, 17.3950],
      [78.4900, 17.3880],
    ];

    let step = 0;
    const interval = setInterval(() => {
      step = (step + 1) % ambWaypoints.length;
      const ambNext = ambWaypoints[step];
      const polNext = policeWaypoints[step % policeWaypoints.length];

      setSimAmbCoords(ambNext);
      setSimPoliceCoords(polNext);

      if (simAmbMarkerRef.current) simAmbMarkerRef.current.setLngLat(ambNext);
      if (simPoliceMarkerRef.current) simPoliceMarkerRef.current.setLngLat(polNext);
    }, 2200);

    return () => clearInterval(interval);
  }, [isGridSimulationActive, mapLoaded, simAmbCoords, simPoliceCoords]);

  return (
    <div className="w-full h-full min-h-screen fixed inset-0 z-0 overflow-hidden bg-[#11141A]">
      {/* Mapbox GL Canvas Container */}
      <div
        ref={mapContainerRef}
        className="w-full h-full relative z-10"
        style={{ width: "100%", height: "100%" }}
      />

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
