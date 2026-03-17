// ============================================================
// filters.js — slider init, filter state, applyFilters()
// ============================================================

// Current filter state — ranges mirror slider initial values
let filterState = {
  passes: { epic: true, ikon: true, independent: true },
  // Live (populated after Open-Meteo loads)
  snowDepth:   null,  // [min, max] or null = inactive
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
// Live sliders (created after Open-Meteo data arrives)
// ============================================================
function initLiveSliders(maxSnow) {
  const max = Math.max(Math.ceil(maxSnow), 1);

  sliders.snowDepth = makeSlider(
    "slider-snow", 0, max, 1,
    "snow-display", (lo, hi) => `${lo}" – ${hi}"`
  );

  filterState.snowDepth = [0, max];

  sliders.snowDepth.noUiSlider.on("update", (values) => {
    filterState.snowDepth = values.map(Number);
    applyFilters();
  });

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

    // Live filter — skip (pass through) if snow depth is null for this mountain
    if (fs.snowDepth !== null) {
      const v = m.live.snowDepth;
      if (v !== null && (v < fs.snowDepth[0] || v > fs.snowDepth[1])) continue;
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

  // Live slider — reset to full range
  if (sliders.snowDepth && filterState.snowDepth) {
    sliders.snowDepth.noUiSlider.set([0, filterState.snowDepth[1]]);
  }

  applyFilters();
}

document.getElementById("reset-btn").addEventListener("click", resetFilters);
