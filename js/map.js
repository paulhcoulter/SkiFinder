// ============================================================
// map.js — Leaflet map, markers, legend, detail panel
// ============================================================

const PASS_COLORS = {
  epic:        "#0057a8",
  ikon:        "#a83240",
  independent: "#4a7c4e"
};

// Vertical drop range for marker sizing
const V_MIN = 245;   // Yawgoo
const V_MAX = 3050;  // Killington
const S_MIN = 20;    // min icon size (px)
const S_MAX = 42;    // max icon size (px)

let map;
let markerLayer;
const markerMap = {}; // id -> L.marker

function verticalToSize(vertical) {
  const t = (vertical - V_MIN) / (V_MAX - V_MIN);
  return Math.round(S_MIN + t * (S_MAX - S_MIN));
}

function mountainIcon(mountain) {
  const size = verticalToSize(mountain.vertical);
  const color = PASS_COLORS[mountain.pass];
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
      <polygon points="50,4 96,92 4,92" fill="${color}" stroke="white" stroke-width="4" stroke-linejoin="round"/>
      <polygon points="50,4 66,36 34,36" fill="white" fill-opacity="0.9"/>
    </svg>`.trim();

  return L.divIcon({
    html: svg,
    className: "",
    iconSize:   [size, size],
    iconAnchor: [size / 2, size],
    tooltipAnchor: [0, -(size - 4)]
  });
}

function initMap() {
  map = L.map("map", {
    center: [44.0, -71.5],
    zoom: 7,
    zoomControl: true
  });

  L.tileLayer("https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 20
  }).addTo(map);

  markerLayer = L.layerGroup().addTo(map);

  // Build all markers
  MOUNTAINS.forEach(m => {
    const size = verticalToSize(m.vertical);
    const marker = L.marker([m.lat, m.lng], { icon: mountainIcon(m) });

    marker.bindTooltip(m.name, {
      permanent: false,
      direction: "top",
      offset: [0, 4],
      className: "mountain-tooltip"
    });

    marker.on("click", (e) => {
      L.DomEvent.stopPropagation(e);
      openDetailPanel(m);
    });

    markerMap[m.id] = marker;
    markerLayer.addLayer(marker);
  });

  addLegend();
}

function updateMarkers(visibleIds) {
  MOUNTAINS.forEach(m => {
    const circle = markerMap[m.id];
    if (!circle) return;
    if (visibleIds.has(m.id)) {
      if (!markerLayer.hasLayer(circle)) markerLayer.addLayer(circle);
    } else {
      if (markerLayer.hasLayer(circle)) markerLayer.removeLayer(circle);
    }
  });

  // Update count
  document.getElementById("match-count").textContent =
    `${visibleIds.size} mountain${visibleIds.size !== 1 ? "s" : ""}`;
}

// ============================================================
// Detail panel
// ============================================================
function openDetailPanel(mountain) {
  const m = mountain;
  const passLabel = { epic: "Epic Pass", ikon: "Ikon Pass", independent: "Independent" }[m.pass];

  const liveHtml = buildLiveHtml(m);

  document.getElementById("detail-content").innerHTML = `
    <h3>${m.name}</h3>
    <div class="detail-state">${m.state}</div>
    <span class="detail-badge ${m.pass}">${passLabel}</span>

    <div class="detail-grid">
      <div class="detail-stat">
        <span class="label">Vertical</span>
        <span class="value">${m.vertical.toLocaleString()} ft</span>
      </div>
      <div class="detail-stat">
        <span class="label">Peak Elev</span>
        <span class="value">${m.peakElev.toLocaleString()} ft</span>
      </div>
      <div class="detail-stat">
        <span class="label">Runs</span>
        <span class="value">${m.runs}</span>
      </div>
      <div class="detail-stat">
        <span class="label">Lifts</span>
        <span class="value">${m.lifts}</span>
      </div>
      <div class="detail-stat">
        <span class="label">Acres</span>
        <span class="value">${m.acres.toLocaleString()}</span>
      </div>
      <div class="detail-stat">
        <span class="label">Base Elev</span>
        <span class="value">${m.baseElev.toLocaleString()} ft</span>
      </div>
    </div>

    <hr class="detail-divider" />

    <div class="price-row">
      <span>Weekend ticket</span>
      <span class="price-val">$${m.weekendPrice}</span>
    </div>
    <div class="price-row">
      <span>Weekday ticket</span>
      <span class="price-val">$${m.weekdayPrice}</span>
    </div>

    ${liveHtml}
  `;

  document.getElementById("detail-panel").classList.remove("hidden");
}

function buildLiveHtml(m) {
  function liveVal(v, unit = "") {
    return v !== null && v !== undefined
      ? `<span class="live-val">${v}${unit}</span>`
      : `<span class="live-val na">—</span>`;
  }

  const conditionsLink = m.conditionsUrl
    ? `<a href="${m.conditionsUrl}" target="_blank" rel="noopener" class="conditions-link">Full conditions &rarr;</a>`
    : "";

  return `
    <hr class="detail-divider" />
    <div class="live-conditions">
      <h4>Live Conditions</h4>
      <div class="live-row"><span>Base Depth</span>${liveVal(m.live.snowDepth, '"')}</div>
      <div class="live-row"><span>Summit Depth</span>${liveVal(m.live.summitDepth, '"')}</div>
      <div class="live-row"><span>Last 24h Snow</span>${liveVal(m.live.recentSnow, '"')}</div>
      <div class="live-row"><span>Open Runs</span>${liveVal(m.live.openRuns)}</div>
      <div class="live-row"><span>Open Lifts</span>${liveVal(m.live.openLifts)}</div>
    </div>
    ${conditionsLink}
  `;
}

// Refresh detail panel if it's open for the mountain that was updated
function refreshDetailIfOpen(mountainId) {
  const panel = document.getElementById("detail-panel");
  if (panel.classList.contains("hidden")) return;
  const m = MOUNTAINS.find(m => m.id === mountainId);
  if (!m) return;
  // Check if this mountain is currently displayed
  const h3 = panel.querySelector("h3");
  if (h3 && h3.textContent === m.name) {
    openDetailPanel(m);
  }
}

function closeDetailPanel() {
  document.getElementById("detail-panel").classList.add("hidden");
}

// ============================================================
// Legend
// ============================================================
function addLegend() {
  const legend = L.control({ position: "bottomleft" });

  legend.onAdd = function () {
    const div = L.DomUtil.create("div", "map-legend");
    function legendMtn(color, size) {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100" style="display:inline-block;vertical-align:middle">
        <polygon points="50,4 96,92 4,92" fill="${color}" stroke="white" stroke-width="4" stroke-linejoin="round"/>
        <polygon points="50,4 66,36 34,36" fill="white" fill-opacity="0.9"/>
      </svg>`;
    }
    div.innerHTML = `
      <strong style="font-size:11px;display:block;margin-bottom:5px;">Pass Type</strong>
      <div class="legend-item">${legendMtn('#0057a8', 16)} Epic Pass</div>
      <div class="legend-item">${legendMtn('#c8102e', 16)} Ikon Pass</div>
      <div class="legend-item">${legendMtn('#4a7c4e', 16)} Independent</div>
      <div style="margin-top:6px;border-top:1px solid #ddd;padding-top:5px;">
        <strong style="font-size:11px;display:block;margin-bottom:4px;">Size = Vertical Drop</strong>
        <div class="legend-item">${legendMtn('#888', S_MIN)} ~${V_MIN} ft</div>
        <div class="legend-item">${legendMtn('#888', S_MAX)} ~${V_MAX} ft</div>
      </div>
    `;
    return div;
  };

  legend.addTo(map);
}
