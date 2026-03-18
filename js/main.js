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

  // 7. Sidebar hide/show
  document.getElementById("sidebar-toggle").addEventListener("click", () => {
    document.getElementById("filter-panel").classList.add("hidden");
    document.getElementById("sidebar-show").classList.remove("hidden");
    setTimeout(() => map.invalidateSize(), 50);
  });
  document.getElementById("sidebar-show").addEventListener("click", () => {
    document.getElementById("filter-panel").classList.remove("hidden");
    document.getElementById("sidebar-show").classList.add("hidden");
    setTimeout(() => map.invalidateSize(), 50);
  });

  // 8. Fetch live conditions (async — UI fully usable before this returns)
  loadLiveConditions();
})();
