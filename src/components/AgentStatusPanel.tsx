import React from "react";
import { Incident } from "../types";
import {
  Sparkles,
  ShieldCheck,
  Zap,
  TrendingUp,
  Scale,
  Wrench,
  Clock,
  DollarSign,
  Users,
  Maximize2,
  Minimize2,
  Play
} from "lucide-react";

interface AgentStatusPanelProps {
  incident: Incident;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  activeStep: number; // 0 to 5 represent active steps in sequence
}

export default function AgentStatusPanel({
  incident,
  onAnalyze,
  isAnalyzing,
  activeStep,
}: AgentStatusPanelProps) {
  const [activeThoughts, setActiveThoughts] = React.useState<Record<string, boolean>>({
    intake: true,
    verification: false,
    impact: false,
    prioritization: false,
    resolution: false,
  });

  const toggleThoughts = (agent: string) => {
    setActiveThoughts((prev) => ({ ...prev, [agent]: !prev[agent] }));
  };

  const steps = [
    {
      id: "intake",
      name: "Intake Agent",
      role: "Vision & Raw Data Extraction",
      icon: Sparkles,
      color: "blue",
      data: incident.intake,
    },
    {
      id: "verification",
      name: "Verification Agent",
      role: "Community Duplicate Detection",
      icon: ShieldCheck,
      color: "emerald",
      data: incident.verification,
    },
    {
      id: "impact",
      name: "Impact Agent",
      role: "Safety & Spatial Risk Analysis",
      icon: Zap,
      color: "violet",
      data: incident.impact,
    },
    {
      id: "prioritization",
      name: "Prioritization Agent",
      role: "Composite Scale Repair Scoring",
      icon: Scale,
      color: "amber",
      data: incident.prioritization,
    },
    {
      id: "resolution",
      name: "Resolution Agent",
      role: "Department Dispatch Optimization",
      icon: Wrench,
      color: "rose",
      data: incident.resolution,
    },
  ];

  const hasRun = !!incident.intake;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
        <div>
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isAnalyzing ? "bg-amber-400" : hasRun ? "bg-emerald-400" : "bg-slate-400"}`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isAnalyzing ? "bg-amber-500" : hasRun ? "bg-emerald-500" : "bg-slate-500"}`}></span>
            </span>
            Autonomous Multi-Agent Command Core
          </h3>
          <p className="text-xs text-slate-500">
            Agents communicate through JSON payload handoffs following the pipeline protocol.
          </p>
        </div>

        {!hasRun && !isAnalyzing && (
          <button
            onClick={onAnalyze}
            id="btn-trigger-ai-agents"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer shadow-sm active:scale-95"
          >
            <Play className="w-3.5 h-3.5 fill-white text-transparent" />
            Launch Autonomous Agent Chain
          </button>
        )}

        {isAnalyzing && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold rounded-lg">
            <Clock className="w-3.5 h-3.5 animate-spin" />
            Pipeline Executing: Step {activeStep + 1}/5
          </div>
        )}
      </div>

      {/* Sequential progress indicators for non-processed or actively processing actions */}
      {!hasRun && !isAnalyzing && (
        <div className="flex flex-col items-center justify-center py-10 border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
          <Sparkles className="w-8 h-8 text-slate-400 mb-2 animate-pulse" />
          <p className="text-xs text-slate-600 font-medium text-center px-4">
            Incident is currently in unprocessed "SUBMITTED" state.
          </p>
          <p className="text-[10px] text-slate-400 text-center px-4 max-w-sm mt-1">
            Trigger the Multi-Agent grid above to instruct the AI agents to investigate, verify, evaluate impact, prioritize, and design high-precision dispatch repairs.
          </p>
        </div>
      )}

      {/* RENDER PROGRESS OR COMPLETE STATE CARD GRID */}
      {(hasRun || isAnalyzing) && (
        <div className="space-y-4">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isCompleted = hasRun || (isAnalyzing && activeStep > idx);
            const isActive = isAnalyzing && activeStep === idx;
            const isPending = isAnalyzing && activeStep < idx;

            let badgeColor = "bg-slate-100 text-slate-500 border-slate-200/50";
            let borderColor = "border-slate-100";
            if (isCompleted) {
              badgeColor = `bg-${step.color}-50 text-${step.color}-700 border-${step.color}-200/80`;
              borderColor = `border-${step.color}-100`;
            } else if (isActive) {
              badgeColor = "bg-amber-50 text-amber-700 border-amber-300 animate-pulse";
              borderColor = "border-amber-300 ring-4 ring-amber-50";
            }

            // Safe lookup for Tailwind classes to guarantee proper text/bg colors without dynamic generation issues
            const colorMap: Record<string, { bg: string; text: string; tint: string }> = {
              blue: { bg: "bg-blue-50", text: "text-blue-700", tint: "border-blue-100" },
              emerald: { bg: "bg-emerald-50", text: "text-emerald-700", tint: "border-emerald-100" },
              violet: { bg: "bg-purple-50", text: "text-purple-700", tint: "border-purple-100" },
              amber: { bg: "bg-amber-50", text: "text-amber-700", tint: "border-amber-100" },
              rose: { bg: "bg-rose-50", text: "text-rose-700", tint: "border-rose-100" },
            };

            const mapping = colorMap[step.color] || { bg: "bg-slate-50", text: "text-slate-700", tint: "border-slate-100" };

            return (
              <div
                key={step.id}
                className={`border rounded-xl transition-all duration-300 ${
                  isCompleted ? mapping.tint : borderColor
                } ${isActive ? "bg-amber-50/10" : ""}`}
              >
                {/* Agent Header bar */}
                <div className="flex items-center justify-between p-4 flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-9 w-9 rounded-lg flex items-center justify-center border ${
                        isCompleted
                          ? `${mapping.bg} ${mapping.text} border-transparent`
                          : isActive
                          ? "bg-amber-100 text-amber-800 border-amber-300 animate-bounce"
                          : "bg-slate-50 text-slate-400 border-slate-200"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        {step.name}
                        {isCompleted && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-normal ${mapping.bg} ${mapping.text}`}>
                            VERIFIED OUT
                          </span>
                        )}
                        {isActive && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-amber-100 text-amber-850 animate-pulse">
                            COMPUTING...
                          </span>
                        )}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-mono">{step.role}</p>
                    </div>
                  </div>

                  {/* Right side outputs display on collapsed state */}
                  {isCompleted && step.data && (
                    <button
                      onClick={() => toggleThoughts(step.id)}
                      className="inline-flex items-center gap-1 text-[10px] text-slate-500 font-medium hover:text-slate-800"
                    >
                      {activeThoughts[step.id] ? (
                        <>
                          <Minimize2 className="w-3 h-3 text-slate-400" /> Hide Monologue
                        </>
                      ) : (
                        <>
                          <Maximize2 className="w-3 h-3 text-slate-400" /> Explain Reasoning
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* ACTIVE RUN LOADER TERMINAL */}
                {isActive && (
                  <div className="mx-4 mb-4 bg-slate-900 border border-slate-800 p-3 rounded-lg font-mono text-[10px] text-amber-400 space-y-1">
                    <p className="text-slate-400"># System: Initializing Handshake Event Callback...</p>
                    <p className="animate-pulse"># Processing: Examining spatial incident parameters & NLP...</p>
                    <div className="h-1 bg-slate-800 rounded overflow-hidden">
                      <div className="h-full bg-amber-500 animate-infinite" style={{ width: "35%" }} />
                    </div>
                  </div>
                )}

                {/* COMPLETED DATA MODULE REPRESENTATION */}
                {isCompleted && step.data && (
                  <div className="px-4 pb-4 border-t border-slate-100/50 pt-3">
                    {/* Unique Agent output parameters block */}
                    {step.id === "intake" && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs mb-3">
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <span className="text-[10px] text-slate-400 block uppercase font-mono">Category Tag</span>
                          <span className="font-bold text-slate-700">{incident.intake?.issue_type}</span>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <span className="text-[10px] text-slate-400 block uppercase font-mono">Severity Vector</span>
                          <span className="font-bold text-red-650 flex items-center gap-1">
                            {"🚨".repeat(incident.intake?.severity || 1)}
                            <span className="font-mono text-[10px] text-slate-500">({incident.intake?.severity}/5)</span>
                          </span>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <span className="text-[10px] text-slate-400 block uppercase font-mono">Vision Confidence</span>
                          <span className="font-mono font-bold text-slate-700">
                            {((incident.intake?.confidence || 0.95) * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    )}

                    {step.id === "verification" && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs mb-3">
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          <div>
                            <span className="text-[10px] text-slate-400 block uppercase font-mono">Incidental Security Check</span>
                            <span className="font-bold text-slate-700">
                              {incident.verification?.verified ? "Verified Authentic Issue" : "Potential Spam/Invalid"}
                            </span>
                          </div>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <span className="text-[10px] text-slate-400 block uppercase font-mono">Consolidated Duplicate Stack</span>
                          <span className="font-bold text-slate-700">
                            {incident.verification?.duplicate_group
                              ? `Duplicate flagged (ID: ${incident.verification.duplicate_group})`
                              : "Unique Report (No duplicates detected)"}
                          </span>
                        </div>
                      </div>
                    )}

                    {step.id === "impact" && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs mb-3">
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <span className="text-[10px] text-slate-400 block uppercase font-mono">Safety Impact Radius</span>
                          <span className="font-bold text-slate-700">
                            {"★".repeat(incident.impact?.impact_score || 3)}
                            <span className="text-[10px] font-mono font-normal"> ({incident.impact?.impact_score}/5)</span>
                          </span>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-center gap-2.5">
                          <Users className="w-4 h-4 text-purple-650" />
                          <div>
                            <span className="text-[10px] text-slate-400 block uppercase font-mono">Affected Population</span>
                            <span className="font-bold text-slate-750">
                              {(incident.impact?.affected_population || 100).toLocaleString()} residents
                            </span>
                          </div>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 md:col-span-1">
                          <span className="text-[10px] text-slate-400 block uppercase font-mono">GIS Spatial Risk Factors</span>
                          <span className="text-[11px] text-slate-650 line-clamp-2">
                            {incident.impact?.reasoning}
                          </span>
                        </div>
                      </div>
                    )}

                    {step.id === "prioritization" && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs mb-3">
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <span className="text-[10px] text-slate-400 block uppercase font-mono">Analytical Priority Rack</span>
                          <span
                            className={`inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold ${
                              incident.prioritization?.priority_rank === "CRITICAL"
                                ? "bg-red-100 text-red-700"
                                : incident.prioritization?.priority_rank === "HIGH"
                                ? "bg-orange-100 text-orange-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {incident.prioritization?.priority_rank} (Rank {incident.prioritization?.priority_score})
                          </span>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <span className="text-[10px] text-slate-400 block uppercase font-mono">Escalation Tier</span>
                          <span className="font-bold text-slate-700">Tier {incident.prioritization?.escalation_level} Response</span>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <span className="text-[10px] text-slate-400 block uppercase font-mono">Prioritization Formula</span>
                          <code className="text-[10px] text-amber-800 font-mono">
                            Sev + Imp + Conf * 2 + Age
                          </code>
                        </div>
                      </div>
                    )}

                    {step.id === "resolution" && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs mb-3">
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <span className="text-[10px] text-slate-400 block uppercase font-mono">Dispatch Department</span>
                          <span className="font-bold text-slate-750">{incident.resolution?.department}</span>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-center gap-1.5">
                          <DollarSign className="w-4 h-4 text-emerald-600" />
                          <div>
                            <span className="text-[10px] text-slate-400 block uppercase font-mono">Contractor Cost (Est)</span>
                            <span className="font-mono font-bold text-slate-750">
                              ${(incident.resolution?.estimated_cost || 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-amber-500 animate-spin animate-duration-10000" />
                          <div>
                            <span className="text-[10px] text-slate-400 block uppercase font-mono">Duration (Est)</span>
                            <span className="font-mono font-bold text-slate-750">
                              {incident.resolution?.estimated_duration}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Agent Monologue thought bubble with human-face mock avatar */}
                    {activeThoughts[step.id] && step.data.agentThought && (
                      <div className="border border-slate-200 bg-slate-50 rounded-xl p-3 mt-3 relative">
                        <div className="absolute top-[-6px] left-8 w-2.5 h-2.5 bg-slate-50 border-t border-l border-slate-200 transform rotate-45" />
                        <div className="flex gap-2.5 items-start">
                          <div className="h-5 w-5 bg-slate-200 rounded-full flex items-center justify-center font-bold text-[9px] text-slate-600 font-mono mt-0.5 border border-slate-300">
                            🤖
                          </div>
                          <div>
                            <span className="text-[10px] font-bold block text-slate-800">
                              {step.name} Monologue Reasoning:
                            </span>
                            <p className="text-xs text-slate-650 italic leading-normal mt-1">
                              "{step.data.agentThought}"
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
