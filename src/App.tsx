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
  Trophy,
  LogOut,
  User as UserIcon,
  Mail,
  Lock
} from "lucide-react";

type PortalUser = {
  email: string;
  name: string;
  role: "citizen" | "operator";
};

const createPortalToken = (user: PortalUser) =>
  `civicmind.${btoa(JSON.stringify(user)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;

export default function App() {
  const [firebaseUser, setFirebaseUser] = React.useState<PortalUser | null>(null);
  const [authToken, setAuthToken] = React.useState<string | null>(null);
  const [currentUser, setCurrentUser] = React.useState<{
    email: string;
    name: string;
    avatar?: string;
    points: number;
    reports_filed: number;
    evidence_submitted: number;
    role: "citizen" | "operator";
  } | null>(null);

  const [incidents, setIncidents] = React.useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = React.useState<Incident | null>(null);
  const [predictionData, setPredictionData] = React.useState<PredictionData | null>(null);
  const [activeRole, setActiveRole] = React.useState<"citizen" | "operator">("citizen");

  // Loading states
  const [isLoading, setIsLoading] = React.useState(true);
  const [authChecking, setAuthChecking] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Auth UI Form State
  const [isLogin, setIsLogin] = React.useState(true);
  const [authForm, setAuthForm] = React.useState({
    email: "",
    password: "",
    name: "",
    role: "citizen" as "citizen" | "operator"
  });
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [authLoading, setAuthLoading] = React.useState(false);

  // Agent execution simulation states
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [analysisStep, setAnalysisStep] = React.useState(0);

  // Map overlays & pins
  const [showRiskZones, setShowRiskZones] = React.useState(true);
  const [isPinMode, setIsPinMode] = React.useState(false);
  const [tempPin, setTempPin] = React.useState<{ lat: number; lng: number; address: string } | null>(null);

  // Predictions refresh
  const [isRegeneratingPredictions, setIsRegeneratingPredictions] = React.useState(false);

  // Track Auth state changes
  React.useEffect(() => {
    const saved = localStorage.getItem("civicmind.portalUser");
    if (!saved) {
      setAuthChecking(false);
      return;
    }

    try {
      const user = JSON.parse(saved) as PortalUser;
      const token = createPortalToken(user);
      setFirebaseUser(user);
      setAuthToken(token);
      fetchUserProfile(token, user.email, user.name, user.role);
    } catch {
      localStorage.removeItem("civicmind.portalUser");
      setAuthChecking(false);
    }
  }, []);

  // Fetch or create user profile on backend
  const fetchUserProfile = async (token: string, email: string, name?: string, requestedRole?: string) => {
    try {
      const res = await fetch("/api/users/profile", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ email, name, role: requestedRole }),
      });
      if (res.ok) {
        const profile = await res.json();
        setCurrentUser(profile);
        setActiveRole(profile.role);
      }
    } catch (err) {
      console.error("Failed to load user profile:", err);
    } finally {
      setAuthChecking(false);
    }
  };

  // Trigger profile fetch when firebaseUser and token is available
  React.useEffect(() => {
    if (firebaseUser && authToken) {
      // If we just registered, we pass authForm details. Otherwise just fetch.
      fetchUserProfile(authToken, firebaseUser.email || "", firebaseUser.name || authForm.name || undefined, firebaseUser.role || authForm.role || undefined);
    }
  }, [firebaseUser, authToken]);

  // Fetch all incidents and predictions
  const fetchAllData = async () => {
    if (!authToken) return;
    setIsLoading(true);
    try {
      const headers = { "Authorization": `Bearer ${authToken}` };
      
      const incRes = await fetch("/api/incidents", { headers });
      if (!incRes.ok) throw new Error("Could not acquire municipal incidents list.");
      const incs: Incident[] = await incRes.json();
      setIncidents(incs);

      if (incs.length > 0 && !selectedIncident) {
        setSelectedIncident(incs[0]);
      }

      const predRes = await fetch("/api/predictions", { headers });
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

  // Trigger data fetch on login
  React.useEffect(() => {
    if (currentUser && authToken) {
      fetchAllData();
    }
  }, [currentUser, authToken]);

  const selectIncident = (inc: Incident) => {
    setSelectedIncident(inc);
  };

  // Run the 6-agent sequential AI process
  const runAgentWorkflow = async () => {
    if (!selectedIncident || !authToken) return;
    setIsAnalyzing(true);
    setAnalysisStep(0);

    const stepIntervals = [1000, 1000, 1000, 1000, 1200];
    for (let s = 1; s <= 5; s++) {
      await new Promise((resolve) => setTimeout(resolve, stepIntervals[s - 1]));
      if (s < 5) {
        setAnalysisStep(s);
      }
    }

    try {
      const res = await fetch(`/api/incidents/${selectedIncident.id}/analyze`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${authToken}` }
      });
      if (!res.ok) throw new Error("Agentic pipeline failure.");
      const updated: Incident = await res.json();
      
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
    if (!authToken || !currentUser) return;
    try {
      const res = await fetch("/api/incidents", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`
        },
        body: JSON.stringify({
          ...data,
          reporterName: currentUser.name,
          reporterEmail: currentUser.email
        }),
      });
      if (!res.ok) throw new Error("Submission rejected by municipal server.");
      const newInc: Incident = await res.json();
      setIncidents((prev) => [newInc, ...prev]);
      setSelectedIncident(newInc);
      setTempPin(null);

      // Refresh current user profile points
      fetchUserProfile(authToken, currentUser.email);
    } catch (err: any) {
      alert(err.message || "Failed to submit.");
    }
  };

  // Upvote/Downvote community verification
  const handleVote = async (id: string, type: "up" | "down") => {
    if (!authToken || !currentUser) return;
    try {
      const res = await fetch(`/api/incidents/${id}/vote`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`
        },
        body: JSON.stringify({ 
          type,
          voterEmail: currentUser.email,
          voterName: currentUser.name
        }),
      });
      if (res.ok) {
        const updated: Incident = await res.json();
        setIncidents((prev) => prev.map((inc) => (inc.id === updated.id ? updated : inc)));
        setSelectedIncident(updated);
        fetchUserProfile(authToken, currentUser.email);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Add ground evidence comment
  const handleAddEvidence = async (id: string, author: string, text: string) => {
    if (!authToken || !currentUser) return;
    try {
      const res = await fetch(`/api/incidents/${id}/evidence`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`
        },
        body: JSON.stringify({ 
          author: currentUser.name, 
          text,
          commenterEmail: currentUser.email
        }),
      });
      if (res.ok) {
        const updated: Incident = await res.json();
        setIncidents((prev) => prev.map((inc) => (inc.id === updated.id ? updated : inc)));
        setSelectedIncident(updated);
        fetchUserProfile(authToken, currentUser.email);
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
    if (!authToken) return;
    try {
      const res = await fetch(`/api/incidents/${id}/operate`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`
        },
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
    if (!authToken) return;
    setIsRegeneratingPredictions(true);
    try {
      const res = await fetch("/api/predictions/regenerate", {
        method: "POST",
        headers: { "Authorization": `Bearer ${authToken}` }
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

  // Auth form submissions
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    try {
      if (!authForm.email.trim()) throw new Error("Email is required.");
      if (!authForm.password.trim()) throw new Error("Security key is required.");

      const portalUser: PortalUser = {
        email: authForm.email.trim(),
        name:
          authForm.name.trim() ||
          authForm.email
            .split("@")[0]
            .replace(/[._-]+/g, " ")
            .replace(/\b\w/g, (char) => char.toUpperCase()) ||
          "CivicMind User",
        role: authForm.role,
      };
      const token = createPortalToken(portalUser);
      localStorage.setItem("civicmind.portalUser", JSON.stringify(portalUser));
      setFirebaseUser(portalUser);
      setAuthToken(token);
      await fetchUserProfile(token, portalUser.email, portalUser.name, portalUser.role);
    } catch (err: any) {
      console.error(err);
      setAuthError(err.message || "Authentication failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("civicmind.portalUser");
    setFirebaseUser(null);
    setAuthToken(null);
    setCurrentUser(null);
    setIncidents([]);
    setPredictionData(null);
    setAuthChecking(false);
  };

  // Auth Gate Interface
  if (authChecking || (!firebaseUser && authLoading)) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center">
        <RotateCw className="w-8 h-8 text-blue-600 animate-spin mb-3" />
        <p className="text-xs text-slate-500 font-mono">Authenticating Portal Credentials...</p>
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 relative overflow-hidden">
        {/* Dynamic Glowing Accents */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-md w-full backdrop-blur-md bg-white/10 border border-white/20 p-8 rounded-2xl shadow-2xl relative z-10 text-white space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex w-12 h-12 bg-blue-600 rounded-xl items-center justify-center shadow-lg shadow-blue-500/30">
              <div className="w-6 h-6 border-4 border-white rotate-45" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">
              Civic<span className="text-blue-400">Mind</span>
            </h2>
            <p className="text-xs text-slate-350">
              {isLogin ? "Sign in to access your metropolitan command workspace" : "Register a municipal grid profile"}
            </p>
          </div>

          {authError && (
            <div className="bg-rose-500/20 border border-rose-500/30 p-3 rounded-lg text-xs text-rose-350 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Full Name</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="Enter your name"
                    value={authForm.name}
                    onChange={(e) => setAuthForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 text-white text-xs pl-9 pr-4 py-2.5 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  placeholder="name@metropolis.gov"
                  value={authForm.email}
                  onChange={(e) => setAuthForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 text-white text-xs pl-9 pr-4 py-2.5 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Security Key</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={authForm.password}
                  onChange={(e) => setAuthForm(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 text-white text-xs pl-9 pr-4 py-2.5 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            {!isLogin && (
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Workspace Role</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAuthForm(prev => ({ ...prev, role: "citizen" }))}
                    className={`py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      authForm.role === "citizen"
                        ? "bg-blue-600 border-blue-500 text-white"
                        : "bg-white/5 border-white/10 text-slate-400"
                    }`}
                  >
                    Citizen Portal
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthForm(prev => ({ ...prev, role: "operator" }))}
                    className={`py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      authForm.role === "operator"
                        ? "bg-blue-600 border-blue-500 text-white"
                        : "bg-white/5 border-white/10 text-slate-400"
                    }`}
                  >
                    Control Tower
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white py-2.5 rounded-lg text-xs font-bold shadow-lg shadow-blue-600/20 transition-all cursor-pointer flex items-center justify-center"
            >
              {authLoading ? (
                <RotateCw className="w-4 h-4 animate-spin" />
              ) : isLogin ? (
                "Enter Command Workspace"
              ) : (
                "Register Workspace Profile"
              )}
            </button>
          </form>

          <div className="text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setAuthError(null);
              }}
              className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              {isLogin ? "Need a new account? Register here" : "Already have a profile? Login here"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans flex flex-col antialiased">
      {/* Top Navigation Header */}
      <nav className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-white rotate-45"></div>
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-800">
            Civic<span className="text-blue-600">Mind</span>
          </span>
          <span className="ml-3 px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-widest rounded hidden sm:inline-block">
            Mission Control v3.0
          </span>
        </div>

        <div className="flex items-center gap-6">
          {currentUser && (
            <div className="hidden sm:flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1 rounded-lg">
              <Trophy className="w-4 h-4 text-amber-500" />
              <div className="text-xs">
                <span className="font-semibold text-slate-700">{currentUser.name}</span>
                <span className="ml-1.5 px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[9px] font-bold rounded font-mono uppercase">
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

          {/* Conditional Role Switcher based on Server Role Claim */}
          {currentUser?.role === "operator" ? (
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
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-250 text-emerald-800 rounded-lg text-xs font-bold">
              <Users className="w-3.5 h-3.5 text-emerald-600" />
              <span>Citizen Portal</span>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Log Out Profile"
          >
            <LogOut className="w-4 h-4" />
          </button>
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
                  onProfileChange={(email, name) => fetchUserProfile(authToken || "", email, name)}
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
