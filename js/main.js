// ============================================================
// main.js — app bootstrap
// ============================================================

(function () {
  // 1. Init map with all 25 markers
  initMap();

  // 2. Init static filter sliders
  initSliders();

  // 3. Wire pass checkboxes
  initPassToggles();

  // 4. Close detail panel button
  document.getElementById("detail-close").addEventListener("click", closeDetailPanel);

  // 5. Close detail panel when clicking bare map (not a marker)
  map.on("click", closeDetailPanel);

  // 6. Initial filter pass (shows all 25)
  applyFilters();

  // 7. Fetch live conditions (async — UI fully usable before this returns)
  loadLiveConditions();
})();
