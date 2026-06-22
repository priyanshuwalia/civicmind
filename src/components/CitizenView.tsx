import React from "react";
import { Incident } from "../types";
import {
  PlusCircle,
  FileText,
  MapPin,
  Send,
  ThumbsUp,
  ThumbsDown,
  Paperclip,
  CheckCircle,
  MessageSquare,
  AlertCircle
} from "lucide-react";

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
  }) => void;
  onVote: (id: string, type: "up" | "down") => void;
  onAddEvidence: (id: string, author: string, text: string) => void;
  isPinMode: boolean;
  onTogglePinMode: () => void;
  tempPin: { lat: number; lng: number; address: string } | null;
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
}: CitizenViewProps) {
  const [activeTab, setActiveTab] = React.useState<"list" | "report">("list");

  // Form State
  const [formData, setFormData] = React.useState({
    title: "",
    rawDescription: "",
    address: "",
    reporterName: "",
    reporterEmail: "",
  });

  // Evidence state
  const [commenter, setCommenter] = React.useState("");
  const [commentText, setCommentText] = React.useState("");
  const [evidenceSuccess, setEvidenceSuccess] = React.useState(false);

  // Sync temp map pin to form box
  React.useEffect(() => {
    if (tempPin) {
      setFormData((prev) => ({
        ...prev,
        address: tempPin.address,
      }));
    }
  }, [tempPin]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
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
      reporterName: formData.reporterName || "Civic Citizen",
      reporterEmail: formData.reporterEmail || "citizen@metropolis.mail",
    });

    // Reset Form
    setFormData({
      title: "",
      rawDescription: "",
      address: "",
      reporterName: "",
      reporterEmail: "",
    });
    if (isPinMode) onTogglePinMode();
    setActiveTab("list");
  };

  const submitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident || !commenter || !commentText) return;

    onAddEvidence(selectedIncident.id, commenter, commentText);
    setCommenter("");
    setCommentText("");
    setEvidenceSuccess(true);
    setTimeout(() => setEvidenceSuccess(false), 3000);
  };

  return (
    <div className="flex flex-col gap-5 h-full">
      {/* Sub tabs */}
      <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
        <button
          onClick={() => {
            setActiveTab("list");
            if (isPinMode) onTogglePinMode();
          }}
          className={`flex-1 text-center py-2 text-xs font-bold rounded-lg cursor-pointer transition-all ${
            activeTab === "list" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-850"
          }`}
        >
          Explore Active Grievances
        </button>
        <button
          onClick={() => setActiveTab("report")}
          className={`flex-1 text-center py-2 text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "report" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-850"
          }`}
        >
          <PlusCircle className="w-3.5 h-3.5 text-blue-500" />
          File New Complaint
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
                      className={`p-3.5 hover:bg-slate-50/70 transition-all cursor-pointer flex gap-3 items-start ${
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
      ) : (
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
          </div>

          <button
            type="submit"
            className="w-full mt-4 py-2.5 bg-slate-900 text-white rounded-lg font-bold text-xs hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
          >
            <Send className="w-3.5 h-3.5" />
            Launch AI Intake Agent Analysis
          </button>
        </form>
      )}
    </div>
  );
}
