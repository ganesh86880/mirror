"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import { AlertTriangle, Sliders, Navigation, ShieldCheck } from "lucide-react";

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
  obstacleMarker = null,
}: MapContainerProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const ambMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const obstacleMarkerRef = useRef<mapboxgl.Marker | null>(null);
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

      // Other Fleet Units (Amb-02, FE-01)
      const otherVehicles = [
        { id: "Amb-02", type: "Ambulance", status: "Delayed", coords: [78.4910, 17.3745] as [number, number], color: "#D97706" },
        { id: "FE-01", type: "Fire Engine", status: "Standby", coords: [78.4615, 17.4102] as [number, number], color: "#8B949E" },
      ];

      otherVehicles.forEach((v) => {
        const el = document.createElement("div");
        el.className = "cursor-pointer group flex flex-col items-center";
        el.innerHTML = `
          <div class="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#161B22] border border-[#30363D] text-[#F0F6FC] shadow flex items-center gap-1">
            <span class="inline-block w-1.5 h-1.5 rounded-full" style="background-color: ${v.color}"></span>
            ${v.id}
          </div>
          <div class="w-5 h-5 rounded-full flex items-center justify-center bg-[#1C2128] border border-[#30363D] mt-0.5" style="color: ${v.color}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
            </svg>
          </div>
        `;

        new mapboxgl.Marker({ element: el, anchor: "bottom" })
          .setLngLat(v.coords)
          .addTo(map);
      });

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

  // Update Amb-01 vehicle marker when dispatched
  useEffect(() => {
    if (!ambMarkerRef.current || !mapLoaded) return;

    const badge = document.getElementById("amb-01-badge");
    if (isDispatched) {
      // Vehicle relocates along Route 3 Bypass towards H2
      ambMarkerRef.current.setLngLat([78.4910, 17.3980]);
      if (badge) {
        badge.innerHTML = `
          <span class="inline-block w-1.5 h-1.5 rounded-full bg-[#2E856E] animate-ping"></span>
          <span class="text-[#2E856E]">Amb-01 [DISPATCHED // EN ROUTE H2]</span>
        `;
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
  }, [isDispatched, mapLoaded]);

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

  if (tokenMissing) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-tactical-bg p-8 border border-tactical-border">
        <AlertTriangle className="w-12 h-12 text-tactical-amber mb-3" />
        <h3 className="text-tactical-text font-mono font-bold text-sm uppercase tracking-wider mb-1">
          Mapbox Public Token Required
        </h3>
        <p className="text-tactical-muted text-xs text-center max-w-md font-mono">
          Please paste your Mapbox Public Token into <code className="text-tactical-amber bg-tactical-panel px-1 py-0.5 rounded">/frontend/.env.local</code> as <code className="text-tactical-text bg-tactical-panel px-1 py-0.5 rounded">NEXT_PUBLIC_MAPBOX_TOKEN</code> so the 3D map can initialize.
        </p>
      </div>
    );
  }

  // Calculate dynamic Option A transit for slider readout
  const optATransit = Math.round(22 + (sliderSeverity - 60) * 0.4);
  const optARisk = Math.min(100, Math.round(72 + (sliderSeverity - 60) * 0.533));

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full" />

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
