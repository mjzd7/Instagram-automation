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
import { getFontFaceCss } from "./fonts.ts";


// Declare the execute function from Composio
declare function execute(slug: string, data?: any): Promise<any>;

// Texture overlay system for backgrounds
interface TextureOptions {
  opacity: number;
  scale?: number;
  rotation?: number;
}

/**
 * Generates a base64-encoded texture overlay (paper/grain)
 * @param width Width of the texture
 * @param height Height of the texture
 * @param options Texture options (opacity, scale, rotation)
 * @returns Base64 encoded PNG texture
 */
async function generateTextureOverlay(width: number, height: number, options: TextureOptions = { opacity: 0.03, scale: 1.0, rotation: 0 }): Promise<string> {
  const { Canvas, createCanvas } = await import("canvas");
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  
  // Clear canvas
  ctx.clearRect(0, 0, width, height);
  
  const { opacity = 0.03, scale = 1.0, rotation = 0 } = options;
  
  ctx.globalAlpha = opacity;
  
  // Layer 1: Base noise texture (foundation)
  for (let i = 0; i < width * height * 0.08; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const size = Math.random() * 1.5 + 0.2;
    const alpha = Math.random() * 0.4 + 0.1;
    
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Layer 2: Subtle directional fibers
  for (let i = 0; i < width * height * 0.04; i++) {
    const x1 = Math.random() * width;
    const y1 = Math.random() * height;
    const angle = (Math.random() - 0.5) * 0.8;
    const length = Math.random() * 30 + 10;
    const x2 = x1 + Math.cos(angle) * length;
    const y2 = y1 + Math.sin(angle) * length;
    const strokeWidth = Math.random() * 0.8 + 0.2;
    const alpha = Math.random() * 0.3 + 0.1;
    
    ctx.strokeStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.lineWidth = strokeWidth;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  
  // Layer 3: Organic blob variations
  for (let i = 0; i < 8; i++) {
    const cx = Math.random() * width;
    const cy = Math.random() * height;
    const rx = Math.random() * 40 + 10;
    const ry = Math.random() * 20 + 5;
    const rot = Math.random() * Math.PI * 2;
    const alpha = Math.random() * 0.2 + 0.05;
    
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.scale(1, 0.6);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.restore();
    ctx.fill();
  }
  
  if (options.scale && options.scale !== 1) {
    ctx.save();
    ctx.translate(width/2, height/2);
    ctx.scale(options.scale, options.scale);
    ctx.translate(-width/2, -height/2);
  }
  
  if (options.rotation && options.rotation !== 0) {
    ctx.save();
    ctx.translate(width/2, height/2);
    ctx.rotate(options.rotation * Math.PI / 180);
    ctx.translate(-width/2, -height/2);
  }
  
  const buffer = canvas.toBuffer("image/png");
  return buffer.toString("base64");
}

/**
 * Determines appropriate texture options based on background treatment
 * @param treatment "light" or "dark"
 * @returns Texture options optimized for the background type
 */
function getTextureOptionsForTreatment(treatment: "light" | "dark"): TextureOptions {
    if (treatment === "light") {
      return {
        opacity: 0.02,
        scale: 1.0,
        rotation: 0
      };
    } else {
      return {
        opacity: 0.03,
        scale: 1.8,
        rotation: 45
      };
    }
  }

async function generateDropShadowOverlay(width: number, height: number, options: { opacity?: number; blur?: number; offsetX?: number; offsetY?: number; color?: string } = { opacity: 0.1, blur: 6, offsetX: 2, offsetY: 2, color: 'rgba(0,0,0,0.1)' }): Promise<string> {
   const { Canvas, createCanvas } = await import("canvas");
   const canvas = createCanvas(width, height);
   const ctx = canvas.getContext("2d");
   
   // Clear canvas
   ctx.clearRect(0, 0, width, height);
   
   // Parse options with defaults
   const { opacity = 0.1, blur = 6, offsetX = 2, offsetY = 2, color = 'rgba(0,0,0,0.1)' } = options;
   
   // Create a shadow as a blurred ellipse using multiple layers for softness
   const steps = 10;
   for (let i = steps; i > 0; i--) {
     const alpha = (i / steps) * opacity * 0.3; // reduce opacity for softer shadow
     ctx.globalAlpha = alpha;
     ctx.fillStyle = color;
     
     // Calculate scale based on blur and step (outer layers more blurred)
     const scale = 1 + (blur * (steps - i) / steps) * 0.04;
     
     ctx.save();
     ctx.translate(width/2 + offsetX, height/2 + offsetY);
     ctx.scale(scale, scale);
     // Draw an ellipse that approximates a shadow shape
     ctx.beginPath();
     ctx.ellipse(0, 0, width * 0.4, height * 0.1, 0, 0, Math.PI * 2);
     ctx.fill();
     ctx.restore();
   }
   
   return canvas.toBuffer("image/png").toString("base64");
 }

// Sharp import - handle both ESM ({ default: fn }) and CJS (fn directly)
let sharpFn: any;
async function getSharp() {
  if (!sharpFn) {
    // @ts-ignore - dynamic import
    const mod = await import("sharp");
    sharpFn = mod.default || mod;
  }
  return sharpFn;
}

// ── Configuration ──────────────────────────────────────────────────────
// In Vercel/Lambda, /tmp is the only writable directory
const DATA_DIR = process.env.VERCEL
  ? "/tmp"
  : dirname(fileURLToPath(import.meta.url));
const HISTORY_PATH = join(DATA_DIR, "posted.json");
const TREATMENT_STATE_PATH = join(DATA_DIR, "treatment-state.json");
// Ensure the directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}
if (!existsSync(HISTORY_PATH)) {
  writeFileSync(HISTORY_PATH, JSON.stringify({ posted: [], updated: new Date().toISOString() }, null, 2));
}
if (!existsSync(TREATMENT_STATE_PATH)) {
  writeFileSync(TREATMENT_STATE_PATH, JSON.stringify({ nextTreatment: "light" }, null, 2));
}

const QUOTE_API_BASE = "https://dummyjson.com/quotes/random";
const UNSPLASH_SOURCE = "https://source.unsplash.com/featured/";
const IMG_W = 1080;
const IMG_H = 1080;

// Branding
const BRAND = process.env.BRAND || "success.for.sure™";
// Convert trademark symbol to HTML entity
const BRAND_ESCAPED = BRAND.replace(/™/g, "&#8482;").replace(/®/g, "&#174;");
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY; // Required for Unsplash API

// Categories to pick from (comma-separated from env or default)
const CATEGORIES_ENV = process.env.CATEGORIES || "business,entrepreneurship,leadership,success,motivation";
const CATEGORIES = CATEGORIES_ENV.split(",").map(s => s.trim()).filter(Boolean);

// Core hashtags and location tags (comma-separated env vars)
const HASHTAGS_ENV = process.env.HASHTAGS || "#motivatemedaily,#inspire,#inspiremedaily,#motivate,#hustle,#hardwork";
const HASHTAGS = HASHTAGS_ENV.split(",").map(t => t.trim()).filter(Boolean);
const LOCATIONS_ENV = process.env.LOCATIONS || "#gurgaon,#delhidiaries";
const LOCATIONS = LOCATIONS_ENV.split(",").map(t => t.trim()).filter(Boolean);

// Inappropriate content keywords for image filtering
const INAPPROPRIATE_IMAGE_KEYWORDS = [
  // Sexual content
  "sex", "sexual", "sexy", "nude", "naked", "topless", "bottomless",
  "breast", "breasts", "boob", "boobs", "tit", "tits", "nipple", "nipples",
  "vagina", "vaginal", "penis", "penile", "cock", "dick", "penis",
  "clitoris", "clit", "labia", "anus", "anal",
  "erection", "erect", "horny", "aroused", "arousal",
  "masturbat", "masturbation", "jerk off", "handjob", "blowjob",
  "sex", "sexxx", "sexxxx", "xxx", "xrated", "x-rated",
  "porn", "pornographic", "porno", "xxx", "adult",
  "fetish", "kink", "bdsm", "bondage", "domination", "submission",
  "latex", "leather", "whip", "handcuffs",
  "lingerie", "underwear", "bra", "panties",

  // Provocative poses/actions
  "strip", "stripping", "stripper", "lap dance", "pole dance",
  "provocative", "seductive", "alluring", "tempting",
  "erotic", "erotica", "sensual", "sensuality",
  "provocative pose", "suggestive", "revealing",
  "cleavage", "sideboob", "underboob", "underwear",
  "thong", "gstring", "bikini", "swimsuit",
  "beach body", "bikini body", "six pack", "abs",

  // Sexual orientations/acts (when used in explicit context)
  "homosexual", "heterosexual", "bisexual", "lesbian", "gay",
  "straight", "queer", "lgbt", "lgbtq",
  "makeout", "making out", "french kiss", "deep kiss",
  "orgy", "threesome", "group sex", "gangbang",

  // Other potentially inappropriate
  "wet tshirt", "wet t-shirt", "nip slip", "wardrobe malfunction",
  "camel toe", "moose knuckle",
  "sex toy", "dildo", "vibrator",
  "escort", "prostitute", "prostitution",
  "strip club", "burlesque", "cabaret",
  "hentai", "ecchi", "yaoi", "yuri",
];

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

// ── Treatment state helpers ───────────────────────────────────────────
interface TreatmentState {
  nextTreatment: "light" | "dark";
}

function loadTreatmentState(): TreatmentState {
  if (!existsSync(TREATMENT_STATE_PATH)) {
    // Default to light for first post
    return { nextTreatment: "light" as const };
  }
  try {
    const raw = readFileSync(TREATMENT_STATE_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { nextTreatment: "light" as const };
  }
}

function saveTreatmentState(state: TreatmentState) {
  writeFileSync(
    TREATMENT_STATE_PATH,
    JSON.stringify(state, null, 2)
  );
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


// Helper: check if image metadata contains inappropriate content
function isImageContentAppropriate(metadata: { 
  description?: string | null; 
  alt_description?: string | null;
  alt?: string | null;
}): boolean {
  if (!metadata) return true;
  
  // Check all available text fields for inappropriate content
  const textToCheck = [
    metadata.description,
    metadata.alt_description,
    metadata.alt
  ].filter((text): text is string => text !== null && text !== undefined)
   .join(' ')
   .toLowerCase();
   
  return !INAPPROPRIATE_IMAGE_KEYWORDS.some(keyword => 
    textToCheck.includes(keyword.toLowerCase())
  );
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

  const body = await response.json() as {
    id?: number | string;
    quote: string;
    author: string;
  };
  if (!body?.quote) {
    throw new Error("No quote returned from API");
  }
  return {
    quote: body.quote,
    author: body.author,
    id: String(body.id || ""),
    category: "",
  };
}

// ── Background image fetching (OFFICIAL UNSPLASH API) ─────────────────────
async function isImageDarkEnough(buffer: Buffer, threshold: number): Promise<boolean> {
  try {
    const sharp = await getSharp();
    const { width, height } = await sharp(buffer).metadata();
    if (!width || !height) return false;
    // Resize to 50x50 for fast sampling, get raw RGB pixels
    const pixels = await sharp(buffer).resize(50, 50, { fit: "fill" }).raw().toBuffer();
    let dark = 0;
    const total = pixels.length / 3;
    for (let i = 0; i < pixels.length; i += 3) {
      const lum = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
      if (lum < 100) dark++;
    }
    return dark / total >= threshold;
  } catch {
    return true; // can't analyze → accept
  }
}

async function fetchBackgroundImage(category: string, quoteText?: string, quoteAuthor?: string): Promise<Buffer> {
  // Helper: pick a query in order of preference: quote text, author, category, motivation
  const pickQuery = (): string => {
    if (quoteText && quoteText.trim().length > 0) return quoteText.slice(0, 200);
    if (quoteAuthor && quoteAuthor.trim().length > 0) return quoteAuthor.slice(0, 200);
    return category || "motivation";
  };

  // Helper: delay for rate limiting
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Seed for consistent Picsum images
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const seed = `${today}-slot-${SLOT_ID}-cat-${category}`;

  // ---------- UNSPLASH ----------
  const fetchUnsplashImage = async (query: string, needsDark: boolean): Promise<Buffer | null> => {
    const accessKey = process.env.UNSPLASH_ACCESS_KEY;
    if (!accessKey) return null;

// Try without color filter first, then with &color=black if needed for dark images
    const colorParams = needsDark ? ["", "&color=black"] : [""];
    for (const colorParam of colorParams) {
      try {
        const metaResponse = await fetch(
          `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape${colorParam}&content_filter=high&client_id=${accessKey}`
        );
        if (!metaResponse.ok) {
          // If we get a 429 (rate limit), wait a bit before retrying
          if (metaResponse.status === 429) {
            await delay(1000);
          }
          continue;
        }
        const meta = await metaResponse.json() as { 
          urls?: { raw?: string }; 
          description?: string | null;
          alt_description?: string | null;
        };
        if (!meta?.urls?.raw) continue;
        
        // Check for inappropriate content in image metadata
        if (!isImageContentAppropriate({
          description: meta.description,
          alt_description: meta.alt_description
        })) {
          continue; // Skip this image, try next
        }

        const imgUrl = `${meta.urls.raw}&fm=jpg&w=1080&h=1080&fit=crop`;
        const imgResponse = await fetch(imgUrl);
        if (!imgResponse.ok) continue;

        const buffer = Buffer.from(await imgResponse.arrayBuffer());
        // For dark treatment, verify the image is dark enough (>60% dark pixels)
        if (!needsDark || (await isImageDarkEnough(buffer, 0.6))) {
          return buffer;
        }
        // Too light -> try next variation
      } catch (err) {
        // Continue to next variation
        continue;
      }
    }
    return null;
  };

// ---------- PEXELS ----------
  const fetchPexelsImage = async (query: string, needsDark: boolean): Promise<Buffer | null> => {
    const apiKey = process.env.PEXELS_API_KEY;
    if (!apiKey) return null;

    try {
      const response = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=landscape&per_page=15`,
        { headers: { Authorization: apiKey } }
      );
      if (!response.ok) {
        if (response.status === 429) await delay(1000); // rate limit
        return null;
      }
      const data = await response.json() as { photos?: Array<{ src: { original: string; large2x: string }; alt?: string }> };
      if (!data?.photos || data.photos.length === 0) return null;

      // Shuffle and try up to 3 photos to find a dark-enough one
      const photos = [...data.photos].sort(() => 0.5 - Math.random());
      for (let i = 0; i < Math.min(3, photos.length); i++) {
        const photo = photos[i];
        
        // Check for inappropriate content in photo metadata
        if (!isImageContentAppropriate({
          description: photo.alt,
          alt_description: photo.alt // Using alt for both fields since that's what Pexels provides
        })) {
          continue; // Skip this photo, try next
        }

        const imgUrl = photo.src.large2x || photo.src.original;
        try {
          const imgResponse = await fetch(imgUrl);
          if (!imgResponse.ok) continue;
          const buffer = Buffer.from(await imgResponse.arrayBuffer());
          if (!needsDark || (await isImageDarkEnough(buffer, 0.6))) {
            return buffer;
          }
        } catch (err) {
          continue;
        }
      }
      return null;
    } catch (err) {
      return null;
    }
  };

// ---------- PIXABAY ----------
  const fetchPixabayImage = async (query: string, needsDark: boolean): Promise<Buffer | null> => {
    const apiKey = process.env.PIXABAY_API_KEY;
    if (!apiKey) return null;

    try {
      const response = await fetch(
        `https://pixabay.com/api/?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(query)}&image_type=photo&orientation=horizontal&per_page=15&safesearch=true`
      );
      if (!response.ok) {
        if (response.status === 429) await delay(1000);
        return null;
      }
      const data = await response.json() as { hits?: Array<{ 
        largeImageURL: string; 
        webformatURL: string; 
        previewURL: string;
        tags: string;
      }> };
      if (!data?.hits || data.hits.length === 0) return null;

      // Shuffle and try up to 3 images
      const hits = [...data.hits].sort(() => 0.5 - Math.random());
      for (let i = 0; i < Math.min(3, hits.length); i++) {
        const hit = hits[i];
        
        // Check for inappropriate content in tags
        if (!isImageContentAppropriate({
          description: hit.tags, // Tags are in a comma-separated string
          alt_description: hit.tags // Using tags for both fields
        })) {
          continue; // Skip this image, try next
        }

        const imgUrl = hit.largeImageURL || hit.webformatURL || hit.previewURL;
        try {
          const imgResponse = await fetch(imgUrl);
          if (!imgResponse.ok) continue;
          const buffer = Buffer.from(await imgResponse.arrayBuffer());
          if (!needsDark || (await isImageDarkEnough(buffer, 0.6))) {
            return buffer;
          }
        } catch (err) {
          continue;
        }
      }
      return null;
    } catch (err) {
      return null;
    }
  };

  // ---------- PICSUM (zero-auth fallback) ----------
  const fetchPicsumImage = async (query: string, needsDark: boolean): Promise<Buffer | null> => {
    try {
// Picsum doesn't support search by term, so we get a random image.
      // Use a random seed to get different images each time.
// Picsum: no metadata available for content check
      const imgUrl = `https://picsum.photos/seed/${seed}/1080/1080`;
      const imgResponse = await fetch(imgUrl);
      if (!imgResponse.ok) return null;
      const buffer = Buffer.from(await imgResponse.arrayBuffer());
      if (!needsDark || (await isImageDarkEnough(buffer, 0.6))) {
        return buffer;
      }
      // If too light, we could try again with a different seed, but we'll let the outer loop handle retries
      return null;
    } catch (err) {
      return null;
    }
  };

  // ---------- GENERATE GRADIENT (final fallback) ----------
  const generateGradientBackground = async (): Promise<Buffer> => {
    const { Canvas, createCanvas } = await import("canvas");
    const canvas = createCanvas(IMG_W, IMG_H);
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 0, IMG_H);
    gradient.addColorStop(0, "#1e3c72");
    gradient.addColorStop(1, "#2a5298");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, IMG_W, IMG_H);
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
  };

  // Try each source in order, with retries per source to find a dark-enough image
  const sources = [
    { name: "unsplash", fetch: fetchUnsplashImage },
    { name: "pexels", fetch: fetchPexelsImage },
    { name: "pixabay", fetch: fetchPixabayImage },
    { name: "picsum", fetch: fetchPicsumImage },
  ];

  // Try up to 3 rounds across all sources to increase chances of finding a good image
  for (let round = 0; round < 3; round++) {
    for (const source of sources) {
      // Try each source up to 2 times per round
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const query = pickQuery();
          const buffer = await source.fetch(query, !!quoteText);
          if (buffer) {
            // Optionally log which source succeeded
            // console.log(`✅ Image sourced from ${source.name} (round ${round + 1}, attempt ${attempt + 1})`);
            return buffer;
          }
        } catch (err) {
          // Silently try next
          continue;
        }
      }
      // Small delay between sources to be gentle on APIs
      await delay(200);
    }
    // Longer delay between rounds
    await delay(500);
  }

  // If all else fails, generate gradient
  return generateGradientBackground();
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
    .replace(/"/g, '"')
    .replace(/'/g, "'");
}

interface FontSet {
  quote: string;
  author: string;
  brand: string;
}

// Font pairs for 2-font maximum system: [display font for quotes, supporting font for attribution]
const FONT_PAIRS = {
  light: [
    ["'Playfair Display', Georgia, serif", "'Helvetica', 'Arial', sans-serif"],
    ["'Bebas Neue', 'Arial Black', sans-serif", "'Helvetica', 'Arial', sans-serif"],
    ["'Merriweather', Georgia, serif", "'Open Sans', 'Helvetica', sans-serif"]
  ],
  dark: [
    ["'Bebas Neue', 'Arial Black', sans-serif", "'Montserrat', 'Segoe UI', sans-serif"],
    ["'Futura', 'Arial Black', sans-serif", "'Open Sans', 'Helvetica', sans-serif"],
    ["'Montserrat', 'Helvetica', sans-serif", "'Nunito', 'Helvetica', sans-serif"]
  ]
};

/**
 * Get font pair for category and treatment, ensuring 2-font maximum
 * @param category Quote category
 * @param treatment "light" or "dark"
 * @returns FontSet with quote, author, and brand fonts (max 2 font families)
 */
function getFontsForCategory(category: string, treatment: "light" | "dark"): FontSet {
  const isLight = treatment === "light";
  const pairs = FONT_PAIRS[isLight ? "light" : "dark"];
  
  // Select font pair based on category hash for consistency
  const pairIndex = Math.abs(hashCode(category || "")) % pairs.length;
  const [quoteFont, displayFont] = pairs[pairIndex];
  
  // For brand, use display font on dark backgrounds (better visibility with exclusion blend)
  // Use supporting font on light backgrounds (better for subtle branding)
  const brandFont = isLight ? displayFont : quoteFont;
  
  return {
    quote: quoteFont,
    author: displayFont, // Author uses supporting font
    brand: brandFont
  };
}

async function renderQuoteSvg(
  lines: string[],
  author: string,
  brand: string,
  imgWidth: number,
  imgHeight: number,
  imgBase64: string,
  overlayOpacity: number,
  treatment: "light" | "dark",
  category?: string
): Promise<string> {
  const isLight = treatment === "light";
  const fontCss = getFontFaceCss();

  function getOpticalVerticalOffset(textBlockHeight: number): number {
  // For all-caps text, optical center is slightly above mathematical center
  return -textBlockHeight * 0.04;
}

function getAsymmetryOffset(treatment: "light" | "dark"): number {
  // Intentional asymmetry to avoid perfect symmetry and create visual interest
  // Different offsets for light vs dark treatments
  if (treatment === "light") {
    // Slight upward offset for light themes
    return -8;
  } else {
    // Slight downward offset for dark themes
    return 6;
  }
}

  const fonts = getFontsForCategory(category || "", treatment);
  const quoteFont = fonts.quote;
  const authorFont = fonts.author;
  const brandFont = fonts.brand;

  const quoteSize = 46;
  const lineH = isLight ? 54 : 64;
  const lineGap = 10;

  const maxLinesBeforeShrink = 6;
  const minQuoteSize = 28;
  const shrinkFactor = lines.length > maxLinesBeforeShrink
    ? Math.max(minQuoteSize, quoteSize - (lines.length - maxLinesBeforeShrink) * 3)
    : quoteSize;
  const effectiveQuoteSize = Math.min(quoteSize, shrinkFactor);

const totalTextH = lines.length * (lineH + lineGap) - lineGap;

const verticalPaddingPercentage = 0.012; // 1.2% of image height for top padding
const horizontalPaddingPercentage = 0.15; // 15% of image width for side padding
const dynamicTopMargin = imgHeight * verticalPaddingPercentage;
const dynamicBottomMargin = imgHeight * 0.11; // 11% of image height for bottom padding
const dynamicHorizontalPadding = imgWidth * horizontalPaddingPercentage;

const lineCountFactor = Math.min(1 + (lines.length - 1) * 0.015, 1.15); // Max 15% extra for many lines
const adjustedBottomMargin = dynamicBottomMargin * lineCountFactor;

const clampedStartY = Math.max(
  dynamicTopMargin,
  Math.min(
    (imgHeight - totalTextH) / 2 + getOpticalVerticalOffset(totalTextH),
    imgHeight - totalTextH - adjustedBottomMargin
  )
);

const horizontalPad = dynamicHorizontalPadding;
  const brandTint = "#e63946";
  const textColor = isLight ? "#111111" : "#f1f1f1"; // Warmer near-black/near-white with brand undertone
  const textBlendMode = isLight ? "normal" : "exclusion";
  const mutedColor = isLight ? "#222222" : "#dddddd";

  const textElements = lines
      .map(
        (line, i) => {
          // More natural, organic variation for less AI-like appearance
          // Use deterministic pseudo-randomness based on line content for consistency
          const lineSeed = hashCode(line + i.toString() + (category || ""));
          
          const rot = ((lineSeed % 30) - 15) * 0.01;
          
          const baseLetterSpacing = 0.5 + (lineSeed % 15) * 0.1;
          const letterSpacingVariation = 0.05 + (lineSeed % 5) * 0.05;
          const totalLetterSpacing = baseLetterSpacing + letterSpacingVariation * (Math.random() > 0.5 ? 1 : -1);
          
          const baselineShift = ((lineSeed * 17) % 20) / 20 - 0.5 + ((lineSeed % 3) - 1) * 0.3;
          const sizeVariation = 0.98 + ((lineSeed * 11) % 20) * 0.002;
          
          
          // Process line for hanging punctuation
          let processedLine = line;
          // Check for leading quotation marks
          if (processedLine.startsWith('"') || processedLine.startsWith("'")) {
            // Add space after opening quote to create hanging effect
            processedLine = processedLine.substring(0, 1) + ' ' + processedLine.substring(1);
          }
          // Check for trailing quotation marks
          if (processedLine.endsWith('"') || processedLine.endsWith("'")) {
            // Add space before closing quote to create hanging effect
            const lastChar = processedLine.slice(-1);
            processedLine = processedLine.slice(0, -1) + ' ' + lastChar;
          }
          
          return `<text x="${imgWidth / 2}" y="${clampedStartY + i * (lineH + lineGap) + baselineShift}" font-family="${quoteFont}" font-size="${effectiveQuoteSize * sizeVariation}" font-weight="700" fill="${textColor}" text-anchor="middle" max-width="${imgWidth - horizontalPad}" style="mix-blend-mode:${textBlendMode};transform:rotate(${rot}deg);transform-origin:center;letter-spacing:${totalLetterSpacing}px">${escapeXml(" " + processedLine.toUpperCase() + " ")}</text>`;
        }
      )
      .join("\n    ");

  const authorY = clampedStartY + lines.length * (lineH + lineGap) + 50;

let overlayBase64 = '';
if (treatment === 'light') {
  overlayBase64 = await generateDropShadowOverlay(imgWidth, imgHeight, { opacity: 0.1, blur: 6, offsetX: 2, offsetY: 2 });
} else {
  const textureOptions = getTextureOptionsForTreatment(treatment);
  overlayBase64 = await generateTextureOverlay(imgWidth, imgHeight, textureOptions);
}
   
   return `<svg width="${imgWidth}" height="${imgHeight}" xmlns="http://www.w3.org/2000/svg">
   <defs>
     <style>${fontCss}</style>
     ${isLight ? `<linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f8f6f2"/><stop offset="100%" stop-color="#e8e4dc"/></linearGradient>` : ''}
   </defs>
   
   ${isLight
     ? `<rect width="${imgWidth}" height="${imgHeight}" fill="url(#bgGrad)"/>`
     : `<!-- Background image -->
     <image class="bg-img" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" href="data:image/jpeg;base64,${imgBase64}"/>
     
     <!-- Tint overlay -->
     <rect width="${imgWidth}" height="${imgHeight}" fill="rgba(15,12,41,${overlayOpacity})" />`}
   
   <!-- Depth overlay -->
   <image width="100%" height="100%" preserveAspectRatio="none" href="data:image/png;base64,${overlayBase64}" />
   
   <!-- Quote text -->
   ${textElements}
   
   <!-- Author -->
   <text x="${imgWidth / 2}" y="${authorY}" font-family="${authorFont}" font-size="42" fill="${textColor}" text-anchor="middle" style="mix-blend-mode:${textBlendMode}">— ${escapeXml(author)}</text>
   
// Brand with subtle weight variation
     <text x="${imgWidth / 2}" y="${imgHeight - 60}" 
           font-family="${brandFont}" 
           font-size="26" 
           fill="${mutedColor}" 
           letter-spacing="3"
           style="mix-blend-mode:${textBlendMode};font-weight:${600 + (hashCode(brand) % 101)}">${escapeXml(brand)}</text>
   </svg>`;
}

// ── Religious content filter ────────────────────────────────────────

/** Patterns found in author names that strongly indicate a religious figure. */
const RELIGIOUS_AUTHOR_PATTERNS = [
  /\(R\.?\s*A\.?\s*\.?\s*\)/i,          // Radi Allahu anhu (Islamic honorific)
  /\(R\.?\s*A\.?\s*\)/i,                 // (R.A) variant
  /\bPBUH\b/i,                           // Peace Be Upon Him
  /\bSAW\b/i,                            // Sallallahu Alayhi Wasallam
  /\bSaint\b/i,
  /\bSt\.?\s+(?:Augustine|Francis|Paul|Peter|John|Mary|Thomas|Patrick|George|Joseph|Anthony|Bernard|Teresa|Therese|Martin|Luke|Mark|Matthew)\b/i,
  /\bProphet\b/i,
  /\bApostle\b/i,
  /\bImam\b/i,
  /\bReverend\b/i,
  /\bFather\s+(?!of\b|and\b)\b/i,        // "Father" as a title, not "father of"
  /\bMother\s+Teresa\b/i,
  /\bSwami\b/i,
  /\bGuru\s+(?!of\b|is\b)\b/i,           // "Guru" as title
  /\bDalai\s+Lama\b/i,
  /\bAyatollah\b/i,
];

/** Keywords in quote text that indicate religious content. */
const RELIGIOUS_CONTENT_KEYWORDS = [
  /\bgod\b/i,
  /\bgod's\b/i,
  /\bgods?\b/i,           // covers "God" and "gods"
  /\ballah\b/i,
  /\bbible\b/i,
  /\bquran\b/i,
  /\bqur'an\b/i,
  /\bkoran\b/i,
  /\btorah\b/i,
  /\bveda\w*\b/i,
  /\bgospel\b/i,
  /\bscripture\b/i,
  /\bholy\s+(?:book|spirit|ghost|land|city|place|man|woman|text|scripture|quran|bible)\b/i,
  /\b(?:our\s+)?lord\b/i,
  /\balmighty\b/i,
  /\bcreator\b/i,
  /\bdivine\b/i,
  /\bsacred\b/i,
  /\bblessed\b/i,
  /\bblessing\b/i,
  /\bpray\b/i,
  /\bprayer\b/i,
  /\bworship\b/i,
  /\bsin\b/i,
  /\bsins?\b/i,
  /\bsinner\b/i,
  /\bsalvation\b/i,
  /\bredemption\b/i,
  /\bheaven\b/i,
  /\bheavenly\b/i,
  /\bhell\b/i,
  /\bprophet\b/i,
  /\bapostle\b/i,
  /\bangel\b/i,
  /\bdemon\b/i,
  /\bsatan\b/i,
  /\bdevil\b/i,
  /\bmessiah\b/i,
  /\bchrist\b/i,
  /\bjesus\b/i,
  /\bmuhammad\b/i,
  /\bbuddha\b/i,
  /\bkrishna\b/i,
  /\bshiva\b/i,
  /\bchurch\b/i,
  /\bmosque\b/i,
  /\btemple\b/i,
  /\bmonk\b/i,
  /\bnun\b/i,
  /\bpriest\b/i,
  /\bpastor\b/i,
  /\bimam\b/i,
  /\brepent\b/i,
  /\bsermon\b/i,
  /\bpreach\b/i,
  /\bfaith\b/i,
  /\bspiritual\b/i,
  /\bsoul\b/i,
  /\bsouled\b/i,
  /\beternal\b/i,
  /\beverlasting\b/i,
  /\bresurrection\b/i,
  /\bmiracle\b/i,
  /\bparable\b/i,
  /\bcommandment\b/i,
  /\bmissionary\b/i,
  /\bministry\b/i,
];

// Combine author + content data into a single check
function isReligiousQuote(quote: string, author: string): boolean {
  if (!quote && !author) return false;

  // === Author-based check ===
  // Strong signal: if author matches religious patterns, defilter it
  for (const pattern of RELIGIOUS_AUTHOR_PATTERNS) {
    if (pattern.test(author)) {
      console.log(`  🔍 Religious filter: author pattern "${pattern.source}" matched "${author}"`);
      return true;
    }
  }

  // Known religious figures (by full name) not covered above
  const KNOWN_RELIGIOUS_AUTHORS = [
    // Islamic caliphs and imams
    "abu bakr",
    "umar ibn",
    "ali ibn abi talib",
    "uthman ibn affan",
    "khalid ibn al-walid",
    "imam ali",
    "imam hussain",
    "imam hasan",
    // Christian figures
    "mother teresa",
    "saint francis",
    "saint augustine",
    "saint paul",
    "saint peter",
    "pope ",
    // Hindu/Buddhist spiritual leaders
    "swami vivekananda",
    "paramahansa yogananda",
    "dalai lama",
    "thich nhat hanh",
    "sri sri ravishankar",
    // Other religious writers
    "c.s. lewis",
    "billy graham",
    "joel osteen",
  ];

  const authorLower = author.toLowerCase().trim();
  for (const name of KNOWN_RELIGIOUS_AUTHORS) {
    if (authorLower.includes(name)) {
      console.log(`  🔍 Religious filter: known religious author "${author}"`);
      return true;
    }
  }

  // === Content-based check ===
  const quoteLower = quote.toLowerCase();
  let religionScore = 0;
  const matched: string[] = [];

  for (const pattern of RELIGIOUS_CONTENT_KEYWORDS) {
    if (pattern.test(quoteLower)) {
      const cleanPat = pattern.source.replace(/\\b/i, "").replace(/[\\^$.*+?()\[\]{}|]/g, "");
      matched.push(cleanPat);
      religionScore++;
    }
  }

  if (religionScore > 0) {
    console.log(`  🔍 Religious filter: content matched ${religionScore} term(s): ${matched.slice(0, 5).join(", ")}${matched.length > 5 ? "..." : ""}`);
    return true;
  }

  return false;
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  const brand = process.env.BRAND || "@successquotes";
  const maxRetries = 5;

  const history = loadHistory();
  console.log(`Slot ${SLOT_ID} - history: ${history.size} posts`);

  // Check for required Unsplash access key
  if (!UNSPLASH_ACCESS_KEY) {
    console.error("Error: UNSPLASH_ACCESS_KEY environment variable is required");
    process.exit(1);
  }

  // Get treatment state for this post
  const treatmentState = loadTreatmentState();
  const currentTreatment = treatmentState.nextTreatment; // "light" or "dark"
  console.log(`Current treatment: ${currentTreatment}`);

  // Determine overlay opacity based on treatment
  const overlayOpacity = currentTreatment === "light" ? 0.05 : 0.55;
  // Light: barely visible tint (almost whitish)
  // Dark: current noticeable tint

  // Debug mode: skip posting and just output info
  if (process.env.SKIP_POST === "true") {
    console.log("SKIP_POST mode: generating image for inspection only");
    let quote: Quote | null = null;
    let selectedCategory = "";
    let imgBuffer: Buffer | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
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
        // Skip religious quotes
        if (isReligiousQuote(quote.quote, quote.author)) {
          console.log(`Religious filter matched (${attempt + 1}/${maxRetries}): "${quote.quote.slice(0, 50)}..." — ${quote.author} - retrying`);
          continue;
        }
        const imgQuoteText = currentTreatment === "dark" && quote?.quote ? quote.quote : undefined;
        const imgAuthor = currentTreatment === "dark" && quote?.author ? quote.author : undefined;
        imgBuffer = await fetchBackgroundImage(selectedCategory, imgQuoteText, imgAuthor);
        console.log(
          `Quote: "${quote!.quote.slice(0, 60)}..." — ${quote!.author} (category: ${selectedCategory})`
        );
        break;
      } catch (err) {
        console.warn(`Attempt ${attempt + 1} failed:`, (err as Error).message);
      }
    }

    if (!quote || !imgBuffer) {
      console.log("No quote found.");
      process.exit(0);
    }

    const maxCharsPerLine = 36;
    const lines = wrapText(quote.quote, maxCharsPerLine);
    const imgBase64 = imgBuffer.toString("base64");
const svg = await renderQuoteSvg(lines, quote.author, BRAND_ESCAPED, IMG_W, IMG_H, imgBase64, overlayOpacity, currentTreatment, selectedCategory);
    
    // Save SVG for inspection
    const svgPath = join(DATA_DIR, "debug.svg");
    writeFileSync(svgPath, svg);
    console.log(`SVG saved to ${svgPath}`);
    console.log(`Overlay opacity used: ${overlayOpacity}`);
    
    // Also generate PNG
    const sharp = await getSharp();
    const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
    const pngPath = join(DATA_DIR, "debug.png");
    writeFileSync(pngPath, pngBuffer);
    console.log(`PNG saved to ${pngPath}`);
    
    process.exit(0);
  }

  let quote: Quote | null = null;
  let selectedCategory = "";
  let imgBuffer: Buffer | null = null;

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

        // Skip religious quotes
        if (isReligiousQuote(quote.quote, quote.author)) {
          console.log(`Religious filter matched (${attempt + 1}/${maxRetries}): "${quote.quote.slice(0, 50)}..." — ${quote.author} - retrying`);
          continue;
        }

        // Fetch background image for this category
        const imgQuoteText = currentTreatment === "dark" && quote?.quote ? quote.quote : undefined;
        const imgAuthor = currentTreatment === "dark" && quote?.author ? quote.author : undefined;
        imgBuffer = await fetchBackgroundImage(selectedCategory, imgQuoteText, imgAuthor);
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
  const svg = await renderQuoteSvg(lines, quote.author, BRAND_ESCAPED, IMG_W, IMG_H, imgBase64, overlayOpacity, currentTreatment, selectedCategory);
  const sharp = await getSharp();
  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();

  const tmpPath = join(DATA_DIR, "ig-post.png");
  writeFileSync(tmpPath, pngBuffer);
  console.log(
    `Image generated: ${tmpPath} (${(pngBuffer.length / 1024).toFixed(1)} KB)`
  );

  // 4. Post to Instagram
  // Guard: `execute` is only available in Composio CLI runtime, not in plain Node.js (Vercel etc.)
  if (typeof execute !== "function") {
    console.log("⚠️  Not in Composio runtime — skipping Instagram post.");
    console.log(`   Image saved to ${tmpPath} (${(pngBuffer.length / 1024).toFixed(1)} KB)`);
    // Still save to history and toggle treatment so state is consistent
    history.add(dedupKey(quote!.quote, quote!.author));
    saveHistory(history);
    const nextState = { nextTreatment: currentTreatment === "light" ? "dark" as const : "light" as const };
    saveTreatmentState(nextState);
    console.log(`   History updated: ${history.size} total posts`);
    console.log(`   Treatment toggled: next will be ${nextState.nextTreatment}`);
    return;
  }

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

// Step 4b: Create media container using composio CLI --file flag for reliable file upload
   console.log("Creating media container with composio CLI...");
   let creationId: string | undefined;
   let containerSuccess: boolean | undefined;
   
   try {
     const escapedCaption = caption.replace(/'/g, "'\\''");
     const command = `composio execute INSTAGRAM_POST_IG_USER_MEDIA --file ${tmpPath} -d '{"ig_user_id":"me","caption":"${escapedCaption}"}'`;
     const { execSync } = await import('child_process');
     const result = execSync(command, { 
       encoding: 'utf8',
       env: { ...process.env, COMPOSIO_API_KEY: process.env.COMPOSIO_API_KEY }
     });
     const containerResult = JSON.parse(result.trim());
     creationId = containerResult?.data?.id;
     containerSuccess = containerResult?.successful;
      if (!creationId || String(creationId).length < 17) {
        throw new Error(`Invalid container ID received: ${creationId}`);
      }
   } catch (cliError) {
     console.error(`CLI execution failed: ${cliError}`);
      console.log("Falling back to Composio SDK execute() with image_file...");
      try {
        // @ts-expect-error - @composio/core is an optional runtime deps (Composio env)
        const { Composio } = await import('@composio/core');
        const client = new Composio({ apiKey: process.env.COMPOSIO_API_KEY });
        const result = await client.actions.execute('INSTAGRAM_POST_IG_USER_MEDIA', { ig_user_id: 'me', caption, image_file: tmpPath });
        creationId = result?.data?.id;
        console.log(`Container (SDK fallback): success=${result?.successful}, id=${creationId} (len=${String(creationId).length})`);
      } catch (sdkError) {
        console.error(`SDK execution failed: ${sdkError}`);
        // final fallback to original execute()
        const payload: any = { ig_user_id: "me", caption, image_file: tmpPath };
        const container = await execute("INSTAGRAM_POST_IG_USER_MEDIA", payload);
        creationId = container?.data?.id;
        console.log(`Container (final fallback): success=${container?.successful}, id=${creationId} (len=${String(creationId).length})`);
      }
   }

  // Graceful exit if all container creation approaches failed
  if (!creationId || String(creationId).length < 17) {
    console.log("All container creation approaches failed. Skipping post.");
    process.exit(0); // graceful exit, no history update
  }

  // Step 4d: Publish
  console.log(`Publishing with creation_id=${creationId}...`);
  const pub = await execute("INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH", {
    ig_user_id: "me",
    creation_id: creationId,
  });
  console.log(`Pub: success=${pub?.successful}, id=${pub?.data?.id}, err=${pub?.error}`);
  const mediaId = pub?.data?.id;
  if (pub?.successful) {
    console.log(`✅ Published! Media ID: ${mediaId}`);
  } else {
    throw new Error(`Publish failed: ${pub?.error || JSON.stringify(pub?.data)}`);
  }

  // 5. Save to history
  history.add(dedupKey(quote.quote, quote.author));
  saveHistory(history);
  console.log(`History updated: ${history.size} total posts`);

  // 6. Toggle treatment for next post and save state
  const nextState = { nextTreatment: currentTreatment === "light" ? "dark" as const : "light" as const };
  saveTreatmentState(nextState);
  console.log(`Treatment state updated: next post will be ${nextState.nextTreatment}`);
            }

// -----------------------------------------------------------------------------
main().catch(err => {
  console.error('❌', err.message || err);
  process.exit(1);
});


