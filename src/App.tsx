import React from "react";
import { Incident, PredictionData } from "./types";
import CivicMap from "./components/CivicMap";
import AgentStatusPanel from "./components/AgentStatusPanel";
import CitizenView from "./components/CitizenView";
import OperatorView from "./components/OperatorView";
import {
  ShieldCheck,
  RotateCw,
  Users,
  AlertCircle,
  Layers,
  Eye,
  MapPin,
  Trophy
} from "lucide-react";

export default function App() {
  const [incidents, setIncidents] = React.useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = React.useState<Incident | null>(null);
  const [predictionData, setPredictionData] = React.useState<PredictionData | null>(null);
  const [activeRole, setActiveRole] = React.useState<"citizen" | "operator">("operator");

  // Loading states
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Agent execution simulation states
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [analysisStep, setAnalysisStep] = React.useState(0);

  // Map overlays & pins
  const [showRiskZones, setShowRiskZones] = React.useState(true);
  const [isPinMode, setIsPinMode] = React.useState(false);
  const [tempPin, setTempPin] = React.useState<{ lat: number; lng: number; address: string } | null>(null);

  // Predictions refresh
  const [isRegeneratingPredictions, setIsRegeneratingPredictions] = React.useState(false);

  // Gamification: user profile state
  const [currentUser, setCurrentUser] = React.useState<{
    email: string;
    name: string;
    avatar?: string;
    points: number;
    reports_filed: number;
    evidence_submitted: number;
  } | null>(null);

  // Fetch all incidents and predictions
  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      const incRes = await fetch("/api/incidents");
      if (!incRes.ok) throw new Error("Could not acquire municipal incidents list.");
      const incs: Incident[] = await incRes.json();
      setIncidents(incs);

      // Auto-select first incident on mount if none selected
      if (incs.length > 0 && !selectedIncident) {
        setSelectedIncident(incs[0]);
      }

      const predRes = await fetch("/api/predictions");
      if (predRes.ok) {
        const pred: PredictionData = await predRes.json();
        setPredictionData(pred);
      }
      setErrorMsg(null);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Municipal registry is temporarily offline.");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch or create user profile in PostgreSQL
  const fetchUserProfile = async (email: string, name: string) => {
    try {
      const res = await fetch("/api/users/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });
      if (res.ok) {
        const profile = await res.json();
        setCurrentUser(profile);
      }
    } catch (err) {
      console.error("Failed to load user profile:", err);
    }
  };

  React.useEffect(() => {
    fetchAllData();
    // Default active profile on boot
    fetchUserProfile("citizen@metropolis.mail", "Sarah Connor");
  }, []);

  const selectIncident = (inc: Incident) => {
    setSelectedIncident(inc);
  };

  // Run the 6-agent sequential AI process
  const runAgentWorkflow = async () => {
    if (!selectedIncident) return;
    setIsAnalyzing(true);
    setAnalysisStep(0);

    const stepIntervals = [1000, 1000, 1000, 1000, 1200];
    
    // Stagger through steps Intake -> Verification -> Impact -> Prioritization -> Resolution
    for (let s = 1; s <= 5; s++) {
      await new Promise((resolve) => setTimeout(resolve, stepIntervals[s - 1]));
      if (s < 5) {
        setAnalysisStep(s);
      }
    }

    try {
      const res = await fetch(`/api/incidents/${selectedIncident.id}/analyze`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Agentic pipeline failure.");
      const updated: Incident = await res.json();
      
      // Update local ledger
      setIncidents((prev) => prev.map((inc) => (inc.id === updated.id ? updated : inc)));
      setSelectedIncident(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Citizen submission
  const handleSubmitIncident = async (data: {
    title: string;
    rawDescription: string;
    address: string;
    lat: number;
    lng: number;
    reporterName: string;
    reporterEmail: string;
    imageUrl?: string;
  }) => {
    try {
      const res = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Submission rejected by municipal server.");
      const newInc: Incident = await res.json();
      setIncidents((prev) => [newInc, ...prev]);
      setSelectedIncident(newInc);
      setTempPin(null);

      // Refresh current user profile points
      if (currentUser) {
        fetchUserProfile(currentUser.email, currentUser.name);
      }
    } catch (err: any) {
      alert(err.message || "Failed to submit.");
    }
  };

  // Upvote/Downvote community verification
  const handleVote = async (id: string, type: "up" | "down") => {
    try {
      const res = await fetch(`/api/incidents/${id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          type,
          voterEmail: currentUser?.email || "anonymous@citizen.net",
          voterName: currentUser?.name || "Anonymous Citizen"
        }),
      });
      if (res.ok) {
        const updated: Incident = await res.json();
        setIncidents((prev) => prev.map((inc) => (inc.id === updated.id ? updated : inc)));
        setSelectedIncident(updated);

        // Refresh points
        if (currentUser) {
          fetchUserProfile(currentUser.email, currentUser.name);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Add ground evidence comment
  const handleAddEvidence = async (id: string, author: string, text: string) => {
    try {
      const res = await fetch(`/api/incidents/${id}/evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          author, 
          text,
          commenterEmail: currentUser?.email || "anonymous@citizen.net"
        }),
      });
      if (res.ok) {
        const updated: Incident = await res.json();
        setIncidents((prev) => prev.map((inc) => (inc.id === updated.id ? updated : inc)));
        setSelectedIncident(updated);

        // Refresh points
        if (currentUser) {
          fetchUserProfile(currentUser.email, currentUser.name);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Municipal operator override
  const handleOperate = async (
    id: string,
    updates: {
      priorityRank?: string;
      department?: string;
      estimatedCost?: number;
      estimatedDuration?: string;
      status?: string;
      approveAction?: boolean;
    }
  ) => {
    try {
      const res = await fetch(`/api/incidents/${id}/operate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const updated: Incident = await res.json();
        setIncidents((prev) => prev.map((inc) => (inc.id === updated.id ? updated : inc)));
        setSelectedIncident(updated);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Force system forecast predictions
  const handleRegeneratePredictions = async () => {
    setIsRegeneratingPredictions(true);
    try {
      const res = await fetch("/api/predictions/regenerate", {
        method: "POST",
      });
      if (res.ok) {
        const updatedPred: PredictionData = await res.json();
        setPredictionData(updatedPred);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsRegeneratingPredictions(false);
    }
  };

  // Map pin selected
  const handleMapPinSelected = (lat: number, lng: number, address: string) => {
    setTempPin({ lat, lng, address });
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans flex flex-col antialiased">
      {/* Top Navigation Header - Professional Polish Theme */}
      <nav className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-white rotate-45"></div>
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-800">
            Civic<span className="text-blue-600">Mind</span>
          </span>
          <span className="ml-3 px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-widest rounded hidden sm:inline-block">
            Mission Control v2.5
          </span>
        </div>

        <div className="flex items-center gap-6">
          {currentUser && (
            <div className="hidden sm:flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1 rounded-lg">
              <Trophy className="w-4 h-4 text-amber-500" />
              <div className="text-xs">
                <span className="font-semibold text-slate-700">{currentUser.name}</span>
                <span className="ml-1.5 px-1.5 py-0.5 bg-blue-150 text-blue-800 text-[9px] font-bold rounded font-mono uppercase">
                  {currentUser.points} pts
                </span>
              </div>
            </div>
          )}

          <div className="hidden md:flex gap-6 items-center border-r border-slate-200 pr-6">
            <div className="text-right">
              <div className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">Health Score</div>
              <div className="text-base font-mono font-bold text-emerald-600">94.2%</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">Active Agents</div>
              <div className="text-base font-mono font-bold text-slate-800">06/06</div>
            </div>
          </div>

          {/* Core Multirole Toggle */}
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 shadow-inner">
            <button
              onClick={() => {
                setActiveRole("operator");
                if (isPinMode) setIsPinMode(false);
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                activeRole === "operator"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
              <span>Control Tower</span>
            </button>
            <button
              onClick={() => setActiveRole("citizen")}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                activeRole === "citizen"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Users className="w-3.5 h-3.5 text-emerald-500" />
              <span>Citizen Portal</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Grid split */}
      <main className="flex-1 p-5 overflow-auto max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5">
        {isLoading ? (
          <div className="col-span-12 flex flex-col items-center justify-center py-36">
            <RotateCw className="w-8 h-8 text-slate-400 animate-spin mb-3" />
            <p className="text-xs text-slate-500 font-medium font-mono">Initializing CivicMind Datagrids...</p>
          </div>
        ) : errorMsg ? (
          <div className="col-span-12 bg-rose-50 border border-rose-200 p-6 rounded-xl text-center max-w-md mx-auto my-12 space-y-3">
            <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
            <h3 className="font-bold text-slate-800">Critical Error</h3>
            <p className="text-xs text-slate-600">{errorMsg}</p>
            <button
              onClick={fetchAllData}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold cursor-pointer"
            >
              Retry Connection
            </button>
          </div>
        ) : (
          <>
            {/* LEFT AREA: MAP AND AGENTS STREAM */}
            <section className="lg:col-span-7 flex flex-col gap-5">
              {/* INTERACTIVE LEAFLET MAP */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      Metropolitan Spatial Grid Modeling
                    </h2>
                    <p className="text-[10px] text-slate-400">
                      Toggle overlay zones to analyze forecasting patterns. Locations resolve automatically on map load.
                    </p>
                  </div>

                  <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 font-semibold cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showRiskZones}
                      onChange={(e) => setShowRiskZones(e.target.checked)}
                      className="rounded border-slate-300 text-rose-600 focus:ring-0 cursor-pointer h-3.5 w-3.5"
                    />
                    <Layers className="w-3.5 h-3.5 text-slate-400" /> Layer: Forecast Hotspots
                  </label>
                </div>

                <CivicMap
                  incidents={incidents}
                  selectedIncident={selectedIncident}
                  onSelectIncident={selectIncident}
                  riskZones={predictionData?.risk_zones || []}
                  showRiskZones={showRiskZones}
                  interactiveMode={isPinMode ? "pin" : "select"}
                  onMapPinSelected={handleMapPinSelected}
                  tempPin={tempPin}
                />
              </div>

              {/* AGENT STATUS TIMELINE CARD */}
              {selectedIncident && (
                <AgentStatusPanel
                  incident={selectedIncident}
                  onAnalyze={runAgentWorkflow}
                  isAnalyzing={isAnalyzing}
                  activeStep={analysisStep}
                />
              )}
            </section>

            {/* RIGHT AREA: ROLE SPECIFIC PANELS */}
            <section className="lg:col-span-5 flex flex-col gap-5">
              {activeRole === "citizen" ? (
                <CitizenView
                  incidents={incidents}
                  selectedIncident={selectedIncident}
                  onSelectIncident={selectIncident}
                  onSubmitIncident={handleSubmitIncident}
                  onVote={handleVote}
                  onAddEvidence={handleAddEvidence}
                  isPinMode={isPinMode}
                  onTogglePinMode={() => setIsPinMode(!isPinMode)}
                  tempPin={tempPin}
                  currentUser={currentUser}
                  onProfileChange={fetchUserProfile}
                />
              ) : (
                <OperatorView
                  incidents={incidents}
                  selectedIncident={selectedIncident}
                  onSelectIncident={selectIncident}
                  onOperate={handleOperate}
                  predictionData={predictionData}
                  onRegeneratePredictions={handleRegeneratePredictions}
                  isRegeneratingPredictions={isRegeneratingPredictions}
                />
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
