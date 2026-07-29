/**
 * daily-quote.ts — composio run script
 *
 * Fetches a quote from selected categories, overlays it on a royalty-free background image,
 * and posts to Instagram via Composio.
 *
 * Usage:
 *   SLOT_ID=1 composio run --file scripts/daily-quote.ts
 *
 * Slot map (IST / UTC+5:30):
 *   1 = Mon 7:00 PM  = 13:30 UTC
 *   2 = Tue 7:00 PM  = 13:30 UTC
 *   3 = Wed 12:00 PM = 06:30 UTC
 *   4 = Wed 6:00 PM  = 12:30 UTC
 *   5 = Thu 9:00 AM  = 03:30 UTC
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
// Sharp import - using dynamic import to avoid ES module issues in some environments
let sharpModule;
async function getSharp() {
    if (!sharpModule) {
        // @ts-ignore - dynamic import
        sharpModule = await import("sharp");
    }
    return sharpModule;
}
// ── Configuration ──────────────────────────────────────────────────────
const HISTORY_PATH = join(__dirname, "posted.json");
// Ensure the directory exists
const scriptDir = __dirname;
if (!existsSync(scriptDir)) {
    mkdirSync(scriptDir, { recursive: true });
}
if (!existsSync(HISTORY_PATH)) {
    writeFileSync(HISTORY_PATH, JSON.stringify({ posted: [], updated: new Date().toISOString() }, null, 2));
}
const QUOTE_API_BASE = "https://quotesapi.prayushadhikari.com.np/api/quotes/random";
const UNSPLASH_SOURCE = "https://source.unsplash.com/featured/";
const IMG_W = 1080;
const IMG_H = 1080;
// Branding
const BRAND = process.env.BRAND || "success.for.sure™";
// Convert trademark symbol to HTML entity
const BRAND_ESCAPED = BRAND.replace(/™/g, "&#8482;").replace(/®/g, "&#174;");
const AUTHOR_COLOR = "#e94560"; // accent red
const TEXT_COLOR = "#ffffff";
const MUTED = "rgba(255,255,255,0.35)";
// Categories to pick from (comma-separated from env or default)
const CATEGORIES_ENV = process.env.CATEGORIES || "business,entrepreneurship,leadership,success,motivation";
const CATEGORIES = CATEGORIES_ENV.split(",").map(s => s.trim()).filter(Boolean);
// Core hashtags and location tags (comma-separated env vars)
const HASHTAGS_ENV = process.env.HASHTAGS || "#motivatemedaily,#inspire,#inspiremedaily,#motivate,#hustle,#hardwork";
const HASHTAGS = HASHTAGS_ENV.split(",").map(t => t.trim()).filter(Boolean);
const LOCATIONS_ENV = process.env.LOCATIONS || "#gurgaon,#delhidiaries";
const LOCATIONS = LOCATIONS_ENV.split(",").map(t => t.trim()).filter(Boolean);
// Slot ID from environment (1-5)
const SLOT_ID = process.env.SLOT_ID || "0";
// Helper: simple string hash to integer
function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
}
// Deterministic pseudo-random index from seed string
function seededIndex(seed, max) {
    return Math.abs(hashCode(seed)) % max;
}
// ── History helpers ───────────────────────────────────────────────────
function loadHistory() {
    if (!existsSync(HISTORY_PATH))
        return new Set();
    try {
        const raw = readFileSync(HISTORY_PATH, "utf-8");
        return new Set(JSON.parse(raw).posted);
    }
    catch {
        return new Set();
    }
}
function saveHistory(history) {
    writeFileSync();
}
