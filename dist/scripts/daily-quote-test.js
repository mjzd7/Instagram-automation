"use strict";
/**
 * Test version that bypasses API calls to test treatment logic
 */
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const node_url_1 = require("node:url");
// Mock the fetch function to avoid API calls
global.fetch = async () => {
    return {
        ok: false,
        status: 404,
        text: () => Promise.resolve("Not Found"),
        json: () => Promise.resolve({ data: [] })
    };
};
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
const HISTORY_PATH = (0, node_path_1.join)((0, node_path_1.dirname)((0, node_url_1.fileURLToPath)(import.meta.url)), "posted.json");
const TREATMENT_STATE_PATH = (0, node_path_1.join)((0, node_path_1.dirname)((0, node_url_1.fileURLToPath)(import.meta.url)), "treatment-state.json");
// Ensure the directory exists
const scriptDir = (0, node_path_1.dirname)((0, node_url_1.fileURLToPath)(import.meta.url));
if (!(0, node_fs_1.existsSync)(scriptDir)) {
    (0, node_fs_1.mkdirSync)(scriptDir, { recursive: true });
}
if (!(0, node_fs_1.existsSync)(HISTORY_PATH)) {
    (0, node_fs_1.writeFileSync)(HISTORY_PATH, JSON.stringify({ posted: [], updated: new Date().toISOString() }, null, 2));
}
if (!(0, node_fs_1.existsSync)(TREATMENT_STATE_PATH)) {
    (0, node_fs_1.writeFileSync)(TREATMENT_STATE_PATH, JSON.stringify({ nextTreatment: "light" }, null, 2));
}
const QUOTE_API_BASE = "https://quotesapi.prayushadhikari.com.np/api/quotes/random";
const UNSPLASH_SOURCE = "https://source.unsplash.com/featured/";
const IMG_W = 1080;
const IMG_H = 1080;
// Branding
const BRAND = process.env.BRAND || "success.for.sure™";
// Convert trademark symbol to HTML entity
const BRAND_ESCAPED = BRANDREPLACED = BRAND.replace(/™/g, "&#8482;").replace(/®/g, "&#174;");
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
function loadTreatmentState() {
    if (!(0, node_fs_1.existsSync)(TREATMENT_STATE_PATH)) {
        // Default to light for first post
        return { nextTreatment: "light" };
    }
    try {
        const raw = (0, node_fs_1.readFileSync)(TREATMENT_STATE_PATH, "utf-8");
        return JSON.parse(raw);
    }
    catch {
        return { nextTreatment: "light" };
    }
}
function saveTreatmentState(state) {
    (0, node_fs_1.writeFileSync)(TREATMENT_STATE_PATH, JSON.stringify(state, null, 2));
}
// ── History helpers ───────────────────────────────────────────────────
function loadHistory() {
    if (!(0, node_fs_1.existsSync)(HISTORY_PATH))
        return new Set();
    try {
        const raw = (0, node_fs_1.readFileSync)(HISTORY_PATH, "utf-8");
        return new Set(JSON.parse(raw).posted);
    }
    catch {
        return new Set();
    }
}
function saveHistory(history) {
    (0, node_fs_1.writeFileSync)(HISTORY_PATH, JSON.stringify({ posted: [...history], updated: new Date().toISOString() }, null, 2));
}
function dedupKey(quote, author) {
    return `${author.toLowerCase().trim()}|${quote.slice(0, 50).toLowerCase().trim()}`;
}
async function fetchQuote(category) {
    // Return a mock quote for testing
    return {
        quote: "Test quote for verifying the chessboard pattern treatment toggling mechanism works correctly.",
        author: "Test Author",
        category: "motivation"
    };
}
// ── Background image fetching ─────────────────────────────────────────
async function fetchBackgroundImage(category) {
    // Return a small mock buffer for testing
    return Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]); // PNG header
}
// ── SVG generation ────────────────────────────────────────────────────
function wrapText(text, maxCharsPerLine) {
    const words = text.split(/\s+/);
    const lines = [];
    let current = "";
    for (const word of words) {
        const test = current ? `${current} ${word}` : word;
        if (test.length > maxCharsPerLine && current) {
            lines.push(current);
            current = word;
        }
        else {
            current = test;
        }
    }
    if (current)
        lines.push(current);
    return lines;
}
function escapeXml(s) {
    return s
        .replace(/&/g, "&")
        .replace(/</g, "<")
        .replace(/>/g, ">")
        .replace(/"/g, '"')
        .replace(/'/g, "'");
}
function renderQuoteSvg(lines, author, brand, imgWidth, imgHeight, imgBase64, overlayOpacity) {
    const lineH = 76;
    const lineGap = 12;
    const totalTextH = lines.length * (lineH + lineGap) - lineGap;
    const startY = (imgHeight - totalTextH) / 2 - 40; // roughly center
    // Build text lines
    const textElements = lines
        .map((line, i) => `<text x="${imgWidth / 2}" y="${startY + i * (lineH + lineGap)}" font-family="Georgia, 'Times New Roman', serif" font-size="52" fill="${TEXT_COLOR}" text-anchor="middle" font-style="italic">${escapeXml(line)}</text>`)
        .join("\n    ");
    const authorY = startY + lines.length * (lineH + lineGap) + 50;
    return `<svg width="${imgWidth}" height="${imgHeight}" xmlns="http://www.w3.org/2000/svg">
  <!-- Background image -->
  <image width="100%" height="100%" preserveAspectRatio="xMidYMid slice" href="data:image/jpeg;base64,${imgBase64}"/>

  <!-- Tint overlay to unify colors -->
  <rect width="${imgWidth}" height="${imgHeight}" fill="rgba(15,12,41,${overlayOpacity})" /> <!-- dynamic tint -->

  <!-- Top accent bar -->
  <rect width="${imgWidth}" height="6" fill="${AUTHOR_COLOR}"/>

  <!-- Subtle diamond pattern overlay (light) -->
  <g opacity="0.03">
    ${Array.from({ length: 20 }, (_, r) => Array.from({ length: 20 }, (_, c) => `<rect x="${c * 60}" y="${r * 60}" width="30" height="30" fill="#fff" transform="rotate(45 ${c * 60 + 15} ${r * 60 + 15})"/>`).join("")).join("")}
  </g>

  <!-- Quote mark -->
  <text x="60" y="200" font-family="Georgia, serif" font-size="180" fill="rgba(255,255,255,0.06)">"</text>

  <!-- Quote text -->
  ${textElements}

  <!-- Author -->
  <text x="${imgWidth / 2}" y="${authorY}" font-family="Georgia, 'Times New Roman', serif" font-size="34" fill="${AUTHOR_COLOR}" text-anchor="middle" font-weight="bold">— ${escapeXml(author)}</text>

  <!-- Brand -->
  <text x="${imgWidth / 2}" y="${imgHeight - 60}" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="${MUTED}" text-anchor="middle" letter-spacing="3">${escapeXml(brand)}</text>
</svg>`;
}
// ── Main ────────────────────────────────────────────────────────────
async function main() {
    const brand = process.env.BRAND || "@successquotes";
    const maxRetries = 5;
    const history = loadHistory();
    console.log(`Slot ${SLOT_ID} - history: ${history.size} posts`);
    // Get treatment state for this post
    const treatmentState = loadTreatmentState();
    const currentTreatment = treatmentState.nextTreatment; // "light" or "dark"
    console.log(`Current treatment: ${currentTreatment}`);
    // Determine overlay opacity based on treatment
    const overlayOpacity = currentTreatment === "light" ? 0.05 : 0.4;
    // Light: barely visible tint (almost whitish)
    // Dark: current noticeable tint
    console.log(`Using opacity: ${overlayOpacity}`);
    let quote = null;
    let selectedCategory = "";
    let imgBuffer = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        // Deterministically pick a category based on date+slot+attempt to avoid infinite loops
        const seedCat = `${new Date().toISOString().slice(0, 10)}-slot-${SLOT_ID}-attempt-${attempt}`;
        const catIdx = seededIndex(seedCat, CATEGORIES.length);
        selectedCategory = CATEGORIES[catIdx];
        try {
            quote = await fetchQuote(selectedCategory);
            const key = dedupKey(quote.quote, quote.author);
            if (history.has(key)) {
                console.log(`Duplicate (${attempt + 1}/${maxRetries}): "${quote.author}" - retrying`);
                continue;
            }
            // Fetch background image for this category
            imgBuffer = await fetchBackgroundImage(selectedCategory);
            // Fresh quote
            console.log(`Quote: "${quote.quote.slice(0, 60)}..." — ${quote.author} (category: ${selectedCategory})`);
            break;
        }
        catch (err) {
            console.warn(`Attempt ${attempt + 1} failed:`, err.message);
            // continue to next attempt
        }
    }
    if (!quote || !imgBuffer) {
        console.log("No quote or image found.");
        process.exit(0);
    }
    // 2. Generate SVG with embedded background image
    const maxCharsPerLine = 36;
    const lines = wrapText(quote.quote, maxCharsPerLine);
    const imgBase64 = imgBuffer.toString("base64");
    const svg = renderQuoteSvg(lines, quote.author, BRAND_ESCAPED, IMG_W, IMG_H, imgBase64, overlayOpacity);
    // Save SVG for inspection
    const svgPath = (0, node_path_1.join)(dirna((0, node_url_1.fileURLToPath)(import.meta.url)), "debug-test.svg");
    (0, node_fs_1.writeFileSync)(svgPath, svg);
    console.log(`SVG saved to ${svgPath}`);
    console.log(`Overlay opacity used in SVG: ${overlayOpacity}`);
    // Also generate PNG
    const sharp = await getSharp();
    const pngBuffer = await sharp.default()(Buffer.from(svg)).png().toBuffer();
    const pngPath = (0, node_path_1.join)(dirna((0, node_url_1.fileURLToPath)(import.meta.url)), "debug-test.png");
    (0, node_fs_1.writeFileSync)(pngPath, pngBuffer);
    console.log(`PNG saved to ${pngPath}`);
    // 5. Save to history
    history.add(dedupKey(quote.quote, quote.author));
    saveHistory(history);
    console.log(`History updated: ${history.size} total posts`);
    // 6. Toggle treatment for next post and save state
    const nextState = {
        nextTreatment: currentTreatment === "light" ? "dark" : "light"
    };
    saveTreatmentState(nextState);
    console.log(`Treatment state updated: next post will be ${nextState.nextTreatment}`);
    process.exit(0);
}
main().catch((err) => {
    console.error("❌", err.message || err);
    process.exit(1);
});
