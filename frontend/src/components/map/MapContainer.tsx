"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { AlertTriangle, Sliders, Navigation, ShieldCheck, Layers, Eye } from "lucide-react";

const HYDERABAD_CENTER: [number, number] = [78.4867, 17.3850];

// Sector 04: Fire Hazard Polygon
const SECTOR_04_FIRE_GEOJSON: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "Sector 04: Active Fire Hazard", severity: "CRITICAL" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [78.4810, 17.3880],
            [78.4880, 17.3880],
            [78.4880, 17.3940],
            [78.4810, 17.3940],
            [78.4810, 17.3880],
          ],
        ],
      },
    },
  ],
};

// Sector 07 & 09: Flood & Gridlock Hazard Polygons
const FLOOD_WATER_GEOJSON: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "Sector 07: Flood Surge Zone", base_height: 3.5 },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [78.4720, 17.3810],
            [78.4790, 17.3810],
            [78.4790, 17.3870],
            [78.4720, 17.3870],
            [78.4720, 17.3810],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Sector 09: Arterial Inundation", base_height: 2.8 },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [78.4780, 17.3970],
            [78.4850, 17.3970],
            [78.4850, 17.4030],
            [78.4780, 17.4030],
            [78.4780, 17.3970],
          ],
        ],
      },
    },
  ],
};

// Navigation Routes
// Route 3 (Option B: Bypass to H2 in Tactical Green #2E856E)
const ROUTE_3_BYPASS_GEOJSON: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { id: "ROUTE_3", name: "Route 3: Sector 11 Safe Corridor Bypass to H2", color: "#2E856E" },
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

// Route 1 (Option A: Direct through Sector 07/09 bottleneck in Amber #D97706)
const ROUTE_1_DIRECT_GEOJSON: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { id: "ROUTE_1", name: "Route 1: Direct Arterial to H1", color: "#D97706" },
      geometry: {
        type: "LineString",
        coordinates: [
          [78.4821, 17.3872],
          [78.4795, 17.3845],
          [78.4765, 17.3820],
          [78.4745, 17.3795],
          [78.4735, 17.3785],
        ],
      },
    },
  ],
};

// Route 2 (Option C: Staged Hold)
const ROUTE_2_HOLD_GEOJSON: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { id: "ROUTE_2", name: "Route 2: Staged Hold Corridor", color: "#8B949E" },
      geometry: {
        type: "LineString",
        coordinates: [
          [78.4821, 17.3872],
          [78.4835, 17.3890],
        ],
      },
    },
  ],
};

// Hospitals
const HOSPITALS = [
  { id: "H1", name: "Osmania General", occupancy: 88, coords: [78.4735, 17.3785] as [number, number], status: "OVERLOADED" },
  { id: "H2", name: "Gandhi Hospital", occupancy: 54, coords: [78.5034, 17.4243] as [number, number], status: "NOMINAL" },
  { id: "H3", name: "NIMS Hospital", occupancy: 41, coords: [78.4526, 17.4223] as [number, number], status: "OPTIMAL" },
];

interface MapContainerProps {
  selectedAction?: string;
  sliderSeverity?: number;
  onSliderChange?: (val: number) => void;
  isDispatched?: boolean;
  isFireDispatched?: boolean;
  obstacleMarker?: {
    id: string;
    title: string;
    type: string;
    coordinates: [number, number];
    estimated_delay: number;
    summary: string;
    severity_score?: number;
  } | null;
}

export default function MapContainer({
  selectedAction = "OPTION_B",
  sliderSeverity = 60,
  onSliderChange,
  isDispatched = false,
  isFireDispatched = false,
  obstacleMarker = null,
}: MapContainerProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const ambMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const feMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const obstacleMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const [viewMode, setViewMode] = useState<"TACTICAL" | "3D">("TACTICAL");
  const [tokenMissing, setTokenMissing] = useState<boolean>(false);
  const [mapLoaded, setMapLoaded] = useState<boolean>(false);

  // Synchronize 3D flood extrusion height
  const updateFloodHeight = useCallback((severity: number) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    // Height scales smoothly: at 0% = 0.5m, 60% = 3.5m, 90% = 7.2m, 100% = 8.5m
    const height = Math.max(0.5, (severity / 100) * 8.5);

    if (map.getLayer("3d-flood-water")) {
      map.setPaintProperty("3d-flood-water", "fill-extrusion-height", height);
      map.setPaintProperty("3d-flood-water", "fill-extrusion-opacity", 0.45 + (severity / 100) * 0.35);
    }
  }, []);

  // Synchronize route ribbons based on active candidate action
  const updateRouteLayers = useCallback((action: string) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    // Visibility toggles
    const showRoute3 = action === "OPTION_B" || action === "ROUTE_3";
    const showRoute1 = action === "OPTION_A" || action === "ROUTE_A";
    const showRoute2 = action === "OPTION_C" || action === "DELAY_10";

    if (map.getLayer("route-3-casing")) map.setLayoutProperty("route-3-casing", "visibility", showRoute3 ? "visible" : "none");
    if (map.getLayer("route-3-line")) map.setLayoutProperty("route-3-line", "visibility", showRoute3 ? "visible" : "none");

    if (map.getLayer("route-1-line")) map.setLayoutProperty("route-1-line", "visibility", showRoute1 ? "visible" : "none");
    if (map.getLayer("route-2-line")) map.setLayoutProperty("route-2-line", "visibility", showRoute2 ? "visible" : "none");
  }, []);

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
      zoom: 15.2,
      pitch: 60,
      bearing: -17,
      antialias: true,
    });

    mapRef.current = map;

    map.on("load", () => {
      setMapLoaded(true);

      // 1. Add 3D Building Extrusions (matte slate #252A36)
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
              "fill-extrusion-color": "#252A36",
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
              "fill-extrusion-opacity": 0.85,
            },
          },
          labelLayerId
        );
      }

      // 2. Sector 04: Fire boundary in matte crimson (#C53030, 0.4 opacity)
      map.addSource("sector-04-fire", {
        type: "geojson",
        data: SECTOR_04_FIRE_GEOJSON,
      });

      map.addLayer({
        id: "sector-04-fill",
        type: "fill",
        source: "sector-04-fire",
        paint: {
          "fill-color": "#C53030",
          "fill-opacity": 0.4,
        },
      });

      map.addLayer({
        id: "sector-04-line",
        type: "line",
        source: "sector-04-fire",
        paint: {
          "line-color": "#C53030",
          "line-width": 2,
        },
      });

      // 3. 3D Flood Inundation Layer (layer id: '3d-flood-water')
      map.addSource("flood-water-source", {
        type: "geojson",
        data: FLOOD_WATER_GEOJSON,
      });

      map.addLayer({
        id: "3d-flood-water",
        type: "fill-extrusion",
        source: "flood-water-source",
        paint: {
          "fill-extrusion-color": "#1D4E89",
          "fill-extrusion-height": (sliderSeverity / 100) * 8.5,
          "fill-extrusion-base": 0,
          "fill-extrusion-opacity": 0.6,
        },
      });

      map.addLayer({
        id: "3d-flood-water-line",
        type: "line",
        source: "flood-water-source",
        paint: {
          "line-color": "#2E856E",
          "line-width": 1.5,
        },
      });

      // 4. Route 3 (Option B Bypass) Navigation Ribbon
      map.addSource("route-3-source", {
        type: "geojson",
        data: ROUTE_3_BYPASS_GEOJSON,
      });

      // Outer casing for high-contrast ribbon visibility
      map.addLayer({
        id: "route-3-casing",
        type: "line",
        source: "route-3-source",
        layout: {
          "line-cap": "round",
          "line-join": "round",
          visibility: "visible",
        },
        paint: {
          "line-color": "#11141A",
          "line-width": 8,
          "line-opacity": 0.9,
        },
      });

      // Inner tactical green ribbon (#2E856E)
      map.addLayer({
        id: "route-3-line",
        type: "line",
        source: "route-3-source",
        layout: {
          "line-cap": "round",
          "line-join": "round",
          visibility: "visible",
        },
        paint: {
          "line-color": "#2E856E",
          "line-width": 5,
          "line-opacity": 0.95,
        },
      });

      // 5. Route 1 (Option A Direct Route)
      map.addSource("route-1-source", {
        type: "geojson",
        data: ROUTE_1_DIRECT_GEOJSON,
      });

      map.addLayer({
        id: "route-1-line",
        type: "line",
        source: "route-1-source",
        layout: {
          "line-cap": "round",
          "line-join": "round",
          visibility: "none",
        },
        paint: {
          "line-color": "#D97706",
          "line-width": 4,
          "line-dasharray": [2, 1],
        },
      });

      // 6. Route 2 (Option C Hold)
      map.addSource("route-2-source", {
        type: "geojson",
        data: ROUTE_2_HOLD_GEOJSON,
      });

      map.addLayer({
        id: "route-2-line",
        type: "line",
        source: "route-2-source",
        layout: {
          "line-cap": "round",
          "line-join": "round",
          visibility: "none",
        },
        paint: {
          "line-color": "#8B949E",
          "line-width": 3,
          "line-dasharray": [3, 2],
        },
      });

      // 7. Add Amb-01 Vehicle Marker (interactive and dynamic)
      const ambEl = document.createElement("div");
      ambEl.className = "cursor-pointer group flex flex-col items-center";
      ambEl.innerHTML = `
        <div id="amb-01-badge" class="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#161B22] border border-[#30363D] text-[#F0F6FC] shadow flex items-center gap-1">
          <span class="inline-block w-1.5 h-1.5 rounded-full bg-[#2E856E]"></span>
          <span>Amb-01 [TRANSIT]</span>
        </div>
        <div class="w-5 h-5 rounded-full flex items-center justify-center bg-[#1C2128] border border-[#30363D] mt-0.5 text-[#2E856E]">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
          </svg>
        </div>
      `;

      ambMarkerRef.current = new mapboxgl.Marker({ element: ambEl, anchor: "bottom" })
        .setLngLat([78.4821, 17.3872])
        .setPopup(
          new mapboxgl.Popup({ offset: 15, closeButton: false }).setHTML(
            `<div class="p-1 font-mono text-[11px] bg-[#161B22] text-[#F0F6FC]">
              <div class="font-bold">Amb-01 (ALS Mobile)</div>
              <div class="text-[#8B949E]">Status: <span class="text-[#2E856E]">EN ROUTE</span></div>
             </div>`
          )
        )
        .addTo(map);

      // Amb-02 Delayed Unit
      const amb02El = document.createElement("div");
      amb02El.className = "cursor-pointer group flex flex-col items-center";
      amb02El.innerHTML = `
        <div class="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#161B22] border border-[#30363D] text-[#F0F6FC] shadow flex items-center gap-1">
          <span class="inline-block w-1.5 h-1.5 rounded-full bg-[#D97706]"></span>
          Amb-02
        </div>
        <div class="w-5 h-5 rounded-full flex items-center justify-center bg-[#1C2128] border border-[#30363D] mt-0.5 text-[#D97706]">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
          </svg>
        </div>
      `;
      new mapboxgl.Marker({ element: amb02El, anchor: "bottom" })
        .setLngLat([78.4910, 17.3745])
        .addTo(map);

      // FE-01 Fire Engine Unit
      const feEl = document.createElement("div");
      feEl.className = "cursor-pointer group flex flex-col items-center";
      feEl.innerHTML = `
        <div id="fe-01-badge" class="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#161B22] border border-[#30363D] text-[#F0F6FC] shadow flex items-center gap-1">
          <span class="inline-block w-1.5 h-1.5 rounded-full bg-[#8B949E]"></span>
          <span>FE-01 [STANDBY]</span>
        </div>
        <div id="fe-01-icon" class="w-5 h-5 rounded-full flex items-center justify-center bg-[#1C2128] border border-[#30363D] mt-0.5 text-[#8B949E]">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
          </svg>
        </div>
      `;
      feMarkerRef.current = new mapboxgl.Marker({ element: feEl, anchor: "bottom" })
        .setLngLat([78.4615, 17.4102])
        .addTo(map);

      // 8. Add Hospital Nodes
      HOSPITALS.forEach((h) => {
        const occColor = h.occupancy > 80 ? "#C53030" : h.occupancy > 50 ? "#D97706" : "#2E856E";
        const el = document.createElement("div");
        el.className = "cursor-pointer group flex flex-col items-center";
        el.innerHTML = `
          <div class="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#1C2128] border border-[#30363D] text-[#F0F6FC] shadow flex items-center gap-1.5">
            <span class="text-white font-bold">${h.id}</span>
            <span class="text-[9px] text-[#8B949E]">${h.name}</span>
            <span class="px-1 py-0.2 rounded text-[9px] font-bold" style="background-color: ${occColor}25; color: ${occColor}; border: 1px solid ${occColor}40">${h.occupancy}%</span>
          </div>
          <div class="w-4 h-4 rounded-full flex items-center justify-center bg-[#11141A] border border-[#30363D] mt-0.5 text-white">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2v20M2 12h20"></path>
            </svg>
          </div>
        `;

        new mapboxgl.Marker({ element: el, anchor: "bottom" })
          .setLngLat(h.coords)
          .addTo(map);
      });

      // Initial route layout
      updateRouteLayers(selectedAction);
      updateFloodHeight(sliderSeverity);
    });

    return () => {
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update route ribbons whenever selectedAction changes
  useEffect(() => {
    if (mapLoaded) {
      updateRouteLayers(selectedAction);
    }
  }, [selectedAction, mapLoaded, updateRouteLayers]);

  // Update 3D flood extrusion height whenever sliderSeverity changes
  useEffect(() => {
    if (mapLoaded) {
      updateFloodHeight(sliderSeverity);
    }
  }, [sliderSeverity, mapLoaded, updateFloodHeight]);

  // Update Amb-01 vehicle marker when dispatched based on selectedAction
  useEffect(() => {
    if (!ambMarkerRef.current || !mapLoaded) return;

    const badge = document.getElementById("amb-01-badge");
    const isOptionA = selectedAction === "OPTION_A" || selectedAction === "ROUTE_A";
    const isOptionC = selectedAction === "OPTION_C" || selectedAction === "DELAY_10";

    if (isDispatched) {
      if (isOptionA) {
        ambMarkerRef.current.setLngLat([78.4735, 17.3785]);
        if (badge) {
          badge.innerHTML = `
            <span class="inline-block w-1.5 h-1.5 rounded-full bg-[#D97706] animate-ping"></span>
            <span class="text-[#D97706]">Amb-01 [EN ROUTE H1 OSMANIA]</span>
          `;
        }
      } else if (isOptionC) {
        ambMarkerRef.current.setLngLat([78.4821, 17.3872]);
        if (badge) {
          badge.innerHTML = `
            <span class="inline-block w-1.5 h-1.5 rounded-full bg-[#8B949E]"></span>
            <span class="text-[#8B949E]">Amb-01 [HOLDING STAGE 2]</span>
          `;
        }
      } else {
        ambMarkerRef.current.setLngLat([78.4910, 17.3980]);
        if (badge) {
          badge.innerHTML = `
            <span class="inline-block w-1.5 h-1.5 rounded-full bg-[#2E856E] animate-ping"></span>
            <span class="text-[#2E856E]">Amb-01 [EN ROUTE H2 GANDHI]</span>
          `;
        }
      }
    } else {
      ambMarkerRef.current.setLngLat([78.4821, 17.3872]);
      if (badge) {
        badge.innerHTML = `
          <span class="inline-block w-1.5 h-1.5 rounded-full bg-[#2E856E]"></span>
          <span>Amb-01 [TRANSIT]</span>
        `;
      }
    }
  }, [isDispatched, selectedAction, mapLoaded]);

  // Update FE-01 Fire Engine marker when dispatched to Sector 04
  useEffect(() => {
    if (!feMarkerRef.current || !mapLoaded) return;

    const badge = document.getElementById("fe-01-badge");
    const icon = document.getElementById("fe-01-icon");

    if (isFireDispatched) {
      feMarkerRef.current.setLngLat([78.4845, 17.3910]);
      if (badge) {
        badge.innerHTML = `
          <span class="inline-block w-1.5 h-1.5 rounded-full bg-[#E05252] animate-ping"></span>
          <span class="text-[#E05252]">FE-01 [ENGAGING SEC 04 FIRE]</span>
        `;
      }
      if (icon) {
        icon.className = "w-5 h-5 rounded-full flex items-center justify-center bg-[#1C2128] border border-[#E05252] mt-0.5 text-[#E05252] animate-pulse";
      }
    } else {
      feMarkerRef.current.setLngLat([78.4615, 17.4102]);
      if (badge) {
        badge.innerHTML = `
          <span class="inline-block w-1.5 h-1.5 rounded-full bg-[#8B949E]"></span>
          <span>FE-01 [STANDBY]</span>
        `;
      }
      if (icon) {
        icon.className = "w-5 h-5 rounded-full flex items-center justify-center bg-[#1C2128] border border-[#30363D] mt-0.5 text-[#8B949E]";
      }
    }
  }, [isFireDispatched, mapLoaded]);

  // Dynamically plot citizen-reported obstacle marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (obstacleMarkerRef.current) {
      obstacleMarkerRef.current.remove();
      obstacleMarkerRef.current = null;
    }

    if (obstacleMarker) {
      const el = document.createElement("div");
      el.className = "cursor-pointer group flex flex-col items-center animate-bounce";
      el.innerHTML = `
        <div class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#C53030] text-white border border-[#F0F6FC] shadow-lg flex items-center gap-1.5 ring-2 ring-[#C53030]/50">
          <span class="inline-block w-2 h-2 rounded-full bg-white animate-ping"></span>
          <span>CITIZEN OBSTACLE [MG ROAD]</span>
        </div>
        <div class="w-6 h-6 rounded-full flex items-center justify-center bg-[#11141A] border-2 border-[#C53030] mt-0.5 text-[#C53030] shadow-md">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        </div>
      `;

      obstacleMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: "bottom" })
        .setLngLat(obstacleMarker.coordinates)
        .setPopup(
          new mapboxgl.Popup({ offset: 20, closeButton: false }).setHTML(
            `<div class="p-2 font-mono text-[11px] bg-[#161B22] text-[#F0F6FC] border border-[#30363D] rounded">
              <div class="font-bold text-[#C53030] mb-0.5">${obstacleMarker.title}</div>
              <div class="text-[10px] text-[#8B949E] mb-1">Type: ${obstacleMarker.type} | Delay: +${obstacleMarker.estimated_delay}m</div>
              <div class="text-[10px] text-[#F0F6FC] leading-tight">${obstacleMarker.summary}</div>
             </div>`
          )
        )
        .addTo(map);

      // Smoothly pan camera slightly to show the obstacle and ambulance
      map.flyTo({
        center: [78.4800, 17.3850],
        zoom: 15.3,
        speed: 1.2,
      });
    }
  }, [obstacleMarker, mapLoaded]);

  // Calculate dynamic Option A transit for slider readout
  const optATransit = Math.round(22 + (sliderSeverity - 60) * 0.4);
  const optARisk = Math.min(100, Math.round(72 + (sliderSeverity - 60) * 0.533));

  if (viewMode === "TACTICAL" || tokenMissing || !mapLoaded) {
    // Linear geospatial projection helper for Hyderabad viewport
    const project = (lng: number, lat: number): [number, number] => {
      const minLng = 78.445;
      const maxLng = 78.515;
      const minLat = 17.368;
      const maxLat = 17.435;
      const x = ((lng - minLng) / (maxLng - minLng)) * 1000;
      const y = ((maxLat - lat) / (maxLat - minLat)) * 750;
      return [x, y];
    };

    const toSvgPoints = (coords: number[][]): string => {
      return coords.map(([lng, lat]) => project(lng, lat).join(",")).join(" ");
    };

    const isOptionB = selectedAction === "OPTION_B" || selectedAction === "ROUTE_3" || selectedAction === "ROUTE_C";
    const isOptionA = selectedAction === "OPTION_A" || selectedAction === "ROUTE_A" || selectedAction === "ROUTE_1";
    const isOptionC = selectedAction === "OPTION_C" || selectedAction === "DELAY_10" || selectedAction === "ROUTE_2";

    const ambCoords = isDispatched
      ? isOptionA
        ? project(78.4735, 17.3785)
        : isOptionC
        ? project(78.4821, 17.3872)
        : project(78.4910, 17.3980)
      : project(78.4821, 17.3872);

    return (
      <div className="relative w-full h-full bg-[#0D1117] overflow-hidden select-none">
        {/* Tactical 2D Geospatial Vector Canvas */}
        <svg
          viewBox="0 0 1000 750"
          className="w-full h-full object-cover"
          style={{ background: "radial-gradient(ellipse at center, #161B22 0%, #090D13 100%)" }}
        >
          <defs>
            {/* Grid Pattern */}
            <pattern id="tacticalGrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#21262D" strokeWidth="0.8" />
              <circle cx="0" cy="0" r="1.5" fill="#30363D" />
            </pattern>
            {/* Diagonal Hazard Pattern */}
            <pattern id="hazardStripe" width="12" height="12" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="12" stroke="#D97706" strokeWidth="3" opacity="0.4" />
            </pattern>
            {/* Flood Wave Pattern */}
            <pattern id="floodWater" width="16" height="16" patternUnits="userSpaceOnUse">
              <circle cx="8" cy="8" r="4" fill="#1D4E89" opacity="0.3" />
            </pattern>
            {/* Glow Filter */}
            <filter id="glowGreen" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glowAmber" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background Coordinates Grid */}
          <rect width="1000" height="750" fill="url(#tacticalGrid)" />

          {/* Concentric Radar Rings from Hyderabad Center */}
          <circle cx="600" cy="570" r="120" fill="none" stroke="#21262D" strokeDasharray="3,4" strokeWidth="1" />
          <circle cx="600" cy="570" r="240" fill="none" stroke="#21262D" strokeDasharray="3,4" strokeWidth="1" />
          <circle cx="600" cy="570" r="360" fill="none" stroke="#21262D" strokeDasharray="3,4" strokeWidth="1" />

          {/* Sector 04: Active Fire Hazard Polygon */}
          <polygon
            points={toSvgPoints((SECTOR_04_FIRE_GEOJSON.features[0].geometry as GeoJSON.Polygon).coordinates[0])}
            fill="#C5303025"
            stroke="#C53030"
            strokeWidth="1.5"
            strokeDasharray="4,2"
          />
          <text
            x={project(78.4845, 17.3910)[0]}
            y={project(78.4845, 17.3910)[1]}
            fill="#E05252"
            fontSize="10"
            fontFamily="monospace"
            fontWeight="bold"
            textAnchor="middle"
          >
            SEC 04 [FIRE HAZARD]
          </text>

          {/* Sector 07: Flood Surge Zone */}
          <polygon
            points={toSvgPoints((FLOOD_WATER_GEOJSON.features[0].geometry as GeoJSON.Polygon).coordinates[0])}
            fill="#1D4E8940"
            stroke="#388BFD"
            strokeWidth="1.5"
            opacity={0.5 + (sliderSeverity / 100) * 0.45}
          />
          <text
            x={project(78.4755, 17.3840)[0]}
            y={project(78.4755, 17.3840)[1]}
            fill="#58A6FF"
            fontSize="10"
            fontFamily="monospace"
            fontWeight="bold"
            textAnchor="middle"
          >
            SEC 07 [FLOOD SURGE {(0.5 + (sliderSeverity / 100) * 8.0).toFixed(1)}m]
          </text>

          {/* Sector 09: Arterial Inundation / Gridlock Bottleneck */}
          <polygon
            points={toSvgPoints((FLOOD_WATER_GEOJSON.features[1].geometry as GeoJSON.Polygon).coordinates[0])}
            fill="url(#hazardStripe)"
            stroke="#D97706"
            strokeWidth="1.8"
            opacity={0.6 + (sliderSeverity / 100) * 0.4}
          />
          <text
            x={project(78.4815, 17.4000)[0]}
            y={project(78.4815, 17.4000)[1]}
            fill="#F59E0B"
            fontSize="10"
            fontFamily="monospace"
            fontWeight="bold"
            textAnchor="middle"
          >
            SEC 09 [GRIDLOCK BOTTLENECK]
          </text>

          {/* Sector 11 Safe Corridor Indicator (Bypass Path) */}
          <rect
            x={project(78.4900, 17.4120)[0] - 40}
            y={project(78.4900, 17.4120)[1] - 15}
            width="170"
            height="26"
            rx="4"
            fill="#0D281E90"
            stroke="#2E856E"
            strokeWidth="1"
          />
          <text
            x={project(78.4900, 17.4120)[0] + 45}
            y={project(78.4900, 17.4120)[1] + 2}
            fill="#3FB950"
            fontSize="10"
            fontFamily="monospace"
            fontWeight="bold"
            textAnchor="middle"
          >
            SEC 11 // CLEAR CORRIDOR
          </text>

          {/* Navigation Route Lines */}
          {/* Route 2 (Hold Staging) */}
          <polyline
            points={toSvgPoints((ROUTE_2_HOLD_GEOJSON.features[0].geometry as GeoJSON.LineString).coordinates)}
            fill="none"
            stroke="#8B949E"
            strokeWidth={isOptionC ? "5" : "1.5"}
            strokeDasharray="4,4"
            opacity={isOptionC ? 1 : 0.25}
          />

          {/* Route 1: Direct to Osmania H1 (Through bottleneck) */}
          <polyline
            points={toSvgPoints((ROUTE_1_DIRECT_GEOJSON.features[0].geometry as GeoJSON.LineString).coordinates)}
            fill="none"
            stroke="#D97706"
            strokeWidth={isOptionA ? "6" : "1.5"}
            strokeDasharray={isOptionA ? "none" : "5,4"}
            filter={isOptionA ? "url(#glowAmber)" : undefined}
            opacity={isOptionA ? 1 : 0.25}
          />

          {/* Route 3: Sector 11 Bypass to Gandhi H2 (Recommended) */}
          <polyline
            points={toSvgPoints((ROUTE_3_BYPASS_GEOJSON.features[0].geometry as GeoJSON.LineString).coordinates)}
            fill="none"
            stroke="#2E856E"
            strokeWidth={isOptionB ? "6" : "1.5"}
            filter={isOptionB ? "url(#glowGreen)" : undefined}
            opacity={isOptionB ? 1 : 0.25}
          />

          {/* Hospital Markers */}
          {HOSPITALS.map((hosp) => {
            const [hx, hy] = project(hosp.coords[0], hosp.coords[1]);
            const isH1 = hosp.id === "H1";
            const isH2 = hosp.id === "H2";
            const color = isH1 ? "#C53030" : isH2 ? "#2E856E" : "#58A6FF";

            return (
              <g key={hosp.id} transform={`translate(${hx}, ${hy})`}>
                <circle r="12" fill="#161B22" stroke={color} strokeWidth="2.5" />
                <path d="M-5 0 L5 0 M0 -5 L0 5" stroke={color} strokeWidth="2.5" />
                {/* Hospital Badge Tag */}
                <rect
                  x="-70"
                  y={isH1 ? "18" : "-36"}
                  width="140"
                  height="22"
                  rx="3"
                  fill="#11141AEE"
                  stroke={color}
                  strokeWidth="1"
                />
                <text
                  x="0"
                  y={isH1 ? "33" : "-22"}
                  fill="#F0F6FC"
                  fontSize="9.5"
                  fontFamily="monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {hosp.name} [{hosp.occupancy}%]
                </text>
              </g>
            );
          })}

          {/* Ambulance Amb-01 Unit Marker */}
          <g transform={`translate(${ambCoords[0]}, ${ambCoords[1]})`}>
            {/* Animated Pulse Rings */}
            <circle
              r="16"
              fill="none"
              stroke={isOptionA ? "#D97706" : isOptionC ? "#8B949E" : "#2E856E"}
              strokeWidth="1.5"
              opacity="0.6"
            >
              <animate attributeName="r" values="8;24;8" dur="2.4s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.8;0.1;0.8" dur="2.4s" repeatCount="indefinite" />
            </circle>
            <circle
              r="9"
              fill={isOptionA ? "#D97706" : isOptionC ? "#8B949E" : "#2E856E"}
              stroke="#FFFFFF"
              strokeWidth="2"
            />
            {/* Amb-01 Badge */}
            <rect
              x="-75"
              y="-32"
              width="150"
              height="20"
              rx="3"
              fill="#11141AE0"
              stroke={isOptionA ? "#D97706" : isOptionC ? "#8B949E" : "#2E856E"}
              strokeWidth="1"
            />
            <text
              x="0"
              y="-18"
              fill={isOptionA ? "#F59E0B" : isOptionC ? "#8B949E" : "#3FB950"}
              fontSize="9"
              fontFamily="monospace"
              fontWeight="bold"
              textAnchor="middle"
            >
              {isDispatched
                ? isOptionA
                  ? "Amb-01 [EN ROUTE H1]"
                  : isOptionC
                  ? "Amb-01 [HOLDING STAGE 2]"
                  : "Amb-01 [EN ROUTE H2]"
                : "Amb-01 [TRANSIT]"}
            </text>
          </g>

          {/* Fire Engine FE-01 Unit Marker */}
          {(() => {
            const feCoords = isFireDispatched
              ? project(78.4845, 17.3910)
              : project(78.4615, 17.4102);
            return (
              <g transform={`translate(${feCoords[0]}, ${feCoords[1]})`}>
                {isFireDispatched && (
                  <circle r="16" fill="none" stroke="#E05252" strokeWidth="1.5" opacity="0.7">
                    <animate attributeName="r" values="8;24;8" dur="1.6s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.9;0.1;0.9" dur="1.6s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle
                  r="9"
                  fill={isFireDispatched ? "#E05252" : "#484F58"}
                  stroke="#FFFFFF"
                  strokeWidth="2"
                />
                <rect
                  x="-75"
                  y="-32"
                  width="150"
                  height="20"
                  rx="3"
                  fill="#11141AE0"
                  stroke={isFireDispatched ? "#E05252" : "#30363D"}
                  strokeWidth="1"
                />
                <text
                  x="0"
                  y="-18"
                  fill={isFireDispatched ? "#FF7B72" : "#8B949E"}
                  fontSize="9"
                  fontFamily="monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {isFireDispatched ? "FE-01 [ENGAGING FIRE SEC 04]" : "FE-01 [STANDBY]"}
                </text>
              </g>
            );
          })()}

          {/* Citizen Reported Obstacle Marker (if active) */}
          {obstacleMarker && (() => {
            const [ox, oy] = project(obstacleMarker.coordinates[0], obstacleMarker.coordinates[1]);
            return (
              <g transform={`translate(${ox}, ${oy})`}>
                <circle r="18" fill="none" stroke="#C53030" strokeWidth="2" opacity="0.8">
                  <animate attributeName="r" values="10;26;10" dur="1.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="1;0.2;1" dur="1.5s" repeatCount="indefinite" />
                </circle>
                <circle r="10" fill="#C53030" stroke="#FFFFFF" strokeWidth="2" />
                <path d="M-4 3 L0 -5 L4 3 Z" fill="#FFFFFF" />
                {/* Obstacle Label */}
                <rect
                  x="-85"
                  y="16"
                  width="170"
                  height="22"
                  rx="3"
                  fill="#11141AE0"
                  stroke="#C53030"
                  strokeWidth="1"
                />
                <text
                  x="0"
                  y="31"
                  fill="#FF7B72"
                  fontSize="9"
                  fontFamily="monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  OBSTACLE: {obstacleMarker.title || "MG ROAD"}
                </text>
              </g>
            );
          })()}

          {/* Map Compass Rose */}
          <g transform="translate(45, 690)">
            <circle r="22" fill="#161B22CC" stroke="#30363D" strokeWidth="1" />
            <path d="M0 -16 L4 -4 L0 0 L-4 -4 Z" fill="#2E856E" />
            <path d="M0 16 L4 4 L0 0 L-4 4 Z" fill="#8B949E" />
            <text x="0" y="-18" fill="#F0F6FC" fontSize="8" fontFamily="monospace" fontWeight="bold" textAnchor="middle">N</text>
            <text x="0" y="27" fill="#8B949E" fontSize="7" fontFamily="monospace" textAnchor="middle">HYDERABAD</text>
          </g>
        </svg>

        {/* Top Mode Pill Banner & View Switcher */}
        <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 bg-[#161B22]/95 backdrop-blur border border-[#30363D] p-1 rounded font-mono text-[10px] shadow-md">
          <button
            onClick={() => setViewMode("TACTICAL")}
            className={`px-2 py-0.5 rounded font-bold transition-all flex items-center gap-1 ${
              viewMode === "TACTICAL"
                ? "bg-tactical-green text-white shadow-sm"
                : "text-tactical-muted hover:text-white"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span>TACTICAL DIGITAL TWIN</span>
          </button>
          <button
            onClick={() => {
              setViewMode("3D");
              if (mapRef.current) mapRef.current.resize();
            }}
            className={`px-2 py-0.5 rounded font-bold transition-all flex items-center gap-1 ${
              viewMode === "3D"
                ? "bg-[#388BFD] text-white shadow-sm"
                : "text-tactical-muted hover:text-white"
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>3D MAPBOX</span>
          </button>
        </div>

        {/* Floating Tactical "What-If" Junction Congestion / Flood Slider */}
        <div className="absolute top-3 right-3 z-10 w-72 bg-[#161B22]/95 backdrop-blur border border-[#30363D] p-3 rounded font-mono text-[11px] shadow-lg select-none">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 text-tactical-text font-bold text-[11px]">
              <Sliders className="w-3.5 h-3.5 text-tactical-amber" />
              <span>WHAT-IF SIMULATOR</span>
            </div>
            <span
              className="px-1.5 py-0.2 rounded text-[9px] font-bold border"
              style={{
                backgroundColor: sliderSeverity > 75 ? "#C5303020" : sliderSeverity > 40 ? "#D9770620" : "#2E856E20",
                borderColor: sliderSeverity > 75 ? "#C5303050" : sliderSeverity > 40 ? "#D9770650" : "#2E856E50",
                color: sliderSeverity > 75 ? "#C53030" : sliderSeverity > 40 ? "#D97706" : "#2E856E",
              }}
            >
              {sliderSeverity}% {sliderSeverity > 75 ? "CRITICAL" : sliderSeverity > 40 ? "CONGESTED" : "CLEAR"}
            </span>
          </div>

          <div className="text-[10px] text-tactical-muted mb-2">
            Sector 09 Gridlock / Flood Severity
          </div>

          {/* Tactical Range Slider */}
          <input
            type="range"
            min="0"
            max="100"
            value={sliderSeverity}
            onChange={(e) => {
              const val = Number(e.target.value);
              onSliderChange?.(val);
            }}
            className="w-full h-1.5 bg-tactical-bg rounded-lg appearance-none cursor-pointer accent-tactical-amber mb-2.5"
          />

          {/* Real-time Dynamic Impact Readout */}
          <div className="space-y-1 text-[10px] p-2 bg-tactical-bg rounded border border-tactical-border">
            <div className="flex justify-between items-center text-tactical-muted">
              <span>Flood / Congestion Depth:</span>
              <span className="text-tactical-text font-bold">{((sliderSeverity / 100) * 8.5).toFixed(1)}m</span>
            </div>
            <div className="flex justify-between items-center text-tactical-muted">
              <span>Option A Transit Delay:</span>
              <span className={sliderSeverity >= 80 ? "text-tactical-crimson font-bold" : "text-tactical-amber font-bold"}>
                {optATransit}m (Risk: {optARisk})
              </span>
            </div>
            <div className="flex justify-between items-center text-tactical-muted pt-1 border-t border-tactical-border">
              <span>Option B Bypass:</span>
              <span className="text-tactical-green font-bold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                13m (Risk: 34) UNCHANGED
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Top Mode Pill Banner & View Switcher */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 bg-[#161B22]/95 backdrop-blur border border-[#30363D] p-1 rounded font-mono text-[10px] shadow-md">
        <button
          onClick={() => setViewMode("TACTICAL")}
          className="px-2 py-0.5 rounded font-bold transition-all flex items-center gap-1 text-tactical-muted hover:text-white"
        >
          <span>TACTICAL DIGITAL TWIN</span>
        </button>
        <button
          onClick={() => {
            setViewMode("3D");
            if (mapRef.current) mapRef.current.resize();
          }}
          className="px-2 py-0.5 rounded font-bold transition-all flex items-center gap-1 bg-[#388BFD] text-white shadow-sm"
        >
          <Layers className="w-3 h-3" />
          <span>3D MAPBOX</span>
        </button>
      </div>

      {/* Floating Tactical "What-If" Junction Congestion / Flood Slider */}
      <div className="absolute top-3 right-3 z-10 w-72 bg-[#161B22]/95 backdrop-blur border border-[#30363D] p-3 rounded font-mono text-[11px] shadow-lg select-none">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5 text-tactical-text font-bold text-[11px]">
            <Sliders className="w-3.5 h-3.5 text-tactical-amber" />
            <span>WHAT-IF SIMULATOR</span>
          </div>
          <span
            className="px-1.5 py-0.2 rounded text-[9px] font-bold border"
            style={{
              backgroundColor: sliderSeverity > 75 ? "#C5303020" : sliderSeverity > 40 ? "#D9770620" : "#2E856E20",
              borderColor: sliderSeverity > 75 ? "#C5303050" : sliderSeverity > 40 ? "#D9770650" : "#2E856E50",
              color: sliderSeverity > 75 ? "#C53030" : sliderSeverity > 40 ? "#D97706" : "#2E856E",
            }}
          >
            {sliderSeverity}% {sliderSeverity > 75 ? "CRITICAL" : sliderSeverity > 40 ? "CONGESTED" : "CLEAR"}
          </span>
        </div>

        <div className="text-[10px] text-tactical-muted mb-2">
          Sector 09 Gridlock / Flood Severity
        </div>

        {/* Tactical Range Slider */}
        <input
          type="range"
          min="0"
          max="100"
          value={sliderSeverity}
          onChange={(e) => {
            const val = Number(e.target.value);
            onSliderChange?.(val);
          }}
          className="w-full h-1.5 bg-tactical-bg rounded-lg appearance-none cursor-pointer accent-tactical-amber mb-2.5"
        />

        {/* Real-time Dynamic Impact Readout */}
        <div className="space-y-1 text-[10px] p-2 bg-tactical-bg rounded border border-tactical-border">
          <div className="flex justify-between items-center text-tactical-muted">
            <span>3D Flood Extrusion:</span>
            <span className="text-tactical-text font-bold">{((sliderSeverity / 100) * 8.5).toFixed(1)}m</span>
          </div>
          <div className="flex justify-between items-center text-tactical-muted">
            <span>Option A Transit Delay:</span>
            <span className={sliderSeverity >= 80 ? "text-tactical-crimson font-bold" : "text-tactical-amber font-bold"}>
              {optATransit}m (Risk: {optARisk})
            </span>
          </div>
          <div className="flex justify-between items-center text-tactical-muted pt-1 border-t border-tactical-border">
            <span>Option B Bypass:</span>
            <span className="text-tactical-green font-bold flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              13m (Risk: 34) UNCHANGED
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
