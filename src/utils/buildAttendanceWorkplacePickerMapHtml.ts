interface BuildAttendanceWorkplacePickerMapHtmlOptions {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  markerColor: string;
  circleColor: string;
}

export function buildAttendanceWorkplacePickerMapHtml({
  latitude,
  longitude,
  radiusMeters,
  markerColor,
  circleColor,
}: BuildAttendanceWorkplacePickerMapHtmlOptions): string {
  const circleFill = `${circleColor}33`;

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
        touch-action: none;
      }
      .leaflet-control-attribution { font-size: 9px; }
      .leaflet-control-zoom a {
        width: 36px;
        height: 36px;
        line-height: 36px;
        font-size: 20px;
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
      const markerColor = ${JSON.stringify(markerColor)};
      const circleStroke = ${JSON.stringify(circleColor)};
      const circleFill = ${JSON.stringify(circleFill)};

      const map = L.map('map', {
        zoomControl: true,
        tap: true,
        dragging: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
      }).setView([${latitude}, ${longitude}], 16);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(map);

      let center = L.latLng(${latitude}, ${longitude});
      let radiusMeters = ${radiusMeters};

      const marker = L.marker(center, {
        draggable: true,
        autoPan: true,
      }).addTo(map);

      const circle = L.circle(center, {
        radius: radiusMeters,
        color: circleStroke,
        fillColor: circleFill,
        fillOpacity: 0.35,
        weight: 2,
      }).addTo(map);

      function sendLocation(lat, lng) {
        center = L.latLng(lat, lng);
        if (!window.ReactNativeWebView) return;
        window.ReactNativeWebView.postMessage(
          JSON.stringify({ type: 'location', latitude: lat, longitude: lng }),
        );
      }

      function applyCenter(lat, lng, recenter, notifyApp) {
        center = L.latLng(lat, lng);
        marker.setLatLng(center);
        circle.setLatLng(center);
        if (recenter) {
          map.panTo(center);
        }
        if (notifyApp) {
          sendLocation(lat, lng);
        }
      }

      function setRadius(meters) {
        radiusMeters = meters;
        circle.setRadius(meters);
      }

      map.on('click', (event) => {
        applyCenter(event.latlng.lat, event.latlng.lng, false, true);
      });

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        applyCenter(pos.lat, pos.lng, false, true);
      });

      window.updateWorkplacePicker = function updateWorkplacePicker(lat, lng, meters, recenter) {
        if (meters != null) {
          setRadius(meters);
        }
        if (lat != null && lng != null) {
          applyCenter(lat, lng, !!recenter, false);
        }
      };
    </script>
  </body>
</html>`;
}

export function buildAttendanceWorkplacePickerUpdateScript(
  latitude: number,
  longitude: number,
  radiusMeters: number,
  recenter: boolean,
): string {
  return `window.updateWorkplacePicker(${latitude}, ${longitude}, ${radiusMeters}, ${recenter ? 'true' : 'false'}); true;`;
}
