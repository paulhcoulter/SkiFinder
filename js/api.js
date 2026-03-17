// ============================================================
// api.js — fetch snow depth from Open-Meteo (free, no key)
// Called directly from the browser — no proxy needed.
// Open-Meteo docs: https://open-meteo.com/en/docs
// ============================================================

const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";

async function loadLiveConditions() {
  try {
    // Fire all 25 requests in parallel
    const requests = MOUNTAINS.map(m =>
      fetch(`${OPEN_METEO_BASE}?latitude=${m.lat}&longitude=${m.lng}&current=snow_depth&timezone=auto`)
        .then(r => r.ok ? r.json() : Promise.reject(r.status))
    );

    const results = await Promise.allSettled(requests);

    let maxSnow = 0;
    let anySuccess = false;

    results.forEach((result, i) => {
      if (result.status !== "fulfilled") return;
      const data = result.value;
      const depthMeters = data?.current?.snow_depth;
      if (depthMeters == null) return;

      // Convert meters → inches, round to 1 decimal
      const depthInches = Math.round(depthMeters * 39.3701 * 10) / 10;
      MOUNTAINS[i].live.snowDepth = depthInches;
      if (depthInches > maxSnow) maxSnow = depthInches;
      anySuccess = true;
    });

    if (!anySuccess) throw new Error("All requests failed");

    initLiveSliders(maxSnow);

    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    showStatus(`Snow depth updated at ${now} · Open-Meteo`, "ok");

  } catch (err) {
    console.warn("Open-Meteo unavailable:", err);
    showStatus("Live snow depth unavailable — showing static data only", "error");
  }
}

function showStatus(msg, type) {
  const bar = document.getElementById("live-status");
  bar.textContent = msg;
  bar.classList.remove("hidden", "error");
  if (type === "error") bar.classList.add("error");
}
