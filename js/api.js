// ============================================================
// api.js — loads conditions.json (updated daily by GitHub Actions)
// Falls back gracefully if the file is empty or unavailable.
// ============================================================

async function loadLiveConditions() {
  try {
    const res = await fetch("/conditions.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();
    if (!json.updated || !json.mountains) throw new Error("Empty conditions file");

    let maxSnow = 0, maxOpenRuns = 0, maxOpenLifts = 0;
    let anyData = false;

    MOUNTAINS.forEach(m => {
      const c = json.mountains[m.id];
      if (!c) return;

      m.live.snowDepth  = c.baseDepth   ?? null;
      m.live.summitDepth= c.summitDepth ?? null;
      m.live.recentSnow = c.recentSnow  ?? null;
      m.live.openRuns   = c.openRuns    ?? null;
      m.live.openLifts  = c.openLifts   ?? null;

      if (c.baseDepth  != null && c.baseDepth  > maxSnow)      maxSnow      = c.baseDepth;
      if (c.openRuns   != null && c.openRuns   > maxOpenRuns)   maxOpenRuns  = c.openRuns;
      if (c.openLifts  != null && c.openLifts  > maxOpenLifts)  maxOpenLifts = c.openLifts;
      anyData = true;
    });

    if (!anyData) throw new Error("No mountain data in conditions.json");

    initLiveSliders(maxSnow, maxOpenRuns, maxOpenLifts);

    const updated = new Date(json.updated).toLocaleString([], {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
    });
    showStatus(`Conditions updated ${updated}`, "ok");

  } catch (err) {
    console.warn("Conditions unavailable:", err.message);
    showStatus("Live conditions not yet available — run the scraper first", "error");
  }
}

function showStatus(msg, type) {
  const bar = document.getElementById("live-status");
  bar.textContent = msg;
  bar.classList.remove("hidden", "error");
  if (type === "error") bar.classList.add("error");
}
