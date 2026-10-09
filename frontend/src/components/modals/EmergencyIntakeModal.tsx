"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  X,
  MapPin,
  Mic,
  FileText,
  Camera,
  Radio,
  Send,
  Loader2,
  Sparkles,
  AlertTriangle,
  Flame,
  Waves,
  ShieldAlert,
  Car,
  StopCircle,
  Play,
  CheckCircle,
} from "lucide-react";
import {
  HazardIncident,
  IncidentSeverity,
  IncidentType,
  UserRole,
  createCustomIncident,
  submitMultimodalGeminiReport,
} from "@/lib/api";
import {
  resolveHyderabadLocation,
  COMMON_HYDERABAD_SECTORS,
  ResolvedLocation,
} from "@/lib/locations";

interface EmergencyIntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIncidentCreated: (incident: HazardIncident) => void;
  pinCoordinates: [number, number] | null;
  onStartPinDrop: () => void;
  currentUserRole?: UserRole;
}

export default function EmergencyIntakeModal({
  isOpen,
  onClose,
  onIncidentCreated,
  pinCoordinates,
  onStartPinDrop,
  currentUserRole = "PUBLIC",
}: EmergencyIntakeModalProps) {
  const [activeTab, setActiveTab] = useState<"MANUAL" | "VOICE" | "TEXT_MEDIA">("MANUAL");

  // Form states - Manual Pin Drop
  const [manualTitle, setManualTitle] = useState("");
  const [manualLocationText, setManualLocationText] = useState("Lakdikapul Underpass");
  const [manualType, setManualType] = useState<IncidentType>("ROADBLOCK");
  const [manualSeverity, setManualSeverity] = useState<IncidentSeverity>("HIGH");
  const [manualLat, setManualLat] = useState<number>(17.4055);
  const [manualLng, setManualLng] = useState<number>(78.464);
  const [manualRadius, setManualRadius] = useState<number>(250);
  const [manualDescription, setManualDescription] = useState("");

  // Sync pinCoordinates from map click
  useEffect(() => {
    if (pinCoordinates) {
      const lng = Number(pinCoordinates[0].toFixed(5));
      const lat = Number(pinCoordinates[1].toFixed(5));
      setManualLng(lng);
      setManualLat(lat);
      setManualLocationText(`Pin: ${lat.toFixed(3)}°N, ${lng.toFixed(3)}°E`);
      setManualTitle((prev) => prev || `Hazard Zone near ${lat.toFixed(3)}°N, ${lng.toFixed(3)}°E`);
    }
  }, [pinCoordinates]);

  // Handle location text change in manual mode
  const handleLocationChange = (locationStr: string) => {
    setManualLocationText(locationStr);
    const resolved = resolveHyderabadLocation(locationStr);
    setManualLat(resolved.lat);
    setManualLng(resolved.lng);
    if (!manualTitle || manualTitle.startsWith("Hazard") || manualTitle.startsWith("ROADBLOCK") || manualTitle.startsWith("FLOOD") || manualTitle.startsWith("FIRE") || manualTitle.startsWith("ACCIDENT")) {
      setManualTitle(`${manualType} at ${resolved.name}`);
    }
  };

  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<any>(null);

  // Text & Media states
  const [textPrompt, setTextPrompt] = useState("Flooding near the metro station, 2 feet of water accumulating rapidly near Lakdikapul");
  const [mediaFileBase64, setMediaFileBase64] = useState<string | null>(null);
  const [mediaFileName, setMediaFileName] = useState<string | null>(null);

  // Status states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Real-time resolved location preview for text prompt
  const resolvedTextLocation: ResolvedLocation = resolveHyderabadLocation(textPrompt || manualLocationText);

  if (!isOpen) return null;

  // Handle Manual Pin Drop Submit
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    const title = manualTitle.trim() || `${manualType} at ${manualLocationText}`;
    const optimisticIncident: HazardIncident = {
      id: `inc_${Date.now()}`,
      title,
      incident_type: manualType,
      severity: manualSeverity,
      lat: manualLat,
      lng: manualLng,
      radius_meters: manualRadius,
      status: "ACTIVE",
      description: manualDescription || title,
      created_at: new Date().toISOString(),
    };

    // Instant optimistic injection into map and state (0ms)
    onIncidentCreated(optimisticIncident);
    setIsSubmitting(false);
    onClose();

    // Background sync to backend database / cache
    createCustomIncident({
      title,
      incident_type: manualType,
      severity: manualSeverity,
      lat: manualLat,
      lng: manualLng,
      radius_meters: manualRadius,
      description: manualDescription || title,
      status: "ACTIVE",
    }).catch(() => {});
  };

  // Voice recording helpers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        setAudioBlob(blob);
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          setAudioBase64(reader.result as string);
        };
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.warn("Microphone access failed", err);
      setErrorMsg("Microphone permission denied or not available in this browser.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  // Handle Audio File Upload
  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = () => {
      setAudioBase64(reader.result as string);
      setAudioBlob(file);
    };
  };

  // Handle Image/Video File Upload
  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMediaFileName(file.name);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = () => {
      setMediaFileBase64(reader.result as string);
    };
  };

  // Handle Gemini Multimodal Ingestion (Voice or Text/Media)
  const handleGeminiIngest = async (sourceType: "VOICE" | "TEXT") => {
    setIsSubmitting(true);
    setErrorMsg(null);
    setFeedbackMsg(null);

    const payload: { text_report?: string; audio_base64?: string; image_base64?: string } = {};

    if (sourceType === "VOICE") {
      if (!audioBase64) {
        setErrorMsg("Please record or upload an audio voice note first.");
        setIsSubmitting(false);
        return;
      }
      payload.audio_base64 = audioBase64;
      payload.text_report = textPrompt || "Voice memo incident report";
    } else {
      if (!textPrompt.trim() && !mediaFileBase64) {
        setErrorMsg("Please provide a text description or upload a photo/video.");
        setIsSubmitting(false);
        return;
      }
      payload.text_report = textPrompt;
      if (mediaFileBase64) payload.image_base64 = mediaFileBase64;
    }

    // Dynamically resolve location from the text prompt!
    const resolved = resolveHyderabadLocation(textPrompt || manualLocationText || "Hyderabad");
    let incType: IncidentType = "ROADBLOCK";
    let severity: IncidentSeverity = "HIGH";
    let radius = 250;
    const lower = (textPrompt || "").toLowerCase();

    if (lower.includes("fire") || lower.includes("smoke") || lower.includes("blaze")) {
      incType = "FIRE";
      severity = "CRITICAL";
    } else if (lower.includes("flood") || lower.includes("water") || lower.includes("rain")) {
      incType = "FLOOD";
      severity = "HIGH";
      radius = 300;
    } else if (lower.includes("accident") || lower.includes("crash") || lower.includes("collision")) {
      incType = "ACCIDENT";
      severity = "HIGH";
      radius = 200;
    } else if (lower.includes("sos") || lower.includes("trapped") || lower.includes("medical")) {
      incType = "SOS";
      severity = "CRITICAL";
      radius = 200;
    }

    const optimisticIncident: HazardIncident = {
      id: `inc_${Date.now()}`,
      title: `${incType}: ${resolved.name}`,
      incident_type: incType,
      severity,
      lat: resolved.lat,
      lng: resolved.lng,
      radius_meters: radius,
      status: "ACTIVE",
      description: textPrompt || `Reported ${incType} at ${resolved.name}`,
      created_at: new Date().toISOString(),
    };

    // Instant optimistic injection into map (0ms)
    onIncidentCreated(optimisticIncident);
    setIsSubmitting(false);
    onClose();

    // Background sync to Gemini endpoint
    submitMultimodalGeminiReport(payload).catch(() => {});
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md select-none font-mono">
      <div className="w-full max-w-xl bg-[#0D1117] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-4 py-3 bg-[#161B22] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-red-500 animate-pulse" />
            <div>
              <span className="font-bold text-sm tracking-wide text-white block">
                {currentUserRole === "PUBLIC"
                  ? "CITIZEN COMMUNITY HAZARD INTAKE"
                  : currentUserRole === "TRAFFIC_POLICE"
                  ? "TRAFFIC POLICE CORRIDOR INTAKE"
                  : "FIELD HAZARD REPORTING TERMINAL"}
              </span>
              <span className="text-[9px] text-gray-400 block">
                {currentUserRole === "PUBLIC" || currentUserRole === "TRAFFIC_POLICE" ? (
                  <span className="text-emerald-400 font-semibold">
                    ✓ AUTHORIZED DISPATCH REPORTER ({currentUserRole})
                  </span>
                ) : (
                  <span className="text-amber-400">
                    ⚠ Responders act on dispatches — Citizens & Traffic Police file hazard intel
                  </span>
                )}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-3 bg-[#161B22]/60 border-b border-white/10 p-1 gap-1 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("MANUAL")}
            className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeTab === "MANUAL"
                ? "bg-blue-600 text-white shadow-md"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>MANUAL PIN</span>
          </button>
          <button
            onClick={() => setActiveTab("VOICE")}
            className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeTab === "VOICE"
                ? "bg-blue-600 text-white shadow-md"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>VOICE MEMO</span>
          </button>
          <button
            onClick={() => setActiveTab("TEXT_MEDIA")}
            className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeTab === "TEXT_MEDIA"
                ? "bg-blue-600 text-white shadow-md"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>TEXT / MEDIA</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto space-y-4 text-xs text-gray-300">
          {/* TAB 1: MANUAL PIN DROP */}
          {activeTab === "MANUAL" && (
            <form onSubmit={handleManualSubmit} className="space-y-3.5">
              <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between">
                <div>
                  <span className="font-bold text-blue-300 block text-[11px]">
                    Interactive Pin Dropper & Geocoding
                  </span>
                  <span className="text-[10px] text-gray-400 block font-mono">
                    Target: {manualLat.toFixed(4)}°N, {manualLng.toFixed(4)}°E
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onStartPinDrop();
                  }}
                  className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] shadow"
                >
                  TAP ON MAP
                </button>
              </div>

              {/* Target Location / Place Input with dynamic resolution */}
              <div>
                <label className="block text-[10px] text-gray-400 mb-1">
                  TARGET PLACE / SECTOR (TYPE TO AUTO-RESOLVE)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={manualLocationText}
                    onChange={(e) => handleLocationChange(e.target.value)}
                    placeholder="e.g. Secunderabad, Banjara Hills, Charminar, Gachibowli..."
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500 text-xs"
                  />
                  <span className="absolute right-2.5 top-2.5 text-[9px] text-emerald-400 font-mono">
                    ✓ {manualLat.toFixed(3)}°, {manualLng.toFixed(3)}°
                  </span>
                </div>
              </div>

              {/* Quick Sector Chips */}
              <div className="space-y-1">
                <span className="text-[9px] text-gray-400 block">QUICK SELECT PLACE / SECTOR:</span>
                <div className="flex flex-wrap gap-1">
                  {COMMON_HYDERABAD_SECTORS.slice(0, 8).map((sec) => (
                    <button
                      key={sec.key}
                      type="button"
                      onClick={() => handleLocationChange(sec.label)}
                      className={`px-2 py-0.5 rounded-md text-[9px] transition-colors border ${
                        manualLocationText.toLowerCase().includes(sec.key)
                          ? "bg-blue-600 text-white border-blue-400 font-bold"
                          : "bg-white/5 hover:bg-white/10 text-gray-300 border-white/10"
                      }`}
                    >
                      {sec.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-gray-400 mb-1">INCIDENT TITLE</label>
                <input
                  type="text"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="e.g. Submerged Metro Underpass"
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-gray-400 mb-1">INCIDENT TYPE</label>
                  <select
                    value={manualType}
                    onChange={(e) => setManualType(e.target.value as IncidentType)}
                    className="w-full px-3 py-2 rounded-xl bg-[#161B22] border border-white/10 text-white focus:outline-none focus:border-blue-500 text-xs"
                  >
                    <option value="ROADBLOCK">ROADBLOCK</option>
                    <option value="FLOOD">FLOOD</option>
                    <option value="FIRE">FIRE</option>
                    <option value="ACCIDENT">ACCIDENT</option>
                    <option value="SOS">SOS TRAPPED</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-gray-400 mb-1">SEVERITY LEVEL</label>
                  <select
                    value={manualSeverity}
                    onChange={(e) => setManualSeverity(e.target.value as IncidentSeverity)}
                    className="w-full px-3 py-2 rounded-xl bg-[#161B22] border border-white/10 text-white focus:outline-none focus:border-blue-500 text-xs"
                  >
                    <option value="CRITICAL">CRITICAL (Red Zone)</option>
                    <option value="HIGH">HIGH (Orange Zone)</option>
                    <option value="MODERATE">MODERATE</option>
                    <option value="SAFE">SAFE / RELIEF (Green)</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                  <span>ZONE RADIUS: {manualRadius} METERS</span>
                  <span className="text-gray-500">(200m - 400m localized)</span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="600"
                  step="25"
                  value={manualRadius}
                  onChange={(e) => setManualRadius(Number(e.target.value))}
                  className="w-full accent-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <MapPin className="w-4 h-4" />
                )}
                <span>DEPLOY LOCALIZED HAZARD ZONE</span>
              </button>
            </form>
          )}

          {/* TAB 2: VOICE MEMO */}
          {activeTab === "VOICE" && (
            <div className="space-y-4 text-center py-2">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <span className="text-[11px] text-gray-300 block">
                  Record Voice Note for Gemini AI Multimodal Processing
                </span>

                <div className="flex items-center justify-center gap-4">
                  {!isRecording ? (
                    <button
                      type="button"
                      onClick={startRecording}
                      className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg transition-transform active:scale-95"
                    >
                      <Mic className="w-6 h-6" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="w-14 h-14 rounded-full bg-amber-600 hover:bg-amber-500 text-white flex items-center justify-center shadow-lg animate-pulse"
                    >
                      <StopCircle className="w-6 h-6" />
                    </button>
                  )}
                </div>

                <div className="text-[11px] text-gray-400">
                  {isRecording ? (
                    <span className="text-red-400 font-bold animate-pulse">
                      Recording audio: {recordingSeconds}s
                    </span>
                  ) : audioBlob ? (
                    <span className="text-emerald-400">Audio voice memo ready ({Math.round(audioBlob.size / 1024)} KB)</span>
                  ) : (
                    <span>Tap mic to speak or describe the hazard</span>
                  )}
                </div>

                <div className="border-t border-white/10 pt-3">
                  <label className="text-[10px] text-gray-400 block mb-1">
                    Or Upload Audio File (.webm, .wav, .mp3)
                  </label>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleAudioUpload}
                    className="text-[10px] text-gray-400 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-[10px] file:bg-white/10 file:text-white"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleGeminiIngest("VOICE")}
                disabled={isSubmitting || !audioBase64}
                className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 text-purple-200" />
                )}
                <span>ANALYZE VOICE WITH GEMINI 2.5 / 3.8 FLASH</span>
              </button>
            </div>
          )}

          {/* TAB 3: TEXT / IMAGE / VIDEO */}
          {activeTab === "TEXT_MEDIA" && (
            <div className="space-y-3.5">
              <div>
                <label className="block text-[10px] text-gray-400 mb-1">
                  UNSTRUCTURED REPORT / PROMPT (TYPE ANY LOCATION)
                </label>
                <textarea
                  rows={3}
                  value={textPrompt}
                  onChange={(e) => setTextPrompt(e.target.value)}
                  placeholder="e.g. Flooding near the metro station, 2 feet of water accumulating near Secunderabad"
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500 text-xs"
                />
              </div>

              {/* Dynamic Live Geocoding Feedback */}
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[10px]">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>
                    Detected Place: <strong className="text-white">{resolvedTextLocation.name}</strong>
                  </span>
                </div>
                <span className="font-mono text-emerald-400 font-semibold">
                  {resolvedTextLocation.lat.toFixed(4)}°N, {resolvedTextLocation.lng.toFixed(4)}°E
                </span>
              </div>

              {/* Fast Place Chips for Text Tab */}
              <div className="space-y-1">
                <span className="text-[10px] text-gray-400 block">CLICK TO CHANGE PLACE IN PROMPT:</span>
                <div className="flex flex-wrap gap-1">
                  {COMMON_HYDERABAD_SECTORS.map((sec) => (
                    <button
                      key={sec.key}
                      type="button"
                      onClick={() => {
                        // Replace or append sector to prompt
                        const currentPrompt = textPrompt.trim();
                        if (currentPrompt.includes("near") || currentPrompt.includes("at") || currentPrompt.includes("in")) {
                          // Replace last part or append
                          setTextPrompt(`${currentPrompt.split("near")[0].split("at")[0].trim()} near ${sec.label}`);
                        } else {
                          setTextPrompt(`${currentPrompt} near ${sec.label}`);
                        }
                      }}
                      className="px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-[9px] text-blue-300 transition-colors"
                    >
                      {sec.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fast Presets */}
              <div className="space-y-1">
                <span className="text-[10px] text-gray-400 block">QUICK SCENARIO PRESETS:</span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setTextPrompt("Flooding near the metro station, 2 feet of water accumulating rapidly near Lakdikapul")
                    }
                    className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[9px] text-blue-300"
                  >
                    🌊 Metro Flooding (Lakdikapul)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setTextPrompt("Severe structural fire with heavy black smoke spreading across commercial district near Charminar")
                    }
                    className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[9px] text-red-300"
                  >
                    🔥 Commercial Fire (Charminar)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setTextPrompt("Multiple vehicle accident and roadblock halting ambulance transit near Secunderabad Junction")
                    }
                    className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[9px] text-amber-300"
                  >
                    🚗 Corridor Accident (Secunderabad)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setTextPrompt("Waterlogging and severe traffic gridlock along financial district corridor near Gachibowli")
                    }
                    className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[9px] text-emerald-300"
                  >
                    🌊 Gridlock (Gachibowli)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-gray-400 mb-1">
                  ATTACH PHOTO OR VIDEO (OPTIONAL)
                </label>
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleMediaUpload}
                  className="w-full text-[10px] text-gray-400 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-[10px] file:bg-white/10 file:text-white"
                />
                {mediaFileName && (
                  <span className="text-[9px] text-emerald-400 block mt-1">
                    Attached: {mediaFileName}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleGeminiIngest("TEXT")}
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 text-purple-200" />
                )}
                <span>PARSE MULTIMODAL REPORT VIA GEMINI</span>
              </button>
            </div>
          )}

          {/* Feedback messages */}
          {feedbackMsg && (
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>{feedbackMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-[11px] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
