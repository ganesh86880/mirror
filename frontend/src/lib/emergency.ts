/**
 * MIRROR Emergency Response Types
 * Synchronized with Backend Pydantic Schemas (twin.py, simulation.py, ingest.py).
 */

export type ActionId = "ROUTE_A" | "ROUTE_C" | "DELAY_10";
export type IncidentType = "ROAD_BLOCKAGE" | "FLOOD" | "FIRE" | "MEDICAL_SOS";
export type EmergencyUnitStatus = "TRANSIT" | "DELAYED" | "STANDBY" | "DISPATCHED";

export interface Hospital {
  id: string;
  name: string;
  total_beds: number;
  occupied_beds: number;
  available_beds: number;
  occupancy_percent: number;
  latitude: number;
  longitude: number;
}

export interface EmergencyUnit {
  id: string;
  type: string;
  status: EmergencyUnitStatus | string;
  latitude: number;
  longitude: number;
}

export interface Incident {
  id: string;
  type: string;
  sector_id: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | string;
  description: string;
  latitude: number;
  longitude: number;
}

export interface DigitalTwinState {
  current_risk: number;
  incidents: Incident[];
  hospitals: Hospital[];
  emergency_units: EmergencyUnit[];
  geojson_sectors: any;
  available_actions: ActionId[] | string[];
}

export interface SimulationResult {
  action_id: string;
  baseline_risk: number;
  projected_risk: number;
  risk_score: number;
  risk_difference: number;
  response_time_minutes: number;
  exposure: number;
  congestion: number;
  hospital_load: number;
  secondary_risk: number;
  additional_people_at_risk: number;
  flag: string | null;
  hospital_load_increase_percent?: number;
  exposure_increase_percent?: number;
  explanation?: string;
}

export interface OutcomeComparisonResult {
  baseline_risk: number;
  lowest_risk_action: string;
  lowest_risk_score: number;
  action_rankings: SimulationResult[];
  comparison_summary: string;
}

export interface ParsedIncident {
  incident_type: IncidentType | string;
  severity_score: number;
  affects_emergency_corridor: boolean;
  blocked_road_name: string;
  estimated_delay_minutes: number;
  summary: string;
}

export interface IngestReportResponse {
  status: string;
  parsed_incident: ParsedIncident | null;
  corridor_compromised: boolean;
  reroute_triggered: boolean;
  alert_message: string | null;
  incident_marker: {
    id: string;
    title: string;
    type: string;
    severity_score: number;
    coordinates: [number, number];
    estimated_delay: number;
    summary: string;
    timestamp: string;
  } | null;
}
