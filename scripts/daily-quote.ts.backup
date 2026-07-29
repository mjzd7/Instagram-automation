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

const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY; // Required for Unsplash API

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
// ── Background image fetching ─────────────────────────────────────────
async function fetchBackgroundImage(category: string): Promise<Buffer> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    throw new Error("UNSPLASH_ACCESS_KEY environment variable is not set");
  }

  try {
    // Try to get image for the specific category
    const response = await fetch(
      `https://api.unsplash.com/photos/random?query=${encodeURIComponent(
        category
      )}&orientation=landscape&client_id=${accessKey}`
    );

    if (!response.ok) {
      // Fallback to motivation category if specific category fails
      const fallbackResponse = await fetch(
        `https://api.unsplash.com/photos/random?query=motivation&orientation=landscape&client_id=${accessKey}`
      );
      if (!fallbackResponse.ok) {
        throw new Error(
          `Failed to fetch image from Unsplash: ${response.status} ${response.statusText}`
        );
      }
      const data = await fallbackResponse.json();
      const imageUrl = data.urls.regular;
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(
          `Failed to download image: ${imageResponse.status} ${imageResponse.statusText}`
        );
      }
      return Buffer.from(await imageResponse.arrayBuffer());
    }

    const data = await response.json();
    const imageUrl = data.urls.regular; // Good balance of quality and file size
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(
        `Failed to download image: ${imageResponse.status} ${imageResponse.statusText}`
      );
    }
    return Buffer.from(await imageResponse.arrayBuffer());
  } catch (error) {
    console.error("Error fetching background image:", error);
    
    // Final fallback: create a simple gradient background
    return createFallbackBackground();
  }
}

// Optional: Create a simple gradient background as final fallback
function createFallbackBackground(): Buffer {
  // Check if canvas is available
  let Canvas;
  try {
    Canvas = require("canvas");
  } catch (e) {
    // If canvas is not available, return a minimal valid PNG
    // This is a 1x1 transparent PNG
    return Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );
  }

  const { createCanvas } = Canvas;
  const canvas = createCanvas(IMG_W, IMG_H);
  const ctx = canvas.getContext("2d");

  // Create a nice gradient background
  const gradient = ctx.createLinearGradient(0, 0, 0, IMG_H);
  gradient.addColorStop(0, "#1e3c72");
  gradient.addColorStop(1, "#2a5298");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, IMG_W, IMG_H);

  // Add some subtle texture/noise
  for (let i = 0; i < 500; i++) {
    const x = Math.random() * IMG_W;
    const y = Math.random() * IMG_H;
    const radius = Math.random() * 1.5;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.08})`;
    ctx.fill();
  }

  return canvas.toBuffer("image/png");
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

function buildCaption(quote: string, author: string, brand: string, hashtags: string[], locations: string[]): string {
  const engagement = "Tell Someone 😇\nTag Someone ❤\nTeach Someone 💞\n\n";
  const quoteSection = `"${quote}" — ${author}\n\n`;
  const allTags = [...hashtags, ...locations].join(" ");
  const brandHandle = brand.includes("™") || brand.includes("®") ? brand : brand + "™";
  return `${engagement}${quoteSection}${allTags}\n${brandHandle}`;
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
  const startY = (imgHeight - totalTextH) / 2 - 40;

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
