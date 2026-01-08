import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import { LatLng, Icon } from "leaflet";
import { MapPin } from "lucide-react";
import "leaflet/dist/leaflet.css";

// Fix for default marker icon
const customIcon = new Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Bali center coordinates
const BALI_CENTER: [number, number] = [-8.4095, 115.1889];

interface LocationPickerProps {
  value: string;
  onChange: (location: string, coords?: { lat: number; lng: number }) => void;
  placeholder?: string;
}

function LocationMarker({ 
  position, 
  setPosition 
}: { 
  position: LatLng | null; 
  setPosition: (pos: LatLng) => void;
}) {
  useMapEvents({
    click(e) {
      setPosition(e.latlng);
    },
  });

  return position ? <Marker position={position} icon={customIcon} /> : null;
}

export function LocationPicker({ value, onChange, placeholder }: LocationPickerProps) {
  const [position, setPosition] = useState<LatLng | null>(null);
  const [address, setAddress] = useState(value);

  // Reverse geocoding to get address from coordinates
  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'en',
          },
        }
      );
      const data = await response.json();
      if (data.display_name) {
        return data.display_name;
      }
    } catch (error) {
      console.error("Geocoding error:", error);
    }
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  };

  const handlePositionChange = async (pos: LatLng) => {
    setPosition(pos);
    const addr = await reverseGeocode(pos.lat, pos.lng);
    setAddress(addr);
    onChange(addr, { lat: pos.lat, lng: pos.lng });
  };

  useEffect(() => {
    setAddress(value);
  }, [value]);

  return (
    <div className="space-y-3">
      {/* Address display */}
      <div className="flex items-start gap-2 p-3 bg-card/50 rounded-lg border border-golden/30">
        <MapPin className="w-4 h-4 text-golden mt-0.5 shrink-0" />
        <p className="text-sm text-foreground break-words">
          {address || placeholder || "Click on the map to select location"}
        </p>
      </div>

      {/* Map */}
      <div className="h-[300px] rounded-xl overflow-hidden border border-golden/30">
        <MapContainer
          center={BALI_CENTER}
          zoom={10}
          style={{ height: "100%", width: "100%" }}
          className="z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LocationMarker position={position} setPosition={handlePositionChange} />
        </MapContainer>
      </div>

      {/* Popular locations */}
      <div className="flex flex-wrap gap-2">
        {[
          { name: "Seminyak", coords: [-8.6908, 115.1668] },
          { name: "Kuta", coords: [-8.7180, 115.1689] },
          { name: "Ubud", coords: [-8.5069, 115.2625] },
          { name: "Canggu", coords: [-8.6478, 115.1385] },
          { name: "Sanur", coords: [-8.6783, 115.2628] },
        ].map((loc) => (
          <button
            key={loc.name}
            type="button"
            onClick={() => handlePositionChange(new LatLng(loc.coords[0], loc.coords[1]))}
            className="px-3 py-1.5 text-xs bg-card/50 border border-golden/30 rounded-full hover:border-golden/60 hover:bg-golden/10 transition-colors text-foreground"
          >
            {loc.name}
          </button>
        ))}
      </div>
    </div>
  );
}
