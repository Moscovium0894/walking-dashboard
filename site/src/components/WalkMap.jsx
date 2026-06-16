import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// v1: base map centred on the UK. Once GPX tracks are stored in Supabase,
// each walk's route will be drawn here as a coloured line.
export default function WalkMap() {
  return (
    <div className="map">
      <MapContainer
        center={[54.0, -2.5]}
        zoom={6}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
      </MapContainer>
      <p className="muted map-note">
        Walk routes will be drawn here once GPX tracks are stored.
      </p>
    </div>
  );
}
