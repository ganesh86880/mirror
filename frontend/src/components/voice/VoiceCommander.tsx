"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, Volume2, Radio, Check, AlertCircle } from "lucide-react";
import { UserRole } from "@/lib/api";

export interface VoiceHazardPayload {
  title: string;
  incident_type: "FIRE" | "FLOOD" | "ACCIDENT" | "ROADBLOCK" | "SOS";
  severity: "CRITICAL" | "HIGH" | "MODERATE";
  lat: number;
  lng: number;
  radius_meters: number;
  description: string;
}

export type VoiceActionType =
  | "NAVIGATE_MOVE"
  | "NAVIGATE_STOP"
  | "ARRIVED_SCENE"
  | "RESOLVE_INCIDENT"
  | "SWITCH_ROLE"
  | "CREATE_HAZARD"
  | "OPEN_REPORT_MODAL"
  | "TOGGLE_HOTSPOT"
  | "UNKNOWN";

interface VoiceCommanderProps {
  currentUserRole: UserRole;
  isNavigating: boolean;
  onVoiceCommand: (
    command: string,
    actionType: VoiceActionType,
    hazardPayload?: VoiceHazardPayload
  ) => void;
}

export default function VoiceCommander({
  currentUserRole,
  isNavigating,
  onVoiceCommand,
}: VoiceCommanderProps) {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>("");
  const [lastExecuted, setLastExecuted] = useState<string>("");
  const [micPermission, setMicPermission] = useState<"prompt" | "granted" | "denied">("prompt");
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Tactical Text-to-Speech feedback
  const speakTacticalFeedback = useCallback((text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 0.95;
      utterance.volume = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  // Voice Command Intent Classifier
  const processCommand = useCallback(
    (text: string) => {
      const lower = text.toLowerCase().trim();
      setTranscript(lower);

      let action: VoiceActionType = "UNKNOWN";
      let feedback = "";

      // 1. Direct Voice Hazard Creation (e.g. "Report fire", "Create flood", "Accident near junction")
      const isHazardCreation =
        (lower.includes("create") ||
          lower.includes("report") ||
          lower.includes("hazard") ||
          lower.includes("emergency") ||
          lower.includes("incident") ||
          lower.includes("fire") ||
          lower.includes("flood") ||
          lower.includes("accident") ||
          lower.includes("roadblock") ||
          lower.includes("water") ||
          lower.includes("sos")) &&
        !lower.startsWith("move") &&
        !lower.startsWith("navigate") &&
        !lower.startsWith("go") &&
        !lower.startsWith("drive") &&
        !lower.startsWith("switch") &&
        !lower.startsWith("stop");

      if (isHazardCreation) {
        let incType: "FIRE" | "FLOOD" | "ACCIDENT" | "ROADBLOCK" | "SOS" = "ROADBLOCK";
        let severity: "CRITICAL" | "HIGH" | "MODERATE" = "HIGH";
        let lat = 17.396;
        let lng = 78.466;
        let radius = 250;
        let locName = "Hyderabad Corridor";

        if (lower.includes("fire") || lower.includes("smoke") || lower.includes("blaze")) {
          incType = "FIRE";
          severity = "CRITICAL";
          lat = 17.394;
          lng = 78.468;
          radius = 250;
          locName = "Commercial District";
        } else if (
          lower.includes("flood") ||
          lower.includes("water") ||
          lower.includes("submerge") ||
          lower.includes("rain")
        ) {
          incType = "FLOOD";
          severity = "HIGH";
          lat = 17.4055;
          lng = 78.464;
          radius = 300;
          locName = "Lakdikapul Underpass";
        } else if (lower.includes("accident") || lower.includes("crash") || lower.includes("collision")) {
          incType = "ACCIDENT";
          severity = "HIGH";
          lat = 17.398;
          lng = 78.489;
          radius = 200;
          locName = "Arterial Highway Junction";
        } else if (lower.includes("sos") || lower.includes("trapped") || lower.includes("medical")) {
          incType = "SOS";
          severity = "CRITICAL";
          lat = 17.375;
          lng = 78.48;
          radius = 200;
          locName = "Sector 04 Residential";
        } else {
          incType = "ROADBLOCK";
          severity = "HIGH";
          lat = 17.385;
          lng = 78.4867;
          radius = 250;
          locName = "Central Transit Corridor";
        }

        const hazardPayload: VoiceHazardPayload = {
          title: `${incType}: Spoken Alert (${locName})`,
          incident_type: incType,
          severity,
          lat,
          lng,
          radius_meters: radius,
          description: text,
        };

        action = "CREATE_HAZARD";
        feedback = `Hazard zone established: ${incType} emergency at ${locName}.`;
        setLastExecuted(lower);
        setFeedbackMessage(feedback);
        speakTacticalFeedback(feedback);
        onVoiceCommand(lower, action, hazardPayload);
        setTimeout(() => setFeedbackMessage(null), 4500);
        return;
      }

      if (
        lower.includes("move") ||
        lower.includes("go") ||
        lower.includes("navigate") ||
        lower.includes("drive") ||
        lower.includes("forward") ||
        lower.includes("head") ||
        lower.includes("approach") ||
        lower.includes("dispatch") ||
        lower.includes("start")
      ) {
        action = "NAVIGATE_MOVE";
        feedback = "Command confirmed. Unit in motion along tactical corridor.";
      } else if (
        lower.includes("stop") ||
        lower.includes("halt") ||
        lower.includes("pause") ||
        lower.includes("hold") ||
        lower.includes("wait")
      ) {
        action = "NAVIGATE_STOP";
        feedback = "Unit holding position.";
      } else if (
        lower.includes("arrive") ||
        lower.includes("at scene") ||
        lower.includes("reached") ||
        lower.includes("contain")
      ) {
        action = "ARRIVED_SCENE";
        feedback = "Arrived at incident scene. Establishing perimeter.";
      } else if (
        lower.includes("resolve") ||
        lower.includes("clear") ||
        lower.includes("case resolved") ||
        lower.includes("safe") ||
        lower.includes("extinguished")
      ) {
        action = "RESOLVE_INCIDENT";
        feedback = "Incident declared resolved. Returning to patrol status.";
      } else if (lower.includes("ambulance") || lower.includes("medic")) {
        action = "SWITCH_ROLE";
        feedback = "Tactical profile switched to Ambulance.";
      } else if (lower.includes("fire engine") || lower.includes("fire") || lower.includes("rescue")) {
        action = "SWITCH_ROLE";
        feedback = "Tactical profile switched to Fire Engine.";
      } else if (lower.includes("police") || lower.includes("patrol") || lower.includes("traffic")) {
        action = "SWITCH_ROLE";
        feedback = "Tactical profile switched to Traffic Police.";
      } else if (lower.includes("hotspot") || lower.includes("congestion")) {
        action = "TOGGLE_HOTSPOT";
        feedback = "Traffic hotspot marking mode toggled.";
      }

      if (action !== "UNKNOWN") {
        setLastExecuted(lower);
        setFeedbackMessage(feedback);
        speakTacticalFeedback(feedback);
        onVoiceCommand(lower, action);

        // Clear feedback after 4 seconds
        setTimeout(() => {
          setFeedbackMessage(null);
        }, 4000);
      }
    },
    [onVoiceCommand, speakTacticalFeedback]
  );

  // Start Mic & Audio Visualizer
  const startAudioMeter = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      setMicPermission("granted");

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateMeter = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
        animFrameRef.current = requestAnimationFrame(updateMeter);
      };
      updateMeter();
    } catch (err) {
      console.warn("Microphone access request:", err);
      setMicPermission("denied");
    }
  };

  const stopAudioMeter = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setAudioLevel(0);
  };

  // Toggle Speech Recognition
  const toggleListening = async () => {
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_) {}
      }
      stopAudioMeter();
      setIsListening(false);
      return;
    }

    // Initialize Web Speech Recognition
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        "Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge."
      );
      return;
    }

    try {
      await startAudioMeter();

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListening(true);
        setFeedbackMessage("Listening for tactical commands (say 'Move', 'Navigate', 'Stop', 'Arrived')...");
      };

      recognition.onresult = (event: any) => {
        let currentTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i][0].transcript;
          currentTranscript += item;
          if (event.results[i].isFinal) {
            processCommand(item);
          }
        }
        setTranscript(currentTranscript);
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        if (event.error === "not-allowed") {
          setMicPermission("denied");
          setIsListening(false);
          stopAudioMeter();
        }
      };

      recognition.onend = () => {
        // Auto-restart if user still wants it active
        if (isListening && recognitionRef.current) {
          try {
            recognition.start();
          } catch (_) {}
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("Failed to start voice listener:", err);
      setIsListening(false);
      stopAudioMeter();
    }
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_) {}
      }
      stopAudioMeter();
    };
  }, []);

  return (
    <div className="fixed top-16 right-4 sm:right-6 z-30 font-mono pointer-events-auto">
      {/* Floating Tactical Voice Controller */}
      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          {/* Live Voice Audio Waveform & Status */}
          {isListening && (
            <div className="bg-[#0D1117]/95 border border-emerald-500/50 backdrop-blur-xl px-3 py-1.5 rounded-full shadow-2xl flex items-center gap-2.5 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <div className="flex items-center gap-0.5 h-3">
                <span
                  className="w-1 bg-emerald-400 rounded-full transition-all"
                  style={{ height: `${Math.max(4, (audioLevel / 100) * 14)}px` }}
                />
                <span
                  className="w-1 bg-emerald-400 rounded-full transition-all"
                  style={{ height: `${Math.max(4, (audioLevel / 100) * 20)}px` }}
                />
                <span
                  className="w-1 bg-emerald-400 rounded-full transition-all"
                  style={{ height: `${Math.max(4, (audioLevel / 100) * 12)}px` }}
                />
              </div>
              <span className="text-[10px] text-emerald-300 font-bold tracking-wider uppercase">
                VOICE TAC-LINK ACTIVE
              </span>
            </div>
          )}

          {/* Master Mic Access Button */}
          <button
            onClick={toggleListening}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-full border shadow-2xl transition-all transform active:scale-95 ${
              isListening
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-400 shadow-emerald-500/20 ring-2 ring-emerald-500/30"
                : micPermission === "denied"
                ? "bg-red-500/20 text-red-300 border-red-500/40"
                : "bg-[#161B22]/90 text-gray-300 border-white/20 hover:text-white hover:border-emerald-500/50 hover:bg-black/80"
            }`}
            title={isListening ? "Click to mute microphone" : "Click to enable microphone voice control"}
          >
            {isListening ? (
              <>
                <Mic className="w-4 h-4 text-emerald-400 animate-bounce" />
                <span className="text-xs font-bold tracking-wide">MIC ON</span>
              </>
            ) : micPermission === "denied" ? (
              <>
                <MicOff className="w-4 h-4 text-red-400" />
                <span className="text-xs font-bold tracking-wide">MIC BLOCKED</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4 text-gray-400 group-hover:text-emerald-400" />
                <span className="text-xs font-bold tracking-wide">ENABLE MIC</span>
              </>
            )}
          </button>
        </div>

        {/* Real-time Spoken Transcript & Feedback Card */}
        {isListening && (
          <div className="bg-[#0D1117]/95 border border-white/15 backdrop-blur-xl rounded-xl p-2.5 max-w-xs shadow-2xl text-[10px] space-y-1.5 transition-all animate-fadeIn">
            <div className="flex items-center justify-between text-gray-400 border-b border-white/10 pb-1">
              <span className="flex items-center gap-1 font-bold text-emerald-400">
                <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                VOICE INTAKE
              </span>
              <span className="text-[9px] text-gray-500">SAY: &quot;MOVE&quot;, &quot;STOP&quot;, &quot;ARRIVE&quot;</span>
            </div>

            {transcript && (
              <div className="text-gray-200 italic truncate max-w-[240px]">
                &quot;{transcript}&quot;
              </div>
            )}

            {feedbackMessage && (
              <div className="text-emerald-300 font-bold bg-emerald-950/40 border border-emerald-500/30 rounded px-2 py-1 flex items-center gap-1.5">
                <Check className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                <span className="truncate">{feedbackMessage}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
