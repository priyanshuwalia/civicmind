import React from "react";
import { Incident, RiskZone } from "../types";
import { MapPin, Eye } from "lucide-react";
import L from "leaflet";

interface CivicMapProps {
  incidents: Incident[];
  selectedIncident: Incident | null;
  onSelectIncident: (incident: Incident) => void;
  riskZones: RiskZone[];
  showRiskZones: boolean;
  interactiveMode?: "select" | "pin";
  onMapPinSelected?: (lat: number, lng: number, address: string) => void;
  tempPin: { lat: number; lng: number } | null;
}

export default function CivicMap({
  incidents,
  selectedIncident,
  onSelectIncident,
  riskZones,
  showRiskZones,
  interactiveMode = "select",
  onMapPinSelected,
  tempPin,
}: CivicMapProps) {
  const mapContainerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<L.Map | null>(null);
  
  // Refs for layer groups to easily synchronize overlays without rebuilding the entire map
  const markersLayerGroupRef = React.useRef<L.LayerGroup | null>(null);
  const riskZonesLayerGroupRef = React.useRef<L.LayerGroup | null>(null);
  const tempPinMarkerRef = React.useRef<L.Marker | null>(null);

  // 1. Initialize Leaflet Map instance on mount
  React.useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Metropolis Center coordinates
    const defaultCenter: L.LatLngExpression = [37.7749, -122.4194];
    const defaultZoom = 13;

    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: defaultZoom,
      zoomControl: false, // Hide default zoom control to place custom ones later
      scrollWheelZoom: true,
      attributionControl: true,
    });

    // Add standard zoom control at top-right
    L.control.zoom({ position: "topright" }).addTo(map);

    // Load OpenStreetMap Tiles (Free & Keyless)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    // Initialize overlay layers
    markersLayerGroupRef.current = L.layerGroup().addTo(map);
    riskZonesLayerGroupRef.current = L.layerGroup().addTo(map);

    mapRef.current = map;

    // Geolocation: start at user's current location and drop a default pin
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          map.setView([latitude, longitude], 13);
          console.log(`Map centered on user location: ${latitude}, ${longitude}`);

          // Trigger address resolution and pre-fill form
          if (onMapPinSelected) {
            onMapPinSelected(latitude, longitude, "Resolving current location address...");
            try {
              const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`
              );
              if (response.ok) {
                const data = await response.json();
                const address = data.display_name || data.name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
                onMapPinSelected(latitude, longitude, address);
              } else {
                onMapPinSelected(latitude, longitude, `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
              }
            } catch (err) {
              console.error("Failed to reverse-geocode startup location:", err);
              onMapPinSelected(latitude, longitude, `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
            }
          }
        },
        (error) => {
          console.warn("User geolocation denied or unavailable. Using default Metropolis center.", error);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // 2. Center/Pan map when selectedIncident changes
  React.useEffect(() => {
    const map = mapRef.current;
    if (map && selectedIncident) {
      map.panTo([selectedIncident.location.lat, selectedIncident.location.lng], {
        animate: true,
        duration: 0.6,
      });
    }
  }, [selectedIncident]);

  // 3. Render active city incident markers dynamically
  React.useEffect(() => {
    const map = mapRef.current;
    const layerGroup = markersLayerGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    incidents.forEach((inc) => {
      const isSelected = selectedIncident?.id === inc.id;
      let pinColor = "#3b82f6"; // default submitted (blue)

      if (inc.status === "ANALYZING") pinColor = "#eab308"; // yellow
      else if (inc.status === "PRIORITIZED") pinColor = "#f97316"; // orange
      else if (inc.status === "RESOLVING") pinColor = "#ef4444"; // red
      else if (inc.status === "RESOLVED") pinColor = "#10b981"; // green
      else if (inc.status === "REJECTED") pinColor = "#64748b"; // grey

      const size = isSelected ? 36 : 28;
      const borderWeight = isSelected ? 3.0 : 1.5;
      const borderColor = isSelected ? "#ffffff" : "#1e293b";
      const shadowClass = isSelected ? "drop-shadow-[0_4px_8px_rgba(0,0,0,0.3)] scale-110" : "drop-shadow-sm";

      // DivIcon overrides standard Leaflet icon styles with customized inline SVG markers
      const customIcon = L.divIcon({
        html: `
          <div class="relative flex items-center justify-center ${shadowClass}">
            <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2Z" fill="${pinColor}" stroke="${borderColor}" stroke-width="${borderWeight}"/>
              <circle cx="12" cy="9" r="3.5" fill="#ffffff"/>
            </svg>
          </div>
        `,
        className: "", // Empty to disable Leaflet's default white-box wrapper stylesheet
        iconSize: [size, size],
        iconAnchor: [size / 2, size],
      });

      L.marker([inc.location.lat, inc.location.lng], { icon: customIcon })
        .addTo(layerGroup)
        .on("click", () => {
          onSelectIncident(inc);
        });
    });
  }, [incidents, selectedIncident, onSelectIncident]);

  // 4. Render predictive threat risk zones (Circles overlays)
  React.useEffect(() => {
    const layerGroup = riskZonesLayerGroupRef.current;
    if (!layerGroup) return;

    layerGroup.clearLayers();

    if (showRiskZones) {
      riskZones.forEach((zone) => {
        const isHighRisk = zone.risk_score >= 80;
        const strokeColor = isHighRisk ? "#ef4444" : "#f59e0b";
        const fillColor = isHighRisk ? "#fca5a5" : "#fde047";

        L.circle([zone.lat, zone.lng], {
          radius: zone.radius || 300,
          color: strokeColor,
          weight: 1.5,
          opacity: 0.8,
          fillColor: fillColor,
          fillOpacity: 0.25,
        }).addTo(layerGroup);
      });
    }
  }, [riskZones, showRiskZones]);

  // 5. Handle Click on map for pin placement + reverse geocoding via OpenStreetMap Nominatim
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleMapClick = async (e: L.LeafletMouseEvent) => {
      if (interactiveMode !== "pin" || !onMapPinSelected) return;
      const { lat, lng } = e.latlng;

      // Update state instantly with coordinates as placeholder while request resolves
      onMapPinSelected(lat, lng, "Resolving address...");

      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
          {
            headers: {
              Accept: "application/json"
            }
          }
        );
        if (!response.ok) throw new Error("OSM Nominatim API request failed");
        const data = await response.json();
        
        // Extract display name or address components
        const address = data.display_name || data.name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        onMapPinSelected(lat, lng, address);
      } catch (err) {
        console.error("Reverse geocoding failed:", err);
        // Fallback: use latitude and longitude coordinates
        onMapPinSelected(lat, lng, `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
    };

    map.on("click", handleMapClick);

    return () => {
      map.off("click", handleMapClick);
    };
  }, [interactiveMode, onMapPinSelected]);

  // 6. Synchronize temporary user-placed pin marker (rendered always if tempPin exists)
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (tempPinMarkerRef.current) {
      tempPinMarkerRef.current.remove();
      tempPinMarkerRef.current = null;
    }

    if (tempPin) {
      const size = 32;
      const customIcon = L.divIcon({
        html: `
          <div class="relative flex items-center justify-center drop-shadow-md">
            <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2Z" fill="#2563eb" stroke="#ffffff" stroke-width="2.5"/>
              <circle cx="12" cy="9" r="3.5" fill="#ffffff"/>
            </svg>
          </div>
        `,
        className: "",
        iconSize: [size, size],
        iconAnchor: [size / 2, size],
      });

      tempPinMarkerRef.current = L.marker([tempPin.lat, tempPin.lng], { icon: customIcon }).addTo(map);
      
      // Auto pan to the newly dropped pin
      map.panTo([tempPin.lat, tempPin.lng], { animate: true });
    }
  }, [tempPin]);

  return (
    <div className="relative w-full h-[450px] bg-slate-100 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      {/* Top Map overlays */}
      <div className="absolute top-3 left-3 z-[1000] flex flex-wrap gap-2 pointer-events-none">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white/90 backdrop-blur-sm border border-slate-200 text-slate-700 rounded-lg shadow-sm">
          <Eye className="w-3.5 h-3.5 text-blue-500" />
          Sector: Metropolis Core
        </span>
        {interactiveMode === "pin" && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-orange-50/90 backdrop-blur-sm border border-orange-200 text-orange-700 rounded-lg shadow-sm animate-pulse">
            <MapPin className="w-3.5 h-3.5 animate-bounce" />
            Click on map to drop pin
          </span>
        )}
      </div>

      {/* Leaflet Map Div Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Bottom map color Legend */}
      <div className="absolute bottom-3 left-3 z-[1000] right-3 bg-white/95 backdrop-blur-sm border border-slate-200/80 p-2 text-[10px] rounded-lg shadow-sm flex flex-wrap gap-x-4 gap-y-1 justify-between items-center text-slate-700">
        <div className="flex flex-wrap gap-x-3 items-center">
          <span className="font-semibold text-slate-900 border-r border-slate-200 pr-2 mr-1">Status Legend:</span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500" /> Submitted
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-yellow-500" /> Analyzing
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-orange-500" /> Prioritized
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" /> Dispatch Action
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" /> Resolved
          </span>
        </div>
        {showRiskZones && (
          <div className="flex gap-2 items-center text-rose-700 font-medium">
            <span className="w-2.5 h-2.5 rounded-full border border-rose-500 bg-rose-100 opacity-60 flex items-center justify-center text-[7px]">●</span>
            Vulnerability Zones Active
          </div>
        )}
      </div>
    </div>
  );
}
