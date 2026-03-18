// ============================================================
// map.js — Leaflet map, markers, legend, detail panel
// ============================================================

const PASS_COLORS = {
  epic:        "#0057a8",
  ikon:        "#c8102e",
  independent: "#4a7c4e"
};

// Vertical drop range for marker sizing
const V_MIN = 245;   // Yawgoo
const V_MAX = 3050;  // Killington
const R_MIN = 6;
const R_MAX = 18;

let map;
let markerLayer;      // L.LayerGroup for all circle markers
const markerMap = {}; // id -> L.circleMarker

function verticalToRadius(vertical) {
  const t = (vertical - V_MIN) / (V_MAX - V_MIN);
  return R_MIN + t * (R_MAX - R_MIN);
}

function initMap() {
  map = L.map("map", {
    center: [44.0, -71.5],
    zoom: 7,
    zoomControl: true
  });

  L.tileLayer("https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://stamen.com/">Stamen Design</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 18
  }).addTo(map);

  markerLayer = L.layerGroup().addTo(map);

  // Build all markers
  MOUNTAINS.forEach(m => {
    const r = verticalToRadius(m.vertical);
    const circle = L.circleMarker([m.lat, m.lng], {
      radius: r,
      fillColor: PASS_COLORS[m.pass],
      color: "#fff",
      weight: 1.5,
      opacity: 1,
      fillOpacity: 0.85
    });

    circle.bindTooltip(m.name, {
      permanent: false,
      direction: "top",
      offset: [0, -r],
      className: "mountain-tooltip"
    });

    circle.on("click", (e) => {
      L.DomEvent.stopPropagation(e);
      openDetailPanel(m);
    });

    markerMap[m.id] = circle;
    markerLayer.addLayer(circle);
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
    div.innerHTML = `
      <strong style="font-size:11px;display:block;margin-bottom:5px;">Pass Type</strong>
      <div class="legend-item">
        <span class="legend-dot" style="width:10px;height:10px;background:#0057a8"></span> Epic Pass
      </div>
      <div class="legend-item">
        <span class="legend-dot" style="width:10px;height:10px;background:#c8102e"></span> Ikon Pass
      </div>
      <div class="legend-item">
        <span class="legend-dot" style="width:10px;height:10px;background:#4a7c4e"></span> Independent
      </div>
      <div style="margin-top:6px;border-top:1px solid #ddd;padding-top:5px;">
        <strong style="font-size:11px;display:block;margin-bottom:4px;">Size = Vertical Drop</strong>
        <div class="legend-item">
          <span class="legend-dot" style="width:${R_MIN*2}px;height:${R_MIN*2}px;background:#888;border-radius:50%"></span> ~${V_MIN} ft
        </div>
        <div class="legend-item">
          <span class="legend-dot" style="width:${R_MAX*2}px;height:${R_MAX*2}px;background:#888;border-radius:50%"></span> ~${V_MAX} ft
        </div>
      </div>
    `;
    return div;
  };

  legend.addTo(map);
}
