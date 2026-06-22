import React from "react";
import { Incident, PredictionData } from "../types";
import {
  Activity,
  ShieldCheck,
  TrendingDown,
  Hammer,
  RotateCw,
  Sliders,
  DollarSign,
  Briefcase,
  AlertTriangle,
  Brain,
  Layers,
  MapPin
} from "lucide-react";

interface OperatorViewProps {
  incidents: Incident[];
  selectedIncident: Incident | null;
  onSelectIncident: (incident: Incident) => void;
  onOperate: (
    id: string,
    updates: {
      priorityRank?: string;
      department?: string;
      estimatedCost?: number;
      estimatedDuration?: string;
      status?: string;
      approveAction?: boolean;
    }
  ) => void;
  predictionData: PredictionData | null;
  onRegeneratePredictions: () => void;
  isRegeneratingPredictions: boolean;
}

export default function OperatorView({
  incidents,
  selectedIncident,
  onSelectIncident,
  onOperate,
  predictionData,
  onRegeneratePredictions,
  isRegeneratingPredictions,
}: OperatorViewProps) {
  const [operatorTab, setOperatorTab] = React.useState<"kpis" | "forecast">("kpis");

  // Filters State
  const [filterCategory, setFilterCategory] = React.useState("ALL");
  const [filterPriority, setFilterPriority] = React.useState("ALL");

  // Edit states for overrides
  const [editDept, setEditDept] = React.useState("");
  const [editCost, setEditCost] = React.useState(0);
  const [editDuration, setEditDuration] = React.useState("");
  const [editPriority, setEditPriority] = React.useState("");

  // Populate override fields when incident selection changes
  React.useEffect(() => {
    if (selectedIncident) {
      setEditDept(selectedIncident.resolution?.department || "");
      setEditCost(selectedIncident.resolution?.estimated_cost || 0);
      setEditDuration(selectedIncident.resolution?.estimated_duration || "");
      setEditPriority(selectedIncident.prioritization?.priority_rank || "");
    }
  }, [selectedIncident]);

  // Unique lists for categories
  const categoriesList = ["ALL", "Road Infrastructure", "Water & Sewage", "Power & Grid", "Parks & Safety"];

  const filteredIncidents = incidents.filter((inc) => {
    const matchCat = filterCategory === "ALL" || inc.intake?.issue_type === filterCategory;
    const matchPri = filterPriority === "ALL" || inc.prioritization?.priority_rank === filterPriority;
    return matchCat && matchPri;
  });

  const handleApplyOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident) return;
    onOperate(selectedIncident.id, {
      department: editDept,
      estimatedCost: editCost,
      estimatedDuration: editDuration,
      priorityRank: editPriority,
    });
  };

  const markResolved = () => {
    if (!selectedIncident) return;
    onOperate(selectedIncident.id, { status: "RESOLVED" });
  };

  const approveDispatch = () => {
    if (!selectedIncident) return;
    onOperate(selectedIncident.id, { approveAction: true });
  };

  return (
    <div className="flex flex-col gap-5 h-full">
      {/* Sub tabs styled for Professional Polish */}
      <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-250">
        <button
          onClick={() => setOperatorTab("kpis")}
          className={`flex-1 text-center py-2 text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
            operatorTab === "kpis"
              ? "bg-white text-slate-900 shadow-sm border border-slate-200/50"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <Activity className="w-3.5 h-3.5 text-blue-600" />
          Operator Desk & Overrides
        </button>
        <button
          onClick={() => setOperatorTab("forecast")}
          className={`flex-1 text-center py-2 text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
            operatorTab === "forecast"
              ? "bg-white text-slate-900 shadow-sm border border-slate-200/50"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <Brain className="w-3.5 h-3.5 text-purple-600" />
          AI Predictive Intelligence
        </button>
      </div>

      {operatorTab === "kpis" ? (
        <div className="space-y-4">
          {/* Key Municipal Metrics Panels */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm text-center transition-all hover:border-slate-300">
              <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider font-mono">Verification Accuracy</span>
              <span className="text-lg font-mono font-bold tracking-tight text-slate-800">96.4%</span>
              <span className="text-[8px] text-emerald-600 block font-semibold mt-0.5">↑ 1.2% this quarter</span>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm text-center transition-all hover:border-slate-300">
              <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider font-mono">Duplicate Cut Rate</span>
              <span className="text-lg font-mono font-bold tracking-tight text-slate-800">32.8%</span>
              <span className="text-[8px] text-emerald-600 block font-semibold mt-0.5">380 duplicate tickets cut</span>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm text-center transition-all hover:border-slate-300">
              <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider font-mono">Resolution Time</span>
              <span className="text-lg font-mono font-bold tracking-tight text-slate-800">-24.2%</span>
              <span className="text-[8px] text-indigo-600 block font-semibold mt-0.5">Saved average of 4.2h</span>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm text-center transition-all hover:border-slate-300">
              <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider font-mono">Citizen Upvote Rate</span>
              <span className="text-lg font-mono font-bold tracking-tight text-slate-800">84.5%</span>
              <span className="text-[8px] text-indigo-500 block font-semibold mt-0.5">Active community audit</span>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm text-center col-span-2 md:col-span-1 transition-all hover:border-slate-300">
              <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider font-mono">Failure Forecast Score</span>
              <span className="text-lg font-mono font-bold tracking-tight text-slate-800">88.0%</span>
              <span className="text-[8px] text-rose-500 block font-semibold mt-0.5">Confidence limit achieved</span>
            </div>
          </div>

          {/* Incidents Filter Controls */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm flex flex-wrap gap-4 items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-slate-400" /> Filter Incident Feed
            </span>

            <div className="flex flex-wrap gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 text-[10px]">Category:</span>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-slate-700 outline-none focus:ring-1 focus:ring-slate-900"
                >
                  {categoriesList.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat === "ALL" ? "All Categories" : cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 text-[10px]">Priority:</span>
                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-slate-700 outline-none focus:ring-1 focus:ring-slate-900"
                >
                  <option value="ALL">All Priorities</option>
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="HIGH">HIGH</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="LOW">LOW</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* INCIDENTS LIST FOR OPERATOR */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm max-h-[350px] overflow-y-auto">
              {filteredIncidents.length === 0 ? (
                <div className="p-10 text-center text-xs text-slate-400">
                  No issues matches description.
                </div>
              ) : (
                <table className="w-full text-xs text-left text-slate-600">
                  <thead className="bg-slate-50 text-[10px] uppercase font-mono text-slate-500 border-b border-slate-100">
                    <tr>
                      <th className="p-3">Grievance Headline / ID</th>
                      <th className="p-3">Priority</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredIncidents.map((inc) => {
                      const isSel = selectedIncident?.id === inc.id;
                      let priColor = "text-slate-550 bg-slate-50";
                      if (inc.prioritization?.priority_rank === "CRITICAL") priColor = "text-red-700 bg-red-50";
                      else if (inc.prioritization?.priority_rank === "HIGH") priColor = "text-orange-700 bg-orange-50";
                      else if (inc.prioritization?.priority_rank === "MEDIUM") priColor = "text-blue-700 bg-blue-50";

                      return (
                        <tr
                          key={inc.id}
                          onClick={() => onSelectIncident(inc)}
                          className={`cursor-pointer hover:bg-slate-50/70 transition-colors ${
                            isSel ? "bg-slate-50 font-bold" : ""
                          }`}
                        >
                          <td className="p-3">
                            <span className="block text-slate-800 text-xs font-bold line-clamp-1">{inc.title}</span>
                            <span className="text-[10px] font-mono text-slate-400">{inc.id}</span>
                          </td>
                          <td className="p-3">
                            {inc.prioritization?.priority_rank ? (
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${priColor}`}>
                                {inc.prioritization.priority_rank}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">Unranked</span>
                            )}
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] uppercase font-mono tracking-wide">
                              {inc.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* OVERRIDES & DECISION CENTER */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-2 flex justify-between items-center flex-wrap gap-2">
                <h4 className="text-xs font-bold text-slate-850 uppercase tracking-wide flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-blue-500" /> Decision Dispatch override
                </h4>
                {selectedIncident && (
                  <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-mono">
                    STAT: {selectedIncident.status}
                  </span>
                )}
              </div>

              {!selectedIncident ? (
                <div className="text-center py-12 text-xs text-slate-400">
                  Select an incident from feed to override details or authorize field dispatch operations.
                </div>
              ) : !selectedIncident.resolution ? (
                <div className="text-center py-12 text-xs text-slate-500 font-medium">
                  <AlertTriangle className="w-6 h-6 text-amber-500 mx-auto mb-2" />
                  No resolution structure has been calculated.
                  <p className="text-[10px] font-normal text-slate-400 mt-1 max-w-xs mx-auto">
                    Run the multi-agent investigation first to auto-generate dispatch cost and duration metrics.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleApplyOverride} className="space-y-3.5 text-xs">
                  {selectedIncident.resolution.operatorOverridden && (
                    <div className="bg-amber-50 text-amber-800 p-2.5 rounded-lg text-[10px] border border-amber-200 font-medium">
                      ⚠️ Operator manual override in effect. Custom parameters take precedence.
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-500 font-bold mb-1">Adjust Priority</label>
                      <select
                        value={editPriority}
                        onChange={(e) => setEditPriority(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 p-2 rounded-lg text-slate-700 outline-none focus:ring-1 focus:ring-slate-900"
                      >
                        <option value="CRITICAL">CRITICAL</option>
                        <option value="HIGH">HIGH</option>
                        <option value="MEDIUM">MEDIUM</option>
                        <option value="LOW">LOW</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-500 font-bold mb-1">Assigned Department</label>
                      <input
                        type="text"
                        value={editDept}
                        onChange={(e) => setEditDept(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 p-2 rounded-lg text-slate-700 outline-none focus:ring-1 focus:ring-slate-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-500 font-bold mb-1">Est Contractor Cost ($)</label>
                      <input
                        type="number"
                        value={editCost || ""}
                        onChange={(e) => setEditCost(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 p-2 rounded-lg text-slate-700 outline-none focus:ring-1 focus:ring-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-500 font-bold mb-1">Est Completion Duration</label>
                      <input
                        type="text"
                        value={editDuration}
                        onChange={(e) => setEditDuration(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 p-2 rounded-lg text-slate-700 outline-none focus:ring-1 focus:ring-slate-900"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex flex-col gap-2">
                    <button
                      type="submit"
                      className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition-colors cursor-pointer text-center text-xs shadow"
                    >
                      Update AI Decision Vectors
                    </button>

                    <div className="grid grid-cols-2 gap-2 mt-1">
                      {selectedIncident.status !== "RESOLVED" && (
                        <button
                          type="button"
                          onClick={markResolved}
                          className="py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-center cursor-pointer shadow text-xs transition duration-150 active:scale-95"
                        >
                          Mark as RESOLVED
                        </button>
                      )}
                      {!selectedIncident.resolution.approvedByOperator && (
                        <button
                          type="button"
                          onClick={approveDispatch}
                          className="py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-center cursor-pointer shadow text-xs transition duration-150 active:scale-95"
                        >
                          Approve/Dispatch Crew
                        </button>
                      )}
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* FORECAST TIERS VIEW */
        <div className="space-y-4">
          <div className="bg-indigo-900 text-white p-5 rounded-xl block relative overflow-hidden shadow-md">
            <div className="relative z-10 max-w-xl">
              <span className="inline-flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider mb-2 text-indigo-200 uppercase">
                Autonomous Prognosis Engine
              </span>
              <h4 className="text-base font-bold mb-1">CivicMind Predictive Infrastructure Diagnostics</h4>
              <p className="text-xs text-indigo-150 leading-relaxed opacity-90">
                Prediction Agent runs scheduled telemetry and incident density cross-referencing on the city registry, modeling sub-surface, transport grid, and power distribution failure probabilities.
              </p>
              {predictionData?.agentThought && (
                <div className="mt-3.5 bg-black/25 backdrop-blur-sm border border-white/10 rounded-lg p-2.5 text-[10px] font-medium text-emerald-100 font-mono flex items-start gap-2">
                  <span className="text-sm">👁️</span>
                  <span>"{predictionData.agentThought}"</span>
                </div>
              )}
            </div>
            <div className="absolute top-0 right-0 h-full w-1/3 opacity-15 select-none pointer-events-none transform translate-x-8">
              <Layers className="h-full w-full stroke-[0.5]" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* FORCE REGENERATE CONTROL */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-3 justify-between items-center text-center">
              <div className="space-y-1">
                <Brain className="w-8 h-8 text-indigo-500 mx-auto" />
                <h5 className="text-xs font-bold text-slate-800">Forecast Horizon Refresh</h5>
                <p className="text-[10px] text-slate-400 max-w-xs">
                  Recalculate municipal density weights and thermal factors against newly declared grievances.
                </p>
              </div>
              <button
                onClick={onRegeneratePredictions}
                disabled={isRegeneratingPredictions}
                id="btn-trigger-ai-predictions"
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-900 text-white text-xs font-bold rounded-lg hover:bg-indigo-800 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isRegeneratingPredictions ? "animate-spin" : ""}`} />
                {isRegeneratingPredictions ? "Regenerating Models..." : "Force Model Regeneration"}
              </button>
            </div>

            {/* ACTIVE RISK ZONE METRIC LIST */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm md:col-span-2 space-y-3">
              <h5 className="text-xs font-bold text-slate-800 flex items-center justify-between border-b border-slate-100 pb-2">
                <span>Predicted System Vulnerability Hotspots (Spatial Circles)</span>
                <span className="text-[10px] text-slate-400">Total: {predictionData?.risk_zones.length || 0}</span>
              </h5>

              <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                {predictionData?.risk_zones.map((zone) => (
                  <div
                    key={zone.id}
                    className="flex justify-between items-center gap-3 bg-slate-50 p-2.5 rounded-lg border border-slate-100"
                  >
                    <div className="min-w-0">
                      <span className="font-bold text-xs text-slate-850 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-rose-500" />
                        {zone.zone}
                      </span>
                      <p className="text-[10px] text-slate-400 font-medium truncate">{zone.primary_vulnerability}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-xs font-bold block text-slate-800">{zone.risk_score}% Scale</span>
                      <span className="text-[8px] text-rose-600 block uppercase font-bold tracking-wide font-mono">
                        {zone.risk_score >= 80 ? "Severe threat" : "Moderated Risk"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CRITICAL FAILURE THREAT LISTING */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
            <h5 className="text-xs font-bold text-slate-800 flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="flex items-center gap-1 text-rose-650">
                <AlertTriangle className="w-4 h-4" /> Probable Impending Critical Failures
              </span>
              <span className="text-[10px] text-slate-400 font-mono">AI Forecasting Confidence Limit</span>
            </h5>

            <table className="w-full text-xs text-left text-slate-600">
              <thead className="bg-slate-50 text-[9px] uppercase font-mono text-slate-500">
                <tr>
                  <th className="p-2.5">Predicted Failure Item</th>
                  <th className="p-2.5">Location Anchor</th>
                  <th className="p-2.5">Estimated Timeframe</th>
                  <th className="p-2.5 text-right">Confidence Factor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {predictionData?.predicted_failures.map((pf) => (
                  <tr key={pf.id} className="hover:bg-slate-50/50">
                    <td className="p-2.5">
                      <span className="block font-bold text-slate-800">{pf.item}</span>
                      <span className="text-[9px] px-1 bg-slate-100 text-slate-500 rounded font-normal">{pf.category}</span>
                    </td>
                    <td className="p-2.5 text-slate-655 text-[11px] font-normal">{pf.location}</td>
                    <td className="p-2.5 font-mono text-amber-700 font-bold">{pf.estimate_time}</td>
                    <td className="p-2.5 text-right text-slate-850 font-bold font-mono">{(pf.confidence * 100).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
