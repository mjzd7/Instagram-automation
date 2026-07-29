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
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Declare the execute function from Composio
declare function execute(slug: string, data?: any): Promise<any>;

// Sharp import - using dynamic import to avoid ES module issues in some environments
let sharpModule: any;
async function getSharp() {
  if (!sharpModule) {
    // @ts-ignore - dynamic import
    sharpModule = await import("sharp");
  }
  return sharpModule;
}

// ── Configuration ──────────────────────────────────────────────────────
const HISTORY_PATH = join(dirname(fileURLToPath(import.meta.url)), "posted.json");
// Ensure the directory exists
const scriptDir = dirname(fileURLToPath(import.meta.url));
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

// Slot ID from environment (1-5)
const SLOT_ID = process.env.SLOT_ID || "0";

// Helper: simple string hash to integer
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash;
}

// Deterministic pseudo-random index from seed string
function seededIndex(seed: string, max: number): number {
  return Math.abs(hashCode(seed)) % max;
}

// ── History helpers ───────────────────────────────────────────────────
function loadHistory(): Set<string> {
  if (!existsSync(HISTORY_PATH)) return new Set();
  try {
    const raw = readFileSync(HISTORY_PATH, "utf-8");
    return new Set(JSON.parse(raw).posted as string[]);
  } catch {
    return new Set();
  }
}

function saveHistory(history: Set<string>) {
  writeFileSync(
    HISTORY_PATH,
    JSON.stringify({ posted: [...history], updated: new Date().toISOString() }, null, 2)
  );
}

function dedupKey(quote: string, author: string): string {
  return `${author.toLowerCase().trim()}|${quote.slice(0, 50).toLowerCase().trim()}`;
}

// ── Quote fetching ───────────────────────────────────────────────────
interface Quote {
  quote: string;
  author: string;
  id?: string;
  category?: string;
}

async function fetchQuote(category: string): Promise<Quote> {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const seed = `${today}-slot-${SLOT_ID}-cat-${category}`;
  const url = `${QUOTE_API_BASE}?category=${encodeURIComponent(category)}&limit=1&min_len=50&max_len=250&seed=${seed}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Quote API returned ${response.status}: ${await response.text()}`);
  }

  const body = await response.json();
  if (!body?.data?.length) {
    throw new Error("No quote returned from API");
  }
  const q = body.data[0];
  return {
    quote: q.quote || q.content,
    author: q.author,
    id: q.id,
    category: q.category,
  };
}

// ── Background image fetching ─────────────────────────────────────────
async function fetchBackgroundImage(category: string): Promise<Buffer> {
  // Build Unsplash query: use category as search term; fallback to "motivation"
  const query = encodeURIComponent(category);
  const url = `${UNSPLASH_SOURCE}${query}`; // e.g., https://source.unsplash.com/featured/business
  const resp = await fetch(url);
  if (!resp.ok) {
    // fallback to generic
    const fallback = await fetch(`${UNSPLASH_SOURCE}motivation`);
    if (!fallback.ok) throw new Error("Failed to fetch background image");
    return Buffer.from(await fallback.arrayBuffer());
  }
  return Buffer.from(await resp.arrayBuffer());
}

// ── SVG generation ────────────────────────────────────────────────────
function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (test.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, """)
    .replace(/'/g, "'");
}

function renderQuoteSvg(
  lines: string[],
  author: string,
  brand: string,
  imgWidth: number,
  imgHeight: number,
  imgBase64: string
): string {
  const lineH = 76;
  const lineGap = 12;
  const totalTextH = lines.length * (lineH + lineGap) - lineGap;
  const startY = (imgHeight - totalTextH) / 2 - 40; // roughly center

  // Build text lines
  const textElements = lines
    .map(
      (line, i) =>
        `<text x="${imgWidth / 2}" y="${startY + i * (lineH + lineGap)}" font-family="Georgia, 'Times New Roman', serif" font-size="52" fill="${TEXT_COLOR}" text-anchor="middle" font-style="italic">${escapeXml(
          line
        )}</text>`
    )
    .join("\n    ");

  const authorY = startY + lines.length * (lineH + lineGap) + 50;

  return `<svg width="${imgWidth}" height="${imgHeight}" xmlns="http://www.w3.org/2000/svg">
  <!-- Background image -->
  <image width="100%" height="100%" preserveAspectRatio="xMidYMid slice" href="data:image/jpeg;base64,${imgBase64}"/>

  <!-- Tint overlay to unify colors -->
  <rect width="${imgWidth}" height="${imgHeight}" fill="rgba(15,12,41,0.4)" /> <!-- dark blue tint -->

  <!-- Top accent bar -->
  <rect width="${imgWidth}" height="6" fill="${AUTHOR_COLOR}"/>

  <!-- Subtle diamond pattern overlay (light) -->
  <g opacity="0.03">
    ${Array.from({ length: 20 }, (_, r) =>
      Array.from({ length: 20 }, (_, c) =>
        `<rect x="${c * 60}" y="${r * 60}" width="30" height="30" fill="#fff" transform="rotate(45 ${c * 60 + 15} ${r * 60 + 15})"/>`
      ).join("")
    ).join("")}
  </g>

  <!-- Quote mark -->
  <text x="60" y="200" font-family="Georgia, serif" font-size="180" fill="rgba(255,255,255,0.06)">"</text>

  <!-- Quote text -->
  ${textElements}

  <!-- Author -->
  <text x="${imgWidth / 2}" y="${authorY}" font-family="Georgia, 'Times New Roman', serif" font-size="34" fill="${AUTHOR_COLOR}" text-anchor="middle" font-weight="bold">— ${escapeXml(
    author
  )}</text>

  <!-- Brand -->
  <text x="${imgWidth / 2}" y="${imgHeight - 60}" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="${MUTED}" text-anchor="middle" letter-spacing="3">${escapeXml(
    brand
  )}</text>
</svg>`;
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  const brand = process.env.BRAND || "@successquotes";
  const maxRetries = 5;

  const history = loadHistory();
  console.log(`Slot ${SLOT_ID} - history: ${history.size} posts`);

  let quote: Quote | null = null;
  let selectedCategory = "";
  let imgBuffer: Buffer | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Deterministically pick a category based on date+slot+attempt to avoid infinite loops
    const seedCat = `${new Date().toISOString().slice(0, 10)}-slot-${SLOT_INDEX}-attempt-${attempt}`;
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
      console.log(
        `Quote: "${quote!.quote.slice(0, 60)}..." — ${quote!.author} (category: ${selectedCategory})`
      );
      break;
    } catch (err) {
      console.warn(`Attempt ${attempt + 1} failed:`, (err as Error).message);
      // continue to next attempt
    }
  }

  if (!quote || !imgBuffer) {
    console.log("All retries exhausted - no new quote found today.");
    process.exit(0); // not an error, just nothing new
  }

  // 2. Generate SVG with embedded background image
  const maxCharsPerLine = 36;
  const lines = wrapText(quote.quote, maxCharsPerLine);
  const imgBase64 = imgBuffer.toString("base64");
  const svg = renderQuoteSvg(lines, quote.author, BRAND_ESCAPED, IMG_W, IMG_H, imgBase64);

  // 3. Convert SVG → PNG via sharp
  const sharp = await getSharp();
  const pngBuffer = await sharp.default()(Buffer.from(svg)).png().toBuffer();

  const tmpPath = join(dirname(fileURLToPath(import.meta.url)), "ig-post.png");
  writeFileSync(tmpPath, pngBuffer);
  console.log(
    `Image generated: ${tmpPath} (${(pngBuffer.length / 1024).toFixed(1)} KB)`
  );

  // 4. Post to Instagram
  const caption = `"${quote.quote}" — ${quote.author}\n.\n.\n.\n#success #motivation #successquotes #dailyinspiration #mindset #hustle #successmindset`;

  // Step 4a: Check publishing quota
  try {
    const limit = await execute("INSTAGRAM_GET_IG_USER_CONTENT_PUBLISHING_LIMIT");
    const usage = limit.data?.quota_usage;
    if (usage) {
      const remaining = usage.quota_total - usage.quota_used;
      console.log(`Publishing quota: ${usage.quota_used}/${usage.quota_total} used`);
      if (remaining < 1) {
        console.log("Daily publishing limit reached. Skipping.");
        process.exit(0);
      }
    }
  } catch (quotaError) {
    console.warn("Could not check quota:", (quotaError as Error).message);
    // Continue anyway - maybe the endpoint isn't available
  }

  // Step 4b: Create media container (Composio auto-uploads the file)
  console.log("Creating media container...");
  const container = await execute("INSTAGRAM_POST_IG_USER_MEDIA", {
    ig_user_id: "me",
    image_file: tmpPath,
    caption,
  });
  const creationId = container.data?.id || container.data?.creation_id;
  console.log(`Container created: ${creationId}`);

  // Step 4c: Publish
  console.log("Publishing...");
  const pub = await execute("INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH", {
    ig_user_id: "me",
    creation_id: creationId,
    max_wait_seconds: 90,
  });
  const mediaId = pub.data?.id;
  console.log(`✅ Published! Media ID: ${mediaId}`);

  // 5. Save to history
  history.add(dedupKey(quote.quote, quote.author));
  saveHistory(history);
  console.log(`History updated: ${history.size} total posts`);
}

main().catch((err) => {
  console.error("❌", err.message || err);
  process.exit(1);
});
