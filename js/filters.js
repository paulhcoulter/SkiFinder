// ============================================================
// filters.js — slider init, filter state, applyFilters()
// ============================================================

// Current filter state — ranges mirror slider initial values
let filterState = {
  passes: { epic: true, ikon: true, independent: true },
  // Live (populated after conditions.json loads)
  snowDepth:   null,  // [min, max] or null = inactive
  openRuns:    null,
  openLifts:   null,
  // Static
  runs:        [0, DATA_RANGES.runs.max],
  lifts:       [0, DATA_RANGES.lifts.max],
  peakElev:    [DATA_RANGES.peakElev.min, DATA_RANGES.peakElev.max],
  vertical:    [0, DATA_RANGES.vertical.max],
  acres:       [0, DATA_RANGES.acres.max],
  weekendPrice:[DATA_RANGES.weekendPrice.min, DATA_RANGES.weekendPrice.max],
  weekdayPrice:[DATA_RANGES.weekdayPrice.min, DATA_RANGES.weekdayPrice.max],
};

// ============================================================
// Slider factory
// ============================================================
function makeSlider(elementId, min, max, step, displayId, formatter) {
  const el = document.getElementById(elementId);
  if (!el) return null;

  noUiSlider.create(el, {
    start: [min, max],
    connect: true,
    step: step,
    range: { min, max },
    format: {
      to: v => Math.round(v),
      from: v => Number(v)
    }
  });

  const display = document.getElementById(displayId);

  el.noUiSlider.on("update", (values) => {
    const [lo, hi] = values.map(Number);
    if (display) display.textContent = formatter(lo, hi);
  });

  return el;
}

// ============================================================
// Init all sliders
// ============================================================
let sliders = {};

function initSliders() {
  const fmt = (lo, hi) => `${lo} – ${hi}`;
  const fmtDollar = (lo, hi) => `$${lo} – $${hi}`;
  const fmtElev = (lo, hi) => `${lo.toLocaleString()} – ${hi.toLocaleString()}`;

  sliders.runs = makeSlider(
    "slider-runs", DATA_RANGES.runs.min, DATA_RANGES.runs.max, 1,
    "runs-display", fmt
  );
  sliders.lifts = makeSlider(
    "slider-lifts", DATA_RANGES.lifts.min, DATA_RANGES.lifts.max, 1,
    "lifts-display", fmt
  );
  sliders.peakElev = makeSlider(
    "slider-peak", DATA_RANGES.peakElev.min, DATA_RANGES.peakElev.max, 50,
    "peak-display", fmtElev
  );
  sliders.vertical = makeSlider(
    "slider-vertical", DATA_RANGES.vertical.min, DATA_RANGES.vertical.max, 50,
    "vertical-display", fmtElev
  );
  sliders.acres = makeSlider(
    "slider-acres", DATA_RANGES.acres.min, DATA_RANGES.acres.max, 5,
    "acres-display", fmt
  );
  sliders.weekendPrice = makeSlider(
    "slider-weekend", DATA_RANGES.weekendPrice.min, DATA_RANGES.weekendPrice.max, 1,
    "weekend-display", fmtDollar
  );
  sliders.weekdayPrice = makeSlider(
    "slider-weekday", DATA_RANGES.weekdayPrice.min, DATA_RANGES.weekdayPrice.max, 1,
    "weekday-display", fmtDollar
  );

  // Wire slider changes → filterState → applyFilters
  function wireSlider(sliderEl, stateKey) {
    if (!sliderEl) return;
    sliderEl.noUiSlider.on("update", (values) => {
      filterState[stateKey] = values.map(Number);
      applyFilters();
    });
  }

  wireSlider(sliders.runs,         "runs");
  wireSlider(sliders.lifts,        "lifts");
  wireSlider(sliders.peakElev,     "peakElev");
  wireSlider(sliders.vertical,     "vertical");
  wireSlider(sliders.acres,        "acres");
  wireSlider(sliders.weekendPrice, "weekendPrice");
  wireSlider(sliders.weekdayPrice, "weekdayPrice");
}

// ============================================================
// Live sliders (created after conditions.json data arrives)
// ============================================================
function initLiveSliders(maxSnow, maxOpenRuns, maxOpenLifts) {
  function wireLive(sliderEl, stateKey) {
    sliderEl.noUiSlider.on("update", (values) => {
      filterState[stateKey] = values.map(Number);
      applyFilters();
    });
  }

  const snowMax  = Math.max(Math.ceil(maxSnow), 1);
  const runsMax  = Math.max(maxOpenRuns, 1);
  const liftsMax = Math.max(maxOpenLifts, 1);

  sliders.snowDepth = makeSlider("slider-snow",       0, snowMax,  1, "snow-display",      (lo, hi) => `${lo}" – ${hi}"`);
  sliders.openRuns  = makeSlider("slider-runs-open",  0, runsMax,  1, "runs-open-display", (lo, hi) => `${lo} – ${hi}`);
  sliders.openLifts = makeSlider("slider-lifts-open", 0, liftsMax, 1, "lifts-open-display",(lo, hi) => `${lo} – ${hi}`);

  filterState.snowDepth = [0, snowMax];
  filterState.openRuns  = [0, runsMax];
  filterState.openLifts = [0, liftsMax];

  wireLive(sliders.snowDepth, "snowDepth");
  wireLive(sliders.openRuns,  "openRuns");
  wireLive(sliders.openLifts, "openLifts");

  document.getElementById("live-section").style.display = "";
  applyFilters();
}

// ============================================================
// Pass checkboxes
// ============================================================
function initPassToggles() {
  ["epic", "ikon", "independent"].forEach(pass => {
    const el = document.getElementById(`toggle-${pass}`);
    if (!el) return;
    el.addEventListener("change", () => {
      filterState.passes[pass] = el.checked;
      applyFilters();
    });
  });
}

// ============================================================
// applyFilters — core filter logic
// ============================================================
function applyFilters() {
  const visibleIds = new Set();
  const fs = filterState;

  for (const m of MOUNTAINS) {
    // Pass filter (OR logic — show if matches any checked pass)
    if (!fs.passes[m.pass]) continue;

    // Static filters
    if (m.runs        < fs.runs[0]         || m.runs        > fs.runs[1])         continue;
    if (m.lifts       < fs.lifts[0]        || m.lifts       > fs.lifts[1])        continue;
    if (m.peakElev    < fs.peakElev[0]     || m.peakElev    > fs.peakElev[1])     continue;
    if (m.vertical    < fs.vertical[0]     || m.vertical    > fs.vertical[1])     continue;
    if (m.acres       < fs.acres[0]        || m.acres       > fs.acres[1])        continue;
    if (m.weekendPrice< fs.weekendPrice[0] || m.weekendPrice> fs.weekendPrice[1]) continue;
    if (m.weekdayPrice< fs.weekdayPrice[0] || m.weekdayPrice> fs.weekdayPrice[1]) continue;

    // Live filters — fail-open if data is null for this mountain
    if (fs.snowDepth !== null) {
      const v = m.live.snowDepth;
      if (v !== null && (v < fs.snowDepth[0] || v > fs.snowDepth[1])) continue;
    }
    if (fs.openRuns !== null) {
      const v = m.live.openRuns;
      if (v !== null && (v < fs.openRuns[0] || v > fs.openRuns[1])) continue;
    }
    if (fs.openLifts !== null) {
      const v = m.live.openLifts;
      if (v !== null && (v < fs.openLifts[0] || v > fs.openLifts[1])) continue;
    }

    visibleIds.add(m.id);
  }

  updateMarkers(visibleIds);
}

// ============================================================
// Reset
// ============================================================
function resetFilters() {
  // Checkboxes
  ["epic", "ikon", "independent"].forEach(pass => {
    const el = document.getElementById(`toggle-${pass}`);
    if (el) el.checked = true;
    filterState.passes[pass] = true;
  });

  // Static sliders
  const staticResets = {
    runs:         [DATA_RANGES.runs.min,         DATA_RANGES.runs.max],
    lifts:        [DATA_RANGES.lifts.min,        DATA_RANGES.lifts.max],
    peakElev:     [DATA_RANGES.peakElev.min,     DATA_RANGES.peakElev.max],
    vertical:     [DATA_RANGES.vertical.min,     DATA_RANGES.vertical.max],
    acres:        [DATA_RANGES.acres.min,        DATA_RANGES.acres.max],
    weekendPrice: [DATA_RANGES.weekendPrice.min, DATA_RANGES.weekendPrice.max],
    weekdayPrice: [DATA_RANGES.weekdayPrice.min, DATA_RANGES.weekdayPrice.max],
  };

  Object.entries(staticResets).forEach(([key, range]) => {
    filterState[key] = [...range];
    if (sliders[key]) sliders[key].noUiSlider.set(range);
  });

  // Live sliders — reset to full range
  if (sliders.snowDepth && filterState.snowDepth) sliders.snowDepth.noUiSlider.set([0, filterState.snowDepth[1]]);
  if (sliders.openRuns  && filterState.openRuns)  sliders.openRuns.noUiSlider.set([0, filterState.openRuns[1]]);
  if (sliders.openLifts && filterState.openLifts) sliders.openLifts.noUiSlider.set([0, filterState.openLifts[1]]);

  applyFilters();
}

document.getElementById("reset-btn").addEventListener("click", resetFilters);
