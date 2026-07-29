/**
 * api/post.ts — Vercel serverless function
 *
 * Triggered by cron (vercel.json) or manually via GET/POST.
 * Calls the daily-quote main() function and returns the result.
 */
import { main } from '../src/daily-quote.js';

export default async function handler(
  req: { method: string },
  res: {
    status: (code: number) => { json: (body: unknown) => void };
  }
) {
  // Only allow GET or POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    await main();
    return res.status(200).json({ ok: true, message: 'Post executed' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Handler error:', message);
    return res
      .status(500)
      .json({ ok: false, error: message });
  }
}
