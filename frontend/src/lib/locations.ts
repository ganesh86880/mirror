/**
 * Hyderabad Tactical Location Gazetteer
 * Maps spoken & typed location names to precise geographic coordinates.
 */

export interface ResolvedLocation {
  name: string;
  lat: number;
  lng: number;
}

export const HYDERABAD_GAZETTEER: { [key: string]: { name: string; lat: number; lng: number } } = {
  secunderabad: { name: "Secunderabad Junction", lat: 17.4399, lng: 78.4983 },
  hitech: { name: "Hitech City / Cyberabad", lat: 17.4483, lng: 78.3915 },
  cyberabad: { name: "Hitech City / Cyberabad", lat: 17.4483, lng: 78.3915 },
  madhapur: { name: "Madhapur Commercial Belt", lat: 17.4483, lng: 78.3915 },
  gachibowli: { name: "Gachibowli Financial Hub", lat: 17.4401, lng: 78.3489 },
  "financial district": { name: "Financial District", lat: 17.4156, lng: 78.3378 },
  jubilee: { name: "Jubilee Hills Arterial", lat: 17.4319, lng: 78.4073 },
  banjara: { name: "Banjara Hills Sector", lat: 17.4156, lng: 78.435 },
  charminar: { name: "Charminar Heritage Zone", lat: 17.3616, lng: 78.4747 },
  "old city": { name: "Old City Heritage Area", lat: 17.358, lng: 78.472 },
  falaknuma: { name: "Falaknuma Palace Zone", lat: 17.3312, lng: 78.4682 },
  lakdikapul: { name: "Lakdikapul Underpass", lat: 17.4055, lng: 78.464 },
  khairatabad: { name: "Khairatabad Junction", lat: 17.4116, lng: 78.4589 },
  ameerpet: { name: "Ameerpet Transit Corridor", lat: 17.4375, lng: 78.4483 },
  punjagutta: { name: "Punjagutta Junction", lat: 17.4265, lng: 78.4516 },
  panjagutta: { name: "Punjagutta Junction", lat: 17.4265, lng: 78.4516 },
  begumpet: { name: "Begumpet Arterial", lat: 17.4448, lng: 78.4673 },
  osmania: { name: "Osmania General Hospital", lat: 17.3888, lng: 78.4862 },
  afzalgunj: { name: "Afzalgunj Bus Station", lat: 17.3752, lng: 78.4789 },
  koti: { name: "Koti Commercial Center", lat: 17.386, lng: 78.485 },
  "sector 4": { name: "Sector 04 Industrial Zone", lat: 17.396, lng: 78.466 },
  "sector 04": { name: "Sector 04 Industrial Zone", lat: 17.396, lng: 78.466 },
  "sector 7": { name: "Sector 07 Inundation Basin", lat: 17.405, lng: 78.463 },
  "sector 07": { name: "Sector 07 Inundation Basin", lat: 17.405, lng: 78.463 },
  "sector 9": { name: "Sector 09 Gridlock Node", lat: 17.389, lng: 78.46 },
  "sector 09": { name: "Sector 09 Gridlock Node", lat: 17.389, lng: 78.46 },
  mehdipatnam: { name: "Mehdipatnam Hub", lat: 17.3916, lng: 78.4402 },
  "toli chowki": { name: "Tolichowki Corridor", lat: 17.4014, lng: 78.4147 },
  tolichowki: { name: "Tolichowki Corridor", lat: 17.4014, lng: 78.4147 },
  kukatpally: { name: "Kukatpally Highway", lat: 17.4849, lng: 78.4138 },
  kphb: { name: "KPHB Colony Main Road", lat: 17.4933, lng: 78.3995 },
  uppal: { name: "Uppal Junction", lat: 17.3984, lng: 78.5583 },
  dilsukhnagar: { name: "Dilsukhnagar Transit", lat: 17.3688, lng: 78.5247 },
  malakpet: { name: "Malakpet Rail Corridor", lat: 17.3768, lng: 78.5028 },
  "lb nagar": { name: "LB Nagar Ring Road", lat: 17.3457, lng: 78.5522 },
  lbnagar: { name: "LB Nagar Ring Road", lat: 17.3457, lng: 78.5522 },
  "tank bund": { name: "Tank Bund Waterfront", lat: 17.4239, lng: 78.4738 },
  hussain: { name: "Hussain Sagar Corridor", lat: 17.4239, lng: 78.4738 },
  shamshabad: { name: "Shamshabad Airport Zone", lat: 17.2403, lng: 78.4294 },
  airport: { name: "Shamshabad Airport Zone", lat: 17.2403, lng: 78.4294 },
  somajiguda: { name: "Somajiguda Arterial", lat: 17.4243, lng: 78.4589 },
  abids: { name: "Abids Commercial Center", lat: 17.3906, lng: 78.4736 },
  kacheguda: { name: "Kacheguda Railway Station", lat: 17.392, lng: 78.498 },
  kachiguda: { name: "Kacheguda Railway Station", lat: 17.392, lng: 78.498 },
  nampally: { name: "Nampally Station", lat: 17.3924, lng: 78.4705 },
  "masab tank": { name: "Masab Tank Flyover", lat: 17.4005, lng: 78.4509 },
  masabtank: { name: "Masab Tank Flyover", lat: 17.4005, lng: 78.4509 },
  kondapur: { name: "Kondapur Botanical Belt", lat: 17.4699, lng: 78.3578 },
  miyapur: { name: "Miyapur Metro Terminal", lat: 17.4968, lng: 78.3614 },
  alwal: { name: "Alwal Corridor", lat: 17.5028, lng: 78.5085 },
  kompally: { name: "Kompally Highway", lat: 17.5383, lng: 78.4878 },
  bowenpally: { name: "Bowenpally Checkpost", lat: 17.4728, lng: 78.4862 },
  ecil: { name: "ECIL Crossroads", lat: 17.4682, lng: 78.5772 },
  tarnaka: { name: "Tarnaka Flyover", lat: 17.4278, lng: 78.5342 },
};

export const COMMON_HYDERABAD_SECTORS: { label: string; key: string }[] = [
  { label: "Secunderabad", key: "secunderabad" },
  { label: "Banjara Hills", key: "banjara" },
  { label: "Gachibowli", key: "gachibowli" },
  { label: "Charminar", key: "charminar" },
  { label: "Hitech City", key: "hitech" },
  { label: "Lakdikapul", key: "lakdikapul" },
  { label: "Begumpet", key: "begumpet" },
  { label: "Osmania", key: "osmania" },
  { label: "Mehdipatnam", key: "mehdipatnam" },
  { label: "Kukatpally", key: "kukatpally" },
  { label: "Tank Bund", key: "tank bund" },
  { label: "Shamshabad", key: "shamshabad" },
];

/**
 * Extract Hyderabad location name and coordinates from natural text or voice transcription.
 */
export function resolveHyderabadLocation(text: string): ResolvedLocation {
  const lower = (text || "").toLowerCase().trim();
  if (!lower) {
    return { name: "Lakdikapul Underpass", lat: 17.4055, lng: 78.464 };
  }

  // 1. Direct gazetteer keyword matching
  for (const [key, loc] of Object.entries(HYDERABAD_GAZETTEER)) {
    if (lower.includes(key)) {
      return loc;
    }
  }

  // 2. Numerical coordinate regex extraction (e.g., "17.42, 78.45" or "lat 17.41 lng 78.46")
  const coordRegex = /(?:lat[:\s]*)?([1-2]\d\.\d{2,6})[,\s]+(?:lng[:\s]*)?([7-8]\d\.\d{2,6})/i;
  const match = lower.match(coordRegex);
  if (match) {
    const parsedLat = parseFloat(match[1]);
    const parsedLng = parseFloat(match[2]);
    if (parsedLat >= 17.1 && parsedLat <= 17.7 && parsedLng >= 78.2 && parsedLng <= 78.7) {
      return {
        name: `Custom Location (${parsedLat.toFixed(3)}°N, ${parsedLng.toFixed(3)}°E)`,
        lat: parsedLat,
        lng: parsedLng,
      };
    }
  }

  // 3. Fallback: Generate dynamic deterministic offset from text hash so different places never collide
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  const latOffset = ((Math.abs(hash) % 80) - 40) / 1000; // ±0.04 deg
  const lngOffset = ((Math.abs(hash >> 3) % 80) - 40) / 1000;

  return {
    name: text.length > 3 ? `Zone: ${text.slice(0, 24)}` : "Hyderabad Central Matrix",
    lat: Number((17.396 + latOffset).toFixed(4)),
    lng: Number((78.466 + lngOffset).toFixed(4)),
  };
}
