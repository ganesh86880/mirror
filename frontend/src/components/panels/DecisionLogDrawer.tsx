"use client";

import React from "react";
import { ChevronUp, ChevronDown, CheckCircle2, ShieldCheck, FileText, ArrowRight } from "lucide-react";

export interface DecisionLogEntry {
  id: string;
  timestamp: string;
  actionCode: string;
  actionTitle: string;
  details: string;
  riskBefore: number;
  riskAfter: number;
  targetFacility: string;
}

interface DecisionLogDrawerProps {
  logs: DecisionLogEntry[];
  isOpen: boolean;
  onToggle: () => void;
}

export default function DecisionLogDrawer({ logs, isOpen, onToggle }: DecisionLogDrawerProps) {
  return (
    <div className="w-full bg-tactical-surface border-t border-tactical-border select-none font-mono transition-all z-20">
      {/* Drawer Toggle Header */}
      <button
        onClick={onToggle}
        className="w-full h-8 px-3 flex items-center justify-between text-[11px] text-tactical-muted hover:text-tactical-text bg-tactical-panel border-b border-tactical-border transition-colors"
      >
        <div className="flex items-center gap-2">
          <FileText className="w-3.5 h-3.5 text-tactical-green" />
          <span className="font-bold text-tactical-text uppercase tracking-wider text-[10px]">
            OPERATIONAL DECISION AUDIT LOG
          </span>
          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#2E856E20] border border-[#2E856E40] text-tactical-green">
            {logs.length} {logs.length === 1 ? "RECORD" : "RECORDS"}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-[10px]">
          <span>{isOpen ? "COLLAPSE AUDIT DRAWER" : "EXPAND AUDIT DRAWER"}</span>
          {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </div>
      </button>

      {/* Drawer Content */}
      {isOpen && (
        <div className="max-h-40 overflow-y-auto p-2.5 space-y-2 bg-[#0E1116]">
          {logs.length === 0 ? (
            <div className="py-4 text-center text-tactical-muted text-[11px]">
              No dispatch interventions executed. Standing by for commander authorization.
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="p-2 bg-tactical-surface border border-tactical-border rounded flex items-center justify-between gap-3 text-[11px]"
              >
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-tactical-green shrink-0 mt-0.5" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-tactical-muted text-[10px] font-bold">[{log.timestamp}]</span>
                      <span className="text-tactical-text font-bold text-[11px]">{log.actionTitle}</span>
                      <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-tactical-green/20 text-tactical-green border border-tactical-green/40">
                        {log.actionCode}
                      </span>
                    </div>
                    <div className="text-tactical-muted text-[10px] mt-0.5 leading-tight">{log.details}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 text-right">
                  <div>
                    <div className="text-[9px] text-tactical-muted uppercase">Global Risk Delta</div>
                    <div className="font-bold flex items-center gap-1 text-[11px]">
                      <span className="text-tactical-crimson">{log.riskBefore}</span>
                      <ArrowRight className="w-2.5 h-2.5 text-tactical-muted" />
                      <span className="text-tactical-green">{log.riskAfter}</span>
                    </div>
                  </div>

                  <span className="px-2 py-1 rounded text-[9px] font-bold bg-[#2E856E15] border border-tactical-green text-tactical-green uppercase flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    DISPATCHED
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
