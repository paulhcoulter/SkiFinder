// ============================================================
// scrape-conditions.js
// Scrapes OnTheSnow snow reports for all 25 NE mountains.
// Run via GitHub Actions daily, or locally: npm run scrape
// Output: conditions.json (committed back to repo)
// ============================================================

const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");
const path = require("path");

puppeteer.use(StealthPlugin());

const BASE_URL = "https://www.onthesnow.com";

// Slugs verified from OnTheSnow state pages
const MOUNTAINS = [
  { id: "killington",        name: "Killington",         slug: "vermont/killington-resort" },
  { id: "stowe",             name: "Stowe",              slug: "vermont/stowe-mountain-resort" },
  { id: "sugarloaf",         name: "Sugarloaf",          slug: "maine/sugarloaf" },
  { id: "sunday-river",      name: "Sunday River",       slug: "maine/sunday-river" },
  { id: "loon",              name: "Loon Mountain",      slug: "new-hampshire/loon-mountain" },
  { id: "cannon",            name: "Cannon Mountain",    slug: "new-hampshire/cannon-mountain" },
  { id: "sugarbush",         name: "Sugarbush",          slug: "vermont/sugarbush" },
  { id: "okemo",             name: "Okemo",              slug: "vermont/okemo-mountain-resort" },
  { id: "mount-snow",        name: "Mount Snow",         slug: "vermont/mount-snow" },
  { id: "stratton",          name: "Stratton",           slug: "vermont/stratton-mountain" },
  { id: "jay-peak",          name: "Jay Peak",           slug: "vermont/jay-peak" },
  { id: "smugglers-notch",   name: "Smugglers' Notch",   slug: "vermont/smugglers-notch-resort" },
  { id: "wildcat",           name: "Wildcat Mountain",   slug: "new-hampshire/wildcat-mountain" },
  { id: "attitash",          name: "Attitash",           slug: "new-hampshire/attitash" },
  { id: "mount-sunapee",     name: "Mount Sunapee",      slug: "new-hampshire/mount-sunapee" },
  { id: "waterville-valley", name: "Waterville Valley",  slug: "new-hampshire/waterville-valley" },
  { id: "bretton-woods",     name: "Bretton Woods",      slug: "new-hampshire/bretton-woods" },
  { id: "crotched",          name: "Crotched Mountain",  slug: "new-hampshire/crotched-mountain" },
  { id: "jiminy-peak",       name: "Jiminy Peak",        slug: "massachusetts/jiminy-peak" },
  { id: "berkshire-east",    name: "Berkshire East",     slug: "massachusetts/berkshire-east" },
  { id: "bolton-valley",     name: "Bolton Valley",      slug: "vermont/bolton-valley" },
  { id: "mad-river-glen",    name: "Mad River Glen",     slug: "vermont/mad-river-glen" },
  { id: "mohawk",            name: "Mohawk Mountain",    slug: "connecticut/mohawk-mountain" },
  { id: "ski-sundown",       name: "Ski Sundown",        slug: "connecticut/ski-sundown" },
  { id: "yawgoo",            name: "Yawgoo Valley",      slug: "rhode-island/yawgoo-valley" },
];

// ============================================================
// Extract conditions from the page's innerText.
// Patterns verified against live Killington page:
//   "Base\n12\"\n..."  "Summit\n24\"\n..."
//   "Lifts Open\n12/20 open"  "Runs Open\n105/155 open"
//   "24h\n\n0\""
// ============================================================
async function extractConditions(page) {
  return page.evaluate(() => {
    const body = document.body.innerText;

    function match(regex) {
      const m = body.match(regex);
      return m ? parseInt(m[1], 10) : null;
    }

    return {
      baseDepth:    match(/Base\n(\d+)"/i),
      summitDepth:  match(/Summit\n(\d+)"/i),
      recentSnow:   match(/24h\s+(\d+)"/i),
      openLifts:    match(/Lifts Open\s+(\d+)\/\d+\s+open/i),
      openRuns:     match(/Runs Open\s+(\d+)\/\d+\s+open/i),
    };
  });
}

// ============================================================
// Scrape one resort
// ============================================================
async function scrapeResort(browser, mountain) {
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on("request", req =>
    ["image", "font", "media"].includes(req.resourceType()) ? req.abort() : req.continue()
  );

  try {
    const url = `${BASE_URL}/${mountain.slug}/skireport`;
    console.log(`  Fetching ${mountain.name}...`);

    await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });
    await new Promise(r => setTimeout(r, 1500));

    const title = await page.title();
    if (title.includes("Page Not Found")) {
      console.warn(`  WARN ${mountain.name}: 404 — check slug "${mountain.slug}"`);
      return null;
    }

    const data = await extractConditions(page);
    console.log(
      `  ${mountain.name}: base=${data.baseDepth}" summit=${data.summitDepth}" ` +
      `24h=${data.recentSnow}" runs=${data.openRuns} lifts=${data.openLifts}`
    );
    return data;

  } catch (err) {
    console.error(`  ERROR ${mountain.name}: ${err.message}`);
    return null;
  } finally {
    await page.close();
  }
}

// ============================================================
// Main — process in batches of 4
// ============================================================
async function main() {
  console.log("Launching browser...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const results = {};
  const BATCH_SIZE = 4;

  for (let i = 0; i < MOUNTAINS.length; i += BATCH_SIZE) {
    const batch = MOUNTAINS.slice(i, i + BATCH_SIZE);
    console.log(`\nBatch ${Math.floor(i / BATCH_SIZE) + 1} / ${Math.ceil(MOUNTAINS.length / BATCH_SIZE)}`);

    const batchResults = await Promise.all(batch.map(m => scrapeResort(browser, m)));
    batch.forEach((m, idx) => { results[m.id] = batchResults[idx]; });
  }

  await browser.close();

  const output = {
    updated: new Date().toISOString(),
    mountains: results,
  };

  const outPath = path.join(__dirname, "..", "conditions.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\nWrote ${outPath}`);

  const failed = Object.entries(results).filter(([, v]) => v === null).map(([k]) => k);
  if (failed.length) {
    console.warn(`\nNo data for: ${failed.join(", ")}`);
  }
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
