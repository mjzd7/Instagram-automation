/**
 * Simple health check endpoint to verify Vercel runtime works.
 */
export default async function handler(
  req: { method: string },
  res: {
    status: (code: number) => { json: (body: unknown) => void };
  }
) {
  return res.status(200).json({
    ok: true,
    time: new Date().toISOString(),
    node: process.version,
    memory: process.memoryUsage().rss,
  });
}
