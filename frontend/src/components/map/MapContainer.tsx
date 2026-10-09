"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { HazardIncident, UserProfile, UserRole } from "@/lib/api";
import { Flame, AlertTriangle, Waves, ShieldAlert, CheckCircle, Navigation, Radio } from "lucide-react";

const HYDERABAD_CENTER: [number, number] = [78.4867, 17.3850];

// Dynamic Navigation Routes
const ROUTE_3_BYPASS_GEOJSON: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { id: "ROUTE_3", name: "Safe Corridor Bypass to H2", color: "#2E856E" },
      geometry: {
        type: "LineString",
        coordinates: [
          [78.4821, 17.3872],
          [78.4860, 17.3910],
          [78.4910, 17.3980],
          [78.4965, 17.4080],
          [78.5005, 17.4170],
          [78.5034, 17.4243],
        ],
      },
    },
  ],
};

const ROUTE_1_DIRECT_GEOJSON: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { id: "ROUTE_1", name: "Direct Corridor to H1", color: "#D97706" },
      geometry: {
        type: "LineString",
        coordinates: [
          [78.4821, 17.3872],
          [78.4790, 17.3830],
          [78.4755, 17.3795],
          [78.4735, 17.3785],
        ],
      },
    },
  ],
};

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

// Visual encoding helper based on Prompt 2 & Phase 3 specifications
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
    // Red Zone: Critical incidents (Fires, trapped SOS) (35% opacity)
    return { fillColor: "#C53030", fillOpacity: 0.35, borderColor: "#C53030" };
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
      return "#2E856E"; // Pulsing Green Dot
    case "FIRE_ENGINE":
      return "#C53030"; // Pulsing Red Dot
    case "TRAFFIC_POLICE":
    case "PUBLIC":
    default:
      return "#2563EB"; // Clean Blue Dot
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
  const [tokenMissing, setTokenMissing] = useState<boolean>(false);

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

  // 1. Initialize Mapbox Map
  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token || token === "your_mapbox_token_here") {
      setTokenMissing(true);
      return;
    }

    if (!mapContainerRef.current) return;

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: HYDERABAD_CENTER,
      zoom: 14.8,
      pitch: 45,
      bearing: -12,
      antialias: true,
    });

    mapRef.current = map;

    map.on("load", () => {
      setMapLoaded(true);

      // Add 3D building extrusions
      const layers = map.getStyle()?.layers;
      const labelLayerId = layers?.find(
        (layer) => layer.type === "symbol" && layer.layout?.["text-field"]
      )?.id;

      if (!map.getLayer("3d-buildings")) {
        map.addLayer(
          {
            id: "3d-buildings",
            source: "composite",
            "source-layer": "building",
            filter: ["==", "extrude", "true"],
            type: "fill-extrusion",
            minzoom: 14,
            paint: {
              "fill-extrusion-color": "#202531",
              "fill-extrusion-height": [
                "interpolate",
                ["linear"],
                ["zoom"],
                15,
                0,
                15.05,
                ["get", "height"],
              ],
              "fill-extrusion-base": [
                "interpolate",
                ["linear"],
                ["zoom"],
                15,
                0,
                15.05,
                ["get", "min_height"],
              ],
              "fill-extrusion-opacity": 0.8,
            },
          },
          labelLayerId
        );
      }

      // Add Dynamic Navigation Route Sources & Layers
      map.addSource("route-3-bypass", {
        type: "geojson",
        data: ROUTE_3_BYPASS_GEOJSON,
      });

      map.addLayer({
        id: "route-3-casing",
        type: "line",
        source: "route-3-bypass",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#0D281E", "line-width": 10, "line-opacity": 0.6 },
      });

      map.addLayer({
        id: "route-3-line",
        type: "line",
        source: "route-3-bypass",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#2E856E", "line-width": 4.5, "line-opacity": 0.95 },
      });

      map.addSource("route-1-direct", {
        type: "geojson",
        data: ROUTE_1_DIRECT_GEOJSON,
      });

      map.addLayer({
        id: "route-1-line",
        type: "line",
        source: "route-1-direct",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#D97706", "line-width": 3, "line-dasharray": [2, 2], "line-opacity": 0.7 },
      });

      // Add Dynamic Hazard Zones GeoJSON Source
      map.addSource("dynamic-hazard-zones", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      // Dynamic Hazard Fill Layer
      map.addLayer({
        id: "dynamic-hazard-fill",
        type: "fill",
        source: "dynamic-hazard-zones",
        paint: {
          "fill-color": ["get", "fillColor"],
          "fill-opacity": ["get", "fillOpacity"],
        },
      });

      // Clean 1.5px solid border around the zone perimeter — no blurry neon glow
      map.addLayer({
        id: "dynamic-hazard-line",
        type: "line",
        source: "dynamic-hazard-zones",
        paint: {
          "line-color": ["get", "borderColor"],
          "line-width": 1.5,
          "line-opacity": 0.95,
        },
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 2. Handle map clicks for Pin Drop and Hotspot Marking
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleClick = (e: mapboxgl.MapMouseEvent) => {
      if (onMapClick) {
        onMapClick([e.lngLat.lng, e.lngLat.lat]);
      }
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

  // 3. Update Dynamic Hazard Zones GeoJSON when incidents change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const source = map.getSource("dynamic-hazard-zones") as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;

    const features: GeoJSON.Feature[] = incidents.map((inc) => {
      // Arrival lifecycle: if CONTAINED, zone shrinks by 50%
      const effectiveRadius =
        inc.status === "CONTAINED"
          ? Math.max(80, Math.round((inc.radius_meters || 250) * 0.5))
          : inc.radius_meters || 250;

      const circleCoords = createCirclePolygon([inc.lng, inc.lat], effectiveRadius);
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
    const incomingIds = new Set(incidents.map((i) => i.id));

    // Remove old markers not in incoming
    currentMarkerMap.forEach((marker, id) => {
      if (!incomingIds.has(id)) {
        marker.remove();
        currentMarkerMap.delete(id);
      }
    });

    // Add or update markers
    incidents.forEach((inc) => {
      const visuals = getZoneVisuals(inc);
      let marker = currentMarkerMap.get(inc.id);

      if (!marker) {
        const el = document.createElement("div");
        el.className = "cursor-pointer group flex flex-col items-center";
        el.innerHTML = `
          <div class="px-2 py-0.5 rounded-full border text-[9px] font-mono font-bold uppercase tracking-wider shadow-lg flex items-center gap-1 transition-transform transform group-hover:scale-110"
               style="background-color: ${visuals.fillColor}EE; border-color: ${visuals.borderColor}; color: #FFFFFF;">
            <span>${inc.incident_type}</span>
            <span class="opacity-75 text-[8px]">${inc.radius_meters}m</span>
          </div>
          <div class="w-1.5 h-1.5 rounded-full mt-0.5" style="background-color: ${visuals.borderColor};"></div>
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
  }, [incidents, mapLoaded, onSelectIncident]);

  // 4. Render Current User Live Location Pulsing Dot
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const userColor = getUserRoleColor(currentUser.role);

    if (!userMarkerRef.current) {
      const el = document.createElement("div");
      el.className = "user-location-marker relative flex items-center justify-center cursor-pointer";
      el.id = "user-location-marker";

      el.innerHTML = `
        <div class="user-ping absolute w-8 h-8 rounded-full animate-ping opacity-60" style="background-color: ${userColor};"></div>
        <div class="user-radar absolute w-6 h-6 rounded-full border opacity-75" style="border-color: ${userColor};"></div>
        <div class="user-dot relative w-4 h-4 rounded-full border-2 border-white shadow-xl" style="background-color: ${userColor};"></div>
        <div class="absolute -bottom-5 px-1.5 py-0.5 rounded bg-black/85 text-[8px] font-mono font-bold text-white whitespace-nowrap border border-white/20 shadow-md">
          ${currentUser.role}
        </div>
      `;

      userMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([currentUser.lng, currentUser.lat])
        .addTo(map);
    } else {
      userMarkerRef.current.setLngLat([currentUser.lng, currentUser.lat]);
      // Update role color dynamically when switching roles
      const el = userMarkerRef.current.getElement();
      const dot = el.querySelector(".user-dot") as HTMLElement;
      const ping = el.querySelector(".user-ping") as HTMLElement;
      const radar = el.querySelector(".user-radar") as HTMLElement;
      const label = el.querySelector("div:last-child") as HTMLElement;

      if (dot) dot.style.backgroundColor = userColor;
      if (ping) ping.style.backgroundColor = userColor;
      if (radar) radar.style.borderColor = userColor;
      if (label) label.textContent = currentUser.role;
    }
  }, [currentUser, mapLoaded]);

  // 5. Render Other Active Responders
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const markerMap = responderMarkersRef.current;
    const otherResponders = activeUsers.filter((u) => u.id !== currentUser.id);
    const incomingIds = new Set(otherResponders.map((u) => u.id));

    // Cleanup absent responders
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
        el.className = "flex flex-col items-center group cursor-pointer";
        el.innerHTML = `
          <div class="w-3 h-3 rounded-full border border-white/75 shadow-md" style="background-color: ${color};"></div>
          <div class="px-1 py-0.2 rounded bg-black/80 text-[7px] font-mono text-gray-200 mt-0.5 border border-white/10 whitespace-nowrap">
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

  // 6. Render Marked Traffic Hotspots
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
        el.className = "flex flex-col items-center cursor-pointer";
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
      }
    });
  }, [hotspots, mapLoaded]);

  // 7. Dynamic Route Polyline when an incident is targeted
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (!activeIncidentTarget) {
      if (map.getSource("active-incident-corridor")) {
        (map.getSource("active-incident-corridor") as mapboxgl.GeoJSONSource).setData({
          type: "FeatureCollection",
          features: [],
        });
      }
      return;
    }

    const start: [number, number] = [currentUser.lng, currentUser.lat];
    const end: [number, number] = [activeIncidentTarget.lng, activeIncidentTarget.lat];
    const midX = (start[0] + end[0]) / 2;
    const midY = (start[1] + end[1]) / 2;

    // Direct route through congested grid (Amber #D97706)
    const directCoords: [number, number][] = [start, [midX + 0.002, midY - 0.002], end];

    // Clear safe bypass corridor (Tactical Green #2E856E)
    const bypassCoords: [number, number][] = [start, [midX - 0.005, midY + 0.004], [end[0] - 0.002, end[1] + 0.002], end];

    const routeGeoJson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { type: "DIRECT_CONGESTED", color: "#D97706" },
          geometry: { type: "LineString", coordinates: directCoords },
        },
        {
          type: "Feature",
          properties: { type: "TACTICAL_BYPASS", color: "#2E856E" },
          geometry: { type: "LineString", coordinates: bypassCoords },
        },
      ],
    };

    if (!map.getSource("active-incident-corridor")) {
      map.addSource("active-incident-corridor", {
        type: "geojson",
        data: routeGeoJson,
      });

      map.addLayer({
        id: "active-incident-bypass",
        type: "line",
        source: "active-incident-corridor",
        filter: ["==", "type", "TACTICAL_BYPASS"],
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#2E856E", "line-width": 5, "line-opacity": 0.95 },
      });

      map.addLayer({
        id: "active-incident-direct",
        type: "line",
        source: "active-incident-corridor",
        filter: ["==", "type", "DIRECT_CONGESTED"],
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#D97706",
          "line-width": 3,
          "line-dasharray": [2, 2],
          "line-opacity": 0.8,
        },
      });
    } else {
      (map.getSource("active-incident-corridor") as mapboxgl.GeoJSONSource).setData(routeGeoJson);
    }
  }, [activeIncidentTarget, currentUser, mapLoaded]);

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

    // Initialize simulation markers if not present
    if (!simAmbMarkerRef.current) {
      const el = document.createElement("div");
      el.className = "flex flex-col items-center cursor-pointer";
      el.innerHTML = `
        <div class="w-7 h-7 rounded-full bg-[#2E856E]/20 border border-[#2E856E] flex items-center justify-center animate-pulse">
          <div class="w-3 h-3 rounded-full bg-[#2E856E] shadow-lg"></div>
        </div>
        <div class="px-1.5 py-0.5 rounded bg-black/85 text-[8px] font-mono text-emerald-300 border border-emerald-500/30 whitespace-nowrap mt-0.5">
          Amb-02 (AUTONOMOUS)
        </div>
      `;
      simAmbMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat(simAmbCoords)
        .addTo(map);
    }

    if (!simPoliceMarkerRef.current) {
      const el = document.createElement("div");
      el.className = "flex flex-col items-center cursor-pointer";
      el.innerHTML = `
        <div class="w-7 h-7 rounded-full bg-[#2563EB]/20 border border-[#2563EB] flex items-center justify-center animate-pulse">
          <div class="w-3 h-3 rounded-full bg-[#2563EB] shadow-lg"></div>
        </div>
        <div class="px-1.5 py-0.5 rounded bg-black/85 text-[8px] font-mono text-blue-300 border border-blue-500/30 whitespace-nowrap mt-0.5">
          Police Patrol 02
        </div>
      `;
      simPoliceMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat(simPoliceCoords)
        .addTo(map);
    }

    // Step positions along preset waypoints
    const ambWaypoints: [number, number][] = [
      [78.4720, 17.3910],
      [78.4760, 17.3940],
      [78.4810, 17.3980],
      [78.4860, 17.4040],
      [78.4910, 17.4100],
      [78.4840, 17.4020],
    ];

    const policeWaypoints: [number, number][] = [
      [78.4950, 17.3820],
      [78.4900, 17.3860],
      [78.4840, 17.3880],
      [78.4790, 17.3850],
      [78.4850, 17.3810],
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

  // Update Route visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const showRoute3 = selectedAction === "OPTION_B" || selectedAction === "ROUTE_3";
    const showRoute1 = selectedAction === "OPTION_A" || selectedAction === "ROUTE_A";

    if (map.getLayer("route-3-casing")) {
      map.setLayoutProperty("route-3-casing", "visibility", showRoute3 ? "visible" : "none");
    }
    if (map.getLayer("route-3-line")) {
      map.setLayoutProperty("route-3-line", "visibility", showRoute3 ? "visible" : "none");
    }
    if (map.getLayer("route-1-line")) {
      map.setLayoutProperty("route-1-line", "visibility", showRoute1 ? "visible" : "none");
    }
  }, [selectedAction, mapLoaded]);

  return (
    <div className="fixed inset-0 w-screen h-screen z-0 overflow-hidden bg-[#0D1117]">
      {/* Mapbox GL Canvas Container */}
      <div
        ref={mapContainerRef}
        className="w-full h-full relative"
        style={{ width: "100vw", height: "100vh" }}
      />

      {/* Crosshair indicator banner when Pin Drop or Hotspot mode is active */}
      {(isPinDropMode || isHotspotMode) && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="bg-black/85 backdrop-blur-md border border-amber-500/50 text-amber-400 font-mono text-xs px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 animate-bounce">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>{isPinDropMode ? "TAP ANYWHERE ON MAP TO SET HAZARD LOCATION" : "TAP TO MARK TRAFFIC HOTSPOT"}</span>
          </div>
        </div>
      )}
    </div>
  );
}
