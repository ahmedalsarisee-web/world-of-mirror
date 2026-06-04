interface MapPoint {
  name: string;
  latitude: number;
  longitude: number;
  color: string;
}

interface BuildEmployeeLocationMapHtmlOptions {
  centerLatitude: number;
  centerLongitude: number;
  zoom?: number;
  workplace: MapPoint;
  employee?: MapPoint;
}

export function buildEmployeeLocationMapHtml({
  centerLatitude,
  centerLongitude,
  zoom = 15,
  workplace,
  employee,
}: BuildEmployeeLocationMapHtmlOptions): string {
  const markers = [
    {kind: 'workplace', ...workplace},
    ...(employee ? [{kind: 'employee', ...employee}] : []),
  ];

  const markersJson = JSON.stringify(
    markers.map((marker) => ({
      lat: marker.latitude,
      lng: marker.longitude,
      label: marker.name,
      color: marker.color,
    })),
  );

  return `<!DOCTYPE html>
<html lang="ar">
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
    />
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
      crossorigin=""
    />
    <style>
      html, body, #map {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        background: #e5e3df;
      }
      .leaflet-control-attribution {
        font-size: 10px;
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script
      src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
      integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
      crossorigin=""
    ></script>
    <script>
      const markers = ${markersJson};
      const map = L.map('map', { zoomControl: true }).setView([${centerLatitude}, ${centerLongitude}], ${zoom});
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);

      const placedMarkers = [];

      function addMarkers(items) {
        placedMarkers.forEach((marker) => map.removeLayer(marker));
        placedMarkers.length = 0;
        items.forEach((item) => {
          const marker = L.circleMarker([item.lat, item.lng], {
            radius: 10,
            color: '#ffffff',
            weight: 2,
            fillColor: item.color,
            fillOpacity: 0.95,
          }).addTo(map);
          marker.bindPopup('<strong>' + item.label + '</strong>');
          placedMarkers.push(marker);
        });
      }

      addMarkers(markers);

      window.recenterMap = function recenterMap(lat, lng, nextZoom) {
        map.setView([lat, lng], nextZoom || ${zoom});
      };

      window.updateMapMarkers = function updateMapMarkers(nextMarkers, lat, lng, nextZoom) {
        addMarkers(nextMarkers);
        if (lat != null && lng != null) {
          window.recenterMap(lat, lng, nextZoom);
        }
      };
    </script>
  </body>
</html>`;
}

export function buildEmployeeLocationMapMarkerScript(
  workplace: MapPoint,
  employee: MapPoint | undefined,
  centerLatitude: number,
  centerLongitude: number,
  zoom = 15,
): string {
  const markers = [
    {lat: workplace.latitude, lng: workplace.longitude, label: workplace.name, color: workplace.color},
  ];

  if (employee) {
    markers.push({
      lat: employee.latitude,
      lng: employee.longitude,
      label: employee.name,
      color: employee.color,
    });
  }

  return `window.updateMapMarkers(${JSON.stringify(markers)}, ${centerLatitude}, ${centerLongitude}, ${zoom}); true;`;
}
