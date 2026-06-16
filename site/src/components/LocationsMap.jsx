import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// A little map of Granny's regular spots. Each circle is a place she walks;
// bigger circle = more visits. CircleMarkers avoid the broken-marker-icon
// problem you get bundling Leaflet's default pin images.
export default function LocationsMap({ locations }) {
  const pts = locations.filter((l) => Number.isFinite(l.lat));
  if (!pts.length) return <p className="muted">No mapped places yet.</p>;

  const center = [
    pts.reduce((a, l) => a + l.lat, 0) / pts.length,
    pts.reduce((a, l) => a + l.lng, 0) / pts.length,
  ];
  const maxVisits = Math.max(...pts.map((l) => l.walks));

  return (
    <div className="map">
      <MapContainer center={center} zoom={11} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {pts.map((l) => (
          <CircleMarker
            key={l.name}
            center={[l.lat, l.lng]}
            radius={8 + (l.walks / maxVisits) * 18}
            pathOptions={{ color: "#2f7d4f", fillColor: "#5aa06f", fillOpacity: 0.7, weight: 2 }}
          >
            <Tooltip direction="top">
              <strong>{l.name}</strong>
              <br />
              {l.walks} walks · {l.distance} km
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
