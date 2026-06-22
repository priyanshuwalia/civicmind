import React from "react";
import { Incident } from "../types";
import {
  PlusCircle,
  MapPin,
  Send,
  ThumbsUp,
  ThumbsDown,
  CheckCircle,
  MessageSquare,
  Trophy,
  Award,
  ChevronRight,
  User,
  Image as ImageIcon
} from "lucide-react";

const getPortalToken = () => {
  const saved = localStorage.getItem("civicmind.portalUser");
  if (!saved) return "civicmind.e30";
  return `civicmind.${btoa(saved).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
};

interface CitizenViewProps {
  incidents: Incident[];
  selectedIncident: Incident | null;
  onSelectIncident: (incident: Incident) => void;
  onSubmitIncident: (data: {
    title: string;
    rawDescription: string;
    address: string;
    lat: number;
    lng: number;
    reporterName: string;
    reporterEmail: string;
    imageUrl?: string;
  }) => void;
  onVote: (id: string, type: "up" | "down") => void;
  onAddEvidence: (id: string, author: string, text: string) => void;
  isPinMode: boolean;
  onTogglePinMode: () => void;
  tempPin: { lat: number; lng: number; address: string } | null;
  currentUser: {
    email: string;
    name: string;
    avatar?: string;
    points: number;
    reports_filed: number;
    evidence_submitted: number;
  } | null;
  onProfileChange: (email: string, name: string) => void;
}

export default function CitizenView({
  incidents,
  selectedIncident,
  onSelectIncident,
  onSubmitIncident,
  onVote,
  onAddEvidence,
  isPinMode,
  onTogglePinMode,
  tempPin,
  currentUser,
  onProfileChange,
}: CitizenViewProps) {
  const [activeTab, setActiveTab] = React.useState<"list" | "report" | "leaderboard">("list");

  // Form State
  const [formData, setFormData] = React.useState({
    title: "",
    rawDescription: "",
    address: "",
    reporterName: "",
    reporterEmail: "",
  });

  // Profile setup toggle/inputs inside leaderboard view
  const [isEditingProfile, setIsEditingProfile] = React.useState(false);
  const [profileForm, setProfileForm] = React.useState({
    name: currentUser?.name || "Sarah Connor",
    email: currentUser?.email || "citizen@metropolis.mail",
  });

  // Evidence comment inputs
  const [commenter, setCommenter] = React.useState("");
  const [commentText, setCommentText] = React.useState("");
  const [evidenceSuccess, setEvidenceSuccess] = React.useState(false);

  // Upload state
  const [uploadingImage, setUploadingImage] = React.useState(false);
  const [imagePreview, setImagePreview] = React.useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = React.useState<string | null>(null);

  // Leaderboard data
  const [leaderboard, setLeaderboard] = React.useState<any[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = React.useState(false);

  // Synchronize temp pin to address field
  React.useEffect(() => {
    if (tempPin) {
      setFormData((prev) => ({
        ...prev,
        address: tempPin.address,
      }));
    }
  }, [tempPin]);

  // Sync edits if currentUser refreshes
  React.useEffect(() => {
    if (currentUser) {
      setProfileForm({
        name: currentUser.name,
        email: currentUser.email,
      });
      // Also default commenter name to active user name
      if (!commenter) {
        setCommenter(currentUser.name);
      }
    }
  }, [currentUser]);

  // Fetch leaderboard data when leaderboard tab becomes active
  const fetchLeaderboard = async () => {
    setIsLoadingLeaderboard(true);
    try {
      const token = getPortalToken();
      const res = await fetch("/api/users/leaderboard", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data);
      }
    } catch (err) {
      console.error("Leaderboard fetch error:", err);
    } finally {
      setIsLoadingLeaderboard(false);
    }
  };

  React.useEffect(() => {
    if (activeTab === "leaderboard") {
      fetchLeaderboard();
    }
  }, [activeTab, currentUser]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);

    const previewReader = new FileReader();
    previewReader.onloadend = () => {
      setImagePreview(previewReader.result as string);
    };
    previewReader.readAsDataURL(file);

    const uploadReader = new FileReader();
    uploadReader.onloadend = async () => {
      try {
        const token = getPortalToken();
        const response = await fetch("/api/upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ image: uploadReader.result }),
        });
        if (!response.ok) throw new Error("Image upload failed");
        const data = await response.json();
        setUploadedUrl(data.imageUrl);
      } catch (err) {
        console.error("Upload error:", err);
        alert("Failed to upload image. Please try again.");
        setImagePreview(null);
      } finally {
        setUploadingImage(false);
      }
    };
    uploadReader.readAsDataURL(file);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.rawDescription) return;

    onSubmitIncident({
      title: formData.title,
      rawDescription: formData.rawDescription,
      address: formData.address || "100 Broadway St, Metropolis",
      lat: tempPin?.lat || 37.7749 + (Math.random() - 0.5) * 0.02,
      lng: tempPin?.lng || -122.4194 + (Math.random() - 0.5) * 0.02,
      reporterName: currentUser?.name || formData.reporterName || "Civic Citizen",
      reporterEmail: currentUser?.email || formData.reporterEmail || "citizen@metropolis.mail",
      imageUrl: uploadedUrl || undefined,
    });

    setFormData({
      title: "",
      rawDescription: "",
      address: "",
      reporterName: "",
      reporterEmail: "",
    });
    setImagePreview(null);
    setUploadedUrl(null);
    if (isPinMode) onTogglePinMode();
    setActiveTab("list");
  };

  const submitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident || !commenter || !commentText) return;

    onAddEvidence(selectedIncident.id, commenter, commentText);
    setCommentText("");
    setEvidenceSuccess(true);
    setTimeout(() => setEvidenceSuccess(false), 3000);
  };

  const handleProfileUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onProfileChange(profileForm.email, profileForm.name);
    setIsEditingProfile(false);
  };

  // League details based on score
  const getLeague = (pts: number) => {
    if (pts >= 1000) return { name: "Diamond League", color: "from-cyan-500 to-blue-600 text-cyan-50 border-cyan-400/50 shadow-cyan-100", threshold: Infinity, next: null };
    if (pts >= 400) return { name: "Platinum League", color: "from-indigo-500 to-purple-600 text-indigo-50 border-indigo-400/50 shadow-indigo-100", threshold: 1000, next: "Diamond" };
    if (pts >= 150) return { name: "Gold League", color: "from-amber-400 to-orange-500 text-amber-50 border-amber-400/50 shadow-amber-100", threshold: 400, next: "Platinum" };
    if (pts >= 50) return { name: "Silver League", color: "from-slate-300 to-slate-500 text-slate-50 border-slate-450/40 shadow-slate-100", threshold: 150, next: "Gold" };
    return { name: "Bronze League", color: "from-amber-700 to-amber-900 text-amber-50 border-amber-900/20 shadow-amber-50", threshold: 50, next: "Silver" };
  };

  const pts = currentUser?.points || 0;
  const league = getLeague(pts);
  const prevThreshold = league.name === "Bronze League" ? 0 : league.name === "Silver League" ? 50 : league.name === "Gold League" ? 150 : league.name === "Platinum League" ? 400 : 1000;
  const nextTarget = league.threshold;
  const range = nextTarget - prevThreshold;
  const progressPercent = nextTarget === Infinity ? 100 : Math.min(100, Math.max(0, ((pts - prevThreshold) / range) * 100));

  return (
    <div className="flex flex-col gap-5 h-full">
      {/* Sub tabs */}
      <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
        <button
          onClick={() => {
            setActiveTab("list");
            if (isPinMode) onTogglePinMode();
          }}
          className={`flex-1 text-center py-2 text-xs font-bold rounded-lg cursor-pointer transition-all ${
            activeTab === "list" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-850"
          }`}
        >
          Active Log
        </button>
        <button
          onClick={() => setActiveTab("report")}
          className={`flex-1 text-center py-2 text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "report" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-850"
          }`}
        >
          <PlusCircle className="w-3.5 h-3.5 text-blue-500" />
          New Report
        </button>
        <button
          onClick={() => {
            setActiveTab("leaderboard");
            if (isPinMode) onTogglePinMode();
          }}
          className={`flex-1 text-center py-2 text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "leaderboard" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-850"
          }`}
        >
          <Trophy className="w-3.5 h-3.5 text-amber-500" />
          Leagues
        </button>
      </div>

      {activeTab === "list" ? (
        <div className="space-y-4">
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm max-h-[300px] overflow-y-auto">
            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Metropolitan Active Incident Log
            </div>
            {incidents.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No tickets submitted yet. Fill a new grievance to instantiate the multi-agent queue!
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {incidents.map((inc) => {
                  const isSel = selectedIncident?.id === inc.id;
                  let cardTypeBadge = "bg-blue-50 text-blue-700";
                  if (inc.status === "RESOLVING") cardTypeBadge = "bg-red-50 text-red-700";
                  else if (inc.status === "RESOLVED") cardTypeBadge = "bg-emerald-50 text-emerald-700";
                  else if (inc.status === "PRIORITIZED") cardTypeBadge = "bg-orange-50 text-orange-700";

                  return (
                    <div
                      key={inc.id}
                      onClick={() => onSelectIncident(inc)}
                      className={`p-3.5 hover:bg-slate-55/70 transition-all cursor-pointer flex gap-3 items-start ${
                        isSel ? "bg-blue-50/40 border-l-4 border-blue-600 shadow-sm" : "bg-white border-l-4 border-transparent"
                      }`}
                    >
                      <div className="h-2.5 w-2.5 rounded-full mt-1.5 flex-shrink-0" style={{
                        backgroundColor: inc.status === "RESOLVING" ? "#ef4444" : inc.status === "RESOLVED" ? "#10b981" : inc.status === "PRIORITIZED" ? "#f97316" : "#3b82f6"
                      }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-bold text-slate-800 truncate">{inc.title}</span>
                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex-shrink-0 ${cardTypeBadge}`}>
                            {inc.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate mb-1.5">{inc.rawDescription}</p>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                          <span className="flex items-center gap-1 font-medium">
                            <MapPin className="w-3 h-3 text-slate-400" /> {inc.location.address}
                          </span>
                          <span className="font-medium">{new Date(inc.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ACTIVE DISASTER CARD DETAILS */}
          {selectedIncident && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-4">
              <div>
                <div className="flex items-center justify-between flex-wrap gap-2 mb-1.5">
                  <h4 className="text-sm font-bold text-slate-800">{selectedIncident.title}</h4>
                  <span className="text-[10px] text-slate-400 font-mono border border-slate-100 px-1.5 py-0.5 rounded">
                    ID: {selectedIncident.id}
                  </span>
                </div>

                {/* Render Incident Photo evidence if it exists */}
                {selectedIncident.imageUrl && (
                  <div className="w-full h-48 bg-slate-50 border border-slate-200 rounded-lg overflow-hidden shadow-inner flex items-center justify-center mb-3">
                    <img src={selectedIncident.imageUrl} alt={selectedIncident.title} className="object-cover w-full h-full" />
                  </div>
                )}

                <p className="text-xs text-slate-600 bg-slate-50 border border-slate-100 p-3 rounded-lg leading-relaxed">
                  {selectedIncident.rawDescription}
                </p>
              </div>

              {/* Citizen feedback metrics */}
              <div className="border-t border-b border-slate-100 py-3 flex items-center justify-between flex-wrap gap-3">
                <div className="text-xs text-slate-600 font-medium">
                  Has this issue impacted you? Vote to confirm authenticity:
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onVote(selectedIncident.id, "up")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200/60 active:scale-95 transition-transform cursor-pointer"
                  >
                    <ThumbsUp className="w-3.5 h-3.5 text-blue-500" />
                    Affirm (+{selectedIncident.upvotes})
                  </button>
                  <button
                    onClick={() => onVote(selectedIncident.id, "down")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200/60 active:scale-95 transition-transform cursor-pointer"
                  >
                    <ThumbsDown className="w-3.5 h-3.5 text-red-500" />
                    Refute ({selectedIncident.downvotes})
                  </button>
                </div>
              </div>

              {/* On-the-ground updates stack */}
              <div className="space-y-3">
                <h5 className="text-xs font-bold text-slate-750 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                  Ground updates & Evidence logs ({selectedIncident.evidence.length})
                </h5>

                {selectedIncident.evidence.length > 0 && (
                  <div className="space-y-2 max-h-24 overflow-y-auto">
                    {selectedIncident.evidence.map((ev) => (
                      <div key={ev.id} className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-[11px]">
                        <div className="flex justify-between text-[9px] text-slate-400 font-mono mb-0.5">
                          <span className="font-semibold text-slate-600">{ev.author}</span>
                          <span>{new Date(ev.createdAt).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-slate-655 font-normal">{ev.text}</p>
                      </div>
                    ))}
                  </div>
                )}

                <form onSubmit={submitComment} className="flex gap-2">
                  <div className="flex-1 space-y-1.5">
                    <input
                      type="text"
                      placeholder="Your Name (e.g. Inspector Sarah)"
                      value={commenter}
                      onChange={(e) => setCommenter(e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400"
                    />
                    <input
                      type="text"
                      placeholder="Add auxiliary observation or photo link..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400"
                    />
                  </div>
                  <button
                    type="submit"
                    className="self-end px-3 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
                {evidenceSuccess && (
                  <div className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Over-the-ground report broadcast successfully!
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : activeTab === "report" ? (
        /* DISASTER FILING FORM */
        <form onSubmit={handleFormSubmit} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-2 mb-2">
            <h4 className="text-xs font-bold text-slate-850 uppercase tracking-wide">File Municipal Incident</h4>
            <p className="text-[10px] text-slate-500">Provide direct details to launch automatic AI investigation.</p>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-550 font-bold mb-1">Grievance Headline *</label>
              <input
                type="text"
                name="title"
                required
                value={formData.title}
                onChange={handleInputChange}
                placeholder="e.g., Burst underground water pipeline"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-slate-550 font-bold mb-1">Describe on-the-scene Details *</label>
              <textarea
                name="rawDescription"
                required
                value={formData.rawDescription}
                onChange={handleInputChange}
                rows={3}
                placeholder="Mention severity indicators: arcing wires, flooding depth, size of pothole, safety concerns..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            {/* Evidence Image Upload Field */}
            <div>
              <label className="block text-slate-550 font-bold mb-1 flex items-center gap-1">
                <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
                Evidence Photo (Optional)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white file:cursor-pointer hover:file:bg-slate-800"
                />
                {uploadingImage && (
                  <span className="text-[10px] text-yellow-600 font-semibold animate-pulse flex-shrink-0">
                    Uploading...
                  </span>
                )}
              </div>
              {imagePreview && (
                <div className="mt-3 relative w-full h-32 bg-slate-50 border border-slate-200 rounded-lg overflow-hidden flex items-center justify-center">
                  <img src={imagePreview} alt="Upload preview" className="object-cover w-full h-full" />
                  <button
                    type="button"
                    onClick={() => {
                      setImagePreview(null);
                      setUploadedUrl(null);
                    }}
                    className="absolute top-1.5 right-1.5 bg-red-500 hover:bg-red-650 text-white rounded-full px-2 py-0.5 text-[9px] font-bold cursor-pointer shadow-md active:scale-95 transition-transform"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-slate-550 font-bold">Physical Address / Sector *</label>
                <button
                  type="button"
                  onClick={onTogglePinMode}
                  className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded cursor-pointer transition-all ${
                    isPinMode ? "bg-orange-100 text-orange-850 border border-orange-300" : "bg-slate-100 text-slate-600 border border-slate-200"
                  }`}
                >
                  <MapPin className="w-3 h-3 text-orange-500" />
                  {isPinMode ? "Click Map Now" : "Pick on Map"}
                </button>
              </div>
              <input
                type="text"
                name="address"
                required
                value={formData.address}
                onChange={handleInputChange}
                placeholder="e.g. 500 Battery St, Metropolis"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
              <div className="text-[9px] text-slate-400 mt-1">
                {tempPin
                  ? `Selected coordinates: Lat ${tempPin.lat.toFixed(4)}, Lng ${tempPin.lng.toFixed(4)}`
                  : "Pick a location manually or use default metropolitan coordinates"}
              </div>
            </div>

            {/* Profile reporter info if currentUser is not set */}
            {!currentUser && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-550 font-bold mb-1">Reporter Name</label>
                  <input
                    type="text"
                    name="reporterName"
                    value={formData.reporterName}
                    onChange={handleInputChange}
                    placeholder="e.g., Sarah Connor"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-slate-550 font-bold mb-1">Reporter Email</label>
                  <input
                    type="email"
                    name="reporterEmail"
                    value={formData.reporterEmail}
                    onChange={handleInputChange}
                    placeholder="e.g., sarah@sky.net"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={uploadingImage}
            className={`w-full mt-4 py-2.5 rounded-lg font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95 ${
              uploadingImage ? "bg-slate-400 text-slate-100 cursor-not-allowed" : "bg-slate-900 text-white hover:bg-slate-800"
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            Launch AI Intake Agent Analysis
          </button>
        </form>
      ) : (
        /* LEADERBOARD & LEAGUES DASHBOARD */
        <div className="space-y-4">
          {/* User Profile League Status Badge */}
          {currentUser && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={currentUser.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100"}
                    alt={currentUser.name}
                    className="w-10 h-10 rounded-full object-cover border border-slate-200"
                  />
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">{currentUser.name}</h4>
                    <p className="text-[10px] text-slate-400 font-mono">{currentUser.email}</p>
                  </div>
                </div>
              </div>

              {/* Glassmorphic League Gradient card */}
              <div className={`p-4 rounded-xl bg-gradient-to-br ${league.color} border shadow-md flex items-center justify-between`}>
                <div>
                  <span className="text-[9px] uppercase font-black tracking-widest opacity-80 flex items-center gap-1">
                    <Award className="w-3.5 h-3.5 animate-pulse" /> Rank Tier
                  </span>
                  <h3 className="text-base font-black tracking-tight">{league.name}</h3>
                  {league.next && (
                    <p className="text-[10px] mt-1 font-semibold opacity-90">
                      {league.threshold - pts} pts until {league.next} League
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-[9px] uppercase font-bold opacity-75">Trophy Points</div>
                  <div className="text-3xl font-black font-mono tracking-tight">{pts}</div>
                </div>
              </div>

              {/* Progress Bar to next league */}
              {league.next && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] font-bold text-slate-400 font-mono">
                    <span>{prevThreshold} pts</span>
                    <span>{league.threshold} pts</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* User statistics count */}
              <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-center">
                <div className="bg-slate-50/70 p-2 rounded-lg border border-slate-100">
                  <div className="text-[9px] font-bold text-slate-400 uppercase">Reports Filed</div>
                  <div className="text-base font-bold text-slate-800">{currentUser.reports_filed}</div>
                </div>
                <div className="bg-slate-50/70 p-2 rounded-lg border border-slate-100">
                  <div className="text-[9px] font-bold text-slate-400 uppercase">Evidence Sent</div>
                  <div className="text-base font-bold text-slate-800">{currentUser.evidence_submitted}</div>
                </div>
              </div>
            </div>
          )}

          {/* Leaderboard Table List */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-150 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              City Citizen Leaderboard
            </div>

            {isLoadingLeaderboard ? (
              <div className="p-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin" />
                Refreshed ranking data...
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No users found.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
                {leaderboard.map((user, idx) => {
                  const isCurrent = currentUser?.email === user.email;
                  const rank = idx + 1;
                  const userLeague = getLeague(user.points);

                  let rankBadge = (
                    <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 text-slate-500 flex items-center justify-center text-[10px] font-bold font-mono">
                      {rank}
                    </span>
                  );
                  if (rank === 1) {
                    rankBadge = (
                      <span className="w-5 h-5 rounded-full bg-amber-100 border border-amber-300 text-amber-600 flex items-center justify-center text-[10px] font-bold shadow-sm">
                        👑
                      </span>
                    );
                  } else if (rank === 2) {
                    rankBadge = (
                      <span className="w-5 h-5 rounded-full bg-slate-200 border border-slate-350 text-slate-600 flex items-center justify-center text-[10px] font-bold shadow-sm">
                        🥈
                      </span>
                    );
                  } else if (rank === 3) {
                    rankBadge = (
                      <span className="w-5 h-5 rounded-full bg-orange-100 border border-orange-200 text-orange-700 flex items-center justify-center text-[10px] font-bold shadow-sm">
                        🥉
                      </span>
                    );
                  }

                  return (
                    <div
                      key={user.email}
                      className={`p-3 flex items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors ${
                        isCurrent ? "bg-blue-50/30 font-semibold" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {rankBadge}
                        <img
                          src={user.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100"}
                          alt={user.name}
                          className="w-8 h-8 rounded-full object-cover border border-slate-150"
                        />
                        <div className="truncate">
                          <div className="text-xs text-slate-800 flex items-center gap-1.5">
                            <span className="truncate">{user.name}</span>
                            {isCurrent && <span className="text-[8px] bg-blue-600 text-white px-1.5 py-0.2 rounded uppercase font-bold">You</span>}
                          </div>
                          <div className="text-[9px] text-slate-400 font-mono">{userLeague.name}</div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="text-xs font-bold text-slate-800 font-mono">{user.points}</span>
                        <span className="text-[9px] text-slate-400 ml-1">pts</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Achievement Milestones list */}
          {currentUser && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
              <h4 className="text-xs font-bold text-slate-850 uppercase tracking-wide flex items-center gap-1">
                <Award className="w-4 h-4 text-blue-500" /> Badge Milestones
              </h4>
              <div className="space-y-2">
                {/* Achievement 1 */}
                <div className={`p-2.5 rounded-lg border flex items-center justify-between transition-all ${
                  currentUser.reports_filed > 0 ? "bg-emerald-50/40 border-emerald-250 text-emerald-900" : "bg-slate-50 border-slate-200 text-slate-400"
                }`}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`text-lg ${currentUser.reports_filed > 0 ? "opacity-100" : "opacity-40 grayscale"}`}>🚨</span>
                    <div>
                      <div className="text-xs font-bold">First Responder</div>
                      <p className="text-[10px] opacity-80">Filed at least one incident report</p>
                    </div>
                  </div>
                  {currentUser.reports_filed > 0 ? (
                    <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded uppercase">Unlocked</span>
                  ) : (
                    <span className="text-[9px] font-bold bg-slate-200 text-slate-500 px-2 py-0.5 rounded uppercase">Locked</span>
                  )}
                </div>

                {/* Achievement 2 */}
                <div className={`p-2.5 rounded-lg border flex items-center justify-between transition-all ${
                  currentUser.evidence_submitted > 0 ? "bg-emerald-50/40 border-emerald-250 text-emerald-900" : "bg-slate-50 border-slate-200 text-slate-400"
                }`}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`text-lg ${currentUser.evidence_submitted > 0 ? "opacity-100" : "opacity-40 grayscale"}`}>📸</span>
                    <div>
                      <div className="text-xs font-bold">Evidence Officer</div>
                      <p className="text-[10px] opacity-80">Added auxiliary updates to logs</p>
                    </div>
                  </div>
                  {currentUser.evidence_submitted > 0 ? (
                    <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded uppercase">Unlocked</span>
                  ) : (
                    <span className="text-[9px] font-bold bg-slate-200 text-slate-500 px-2 py-0.5 rounded uppercase">Locked</span>
                  )}
                </div>

                {/* Achievement 3 */}
                <div className={`p-2.5 rounded-lg border flex items-center justify-between transition-all ${
                  pts >= 150 ? "bg-emerald-50/40 border-emerald-250 text-emerald-900" : "bg-slate-50 border-slate-200 text-slate-400"
                }`}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`text-lg ${pts >= 150 ? "opacity-100" : "opacity-40 grayscale"}`}>🛡️</span>
                    <div>
                      <div className="text-xs font-bold">Community Guard</div>
                      <p className="text-[10px] opacity-80">Earned over 150 points (Gold League)</p>
                    </div>
                  </div>
                  {pts >= 150 ? (
                    <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded uppercase">Unlocked</span>
                  ) : (
                    <span className="text-[9px] font-bold bg-slate-200 text-slate-500 px-2 py-0.5 rounded uppercase">Locked</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
